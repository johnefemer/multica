package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Slack webhook entrypoints (Phase 3 of #18).
//
// Three distinct endpoints with three different content types and signature
// envelopes — they share verification + idempotency plumbing but the parsing
// and dispatch are per-endpoint:
//
//   /webhooks/slack/events         — JSON envelope (Events API)
//   /webhooks/slack/commands       — application/x-www-form-urlencoded
//   /webhooks/slack/interactivity  — application/x-www-form-urlencoded with payload= JSON
//
// Phase 3 ships verification + identity resolution; the actual event handling
// (chat mirroring, slash commands, etc.) lands in Phases 4 and 5. Until
// then these endpoints log and ack, with a placeholder ephemeral response
// for commands so users see something rather than silent timeouts.

// HandleSlackEvents handles the Slack Events API webhook.
//
// POST /webhooks/slack/events
func (h *Handler) HandleSlackEvents(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	body, err := readSlackBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	if err := verifySlackSignature(r); err != nil {
		slog.Warn("slack webhook signature verification failed",
			"endpoint", "events", "error", err)
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	// url_verification is Slack's one-time challenge for new event subscription
	// URLs. We have to echo back the challenge token synchronously — Slack
	// retries until it gets a 200 with the right body.
	var envelope struct {
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
		EventID   string `json:"event_id"`
		TeamID    string `json:"team_id"`
		Event     struct {
			Type      string `json:"type"`
			User      string `json:"user"`
			Channel   string `json:"channel"`
			Text      string `json:"text"`
			ThreadTS  string `json:"thread_ts"`
			TS        string `json:"ts"`
			ChannelID string `json:"channel_id"`
		} `json:"event"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}

	if envelope.Type == "url_verification" {
		w.Header().Set("Content-Type", "text/plain")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(envelope.Challenge))
		return
	}

	// Idempotency. event_id is unique per Slack delivery; if we've seen it
	// already InsertWebhookEvent returns ErrNoRows via DO NOTHING.
	deliveryID := envelope.EventID
	if deliveryID == "" {
		deliveryID = fmt.Sprintf("slack-events-%d", time.Now().UnixNano())
	}
	eventType := envelope.Event.Type
	if eventType == "" {
		eventType = envelope.Type
	}

	ev, insertErr := h.Queries.InsertWebhookEvent(ctx, db.InsertWebhookEventParams{
		WorkspaceID: pgtype.UUID{}, // resolved below from channel binding
		Provider:    "slack",
		DeliveryID:  deliveryID,
		EventType:   eventType,
		Payload:     body,
	})
	if insertErr != nil {
		if errors.Is(insertErr, pgx.ErrNoRows) {
			// Duplicate — already processed.
			w.WriteHeader(http.StatusNoContent)
			return
		}
		slog.Error("slack: failed to record event", "error", insertErr)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	// ACK Slack within 3s. Real handling happens in the goroutine below.
	w.WriteHeader(http.StatusAccepted)

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		var processErr error
		defer func() {
			errMsg := pgtype.Text{}
			if processErr != nil {
				errMsg = pgtype.Text{String: processErr.Error(), Valid: true}
				slog.Error("slack event processing failed",
					"event_type", eventType, "error", processErr)
			}
			// best-effort
			h.Queries.MarkWebhookEventProcessed(bgCtx, ev.ID, errMsg) //nolint:errcheck
		}()

		// Phase 3: only resolve workspace + identity for visibility — no
		// actual chat mirroring or slash dispatch yet (those land in Phase 4).
		channelID := envelope.Event.Channel
		if channelID == "" {
			channelID = envelope.Event.ChannelID
		}
		if channelID == "" {
			slog.Debug("slack event: no channel id", "event_type", eventType)
			return
		}

		binding, err := h.Queries.GetChatChannelBindingByChannel(bgCtx, db.GetChatChannelBindingByChannelParams{
			Platform:          "slack",
			ExternalChannelID: channelID,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				slog.Debug("slack event: channel not bound, ignoring",
					"channel_id", channelID, "event_type", eventType)
				return
			}
			processErr = fmt.Errorf("lookup binding: %w", err)
			return
		}

		if envelope.Event.User == "" {
			// Bot message or system event — nothing to resolve.
			return
		}

		ws, err := h.Queries.GetWorkspace(bgCtx, binding.WorkspaceID)
		if err != nil {
			processErr = fmt.Errorf("lookup workspace: %w", err)
			return
		}

		conn, err := h.Queries.GetIntegrationConnection(bgCtx, ws.ID, "slack")
		if err != nil {
			processErr = fmt.Errorf("lookup slack connection: %w", err)
			return
		}

		user, err := h.ResolveSlackUser(bgCtx, ws, envelope.TeamID, envelope.Event.User, conn.AccessToken)
		if err != nil {
			// Identity failures are a normal outcome (email hidden,
			// onboarding off) — log at info, not error.
			slog.Info("slack identity resolution skipped",
				"workspace_id", uuidToString(ws.ID),
				"slack_user_id", envelope.Event.User,
				"reason", err.Error(),
			)
			return
		}

		slog.Info("slack event resolved (Phase 3 plumbing — no further dispatch)",
			"workspace_id", uuidToString(ws.ID),
			"agenthost_user_id", uuidToString(user.ID),
			"event_type", eventType,
			"channel_id", channelID,
		)
	}()
}

// HandleSlackCommands handles a Slack slash command.
//
// POST /webhooks/slack/commands
//
// Slack requires a 200 response within 3 seconds; the actual work runs in
// a goroutine and replies asynchronously via response_url.
func (h *Handler) HandleSlackCommands(w http.ResponseWriter, r *http.Request) {
	body, err := readSlackBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	if err := verifySlackSignature(r); err != nil {
		slog.Warn("slack webhook signature verification failed",
			"endpoint", "commands", "error", err)
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	form, err := url.ParseQuery(string(body))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid form body")
		return
	}

	command := form.Get("command")
	text := form.Get("text")
	userID := form.Get("user_id")
	teamID := form.Get("team_id")
	channelID := form.Get("channel_id")

	slog.Info("slack slash command received (Phase 3 — placeholder)",
		"command", command, "text", text,
		"user_id", userID, "team_id", teamID, "channel_id", channelID,
	)

	// Phase 3 placeholder reply. Phase 5 will route to real subcommands.
	resp := map[string]any{
		"response_type": "ephemeral",
		"text": fmt.Sprintf(
			"Got `%s %s` — slash commands are wiring up in an upcoming phase. "+
				"For now this just confirms the integration round-trip works.",
			command, text,
		),
	}
	writeJSON(w, http.StatusOK, resp)
}

// HandleSlackInteractivity handles block_actions, view_submission, and
// shortcut payloads.
//
// POST /webhooks/slack/interactivity
//
// Slack's interactivity webhook is form-encoded with a single `payload`
// field containing JSON. Same fast-ack rule: respond ≤3s, do real work
// asynchronously via response_url or chat.postMessage.
func (h *Handler) HandleSlackInteractivity(w http.ResponseWriter, r *http.Request) {
	body, err := readSlackBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	if err := verifySlackSignature(r); err != nil {
		slog.Warn("slack webhook signature verification failed",
			"endpoint", "interactivity", "error", err)
		writeError(w, http.StatusUnauthorized, "invalid signature")
		return
	}

	form, err := url.ParseQuery(string(body))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid form body")
		return
	}

	payload := form.Get("payload")
	if payload == "" {
		writeError(w, http.StatusBadRequest, "missing payload")
		return
	}

	var meta struct {
		Type string `json:"type"`
		User struct {
			ID string `json:"id"`
		} `json:"user"`
		Team struct {
			ID string `json:"id"`
		} `json:"team"`
	}
	_ = json.Unmarshal([]byte(payload), &meta)

	slog.Info("slack interactivity received (Phase 3 — placeholder)",
		"type", meta.Type, "user_id", meta.User.ID, "team_id", meta.Team.ID,
	)

	// Empty 200 ack — Phase 4/5 will dispatch on type.
	w.WriteHeader(http.StatusOK)
}

// readSlackBody reads + buffers the request body so signature verification
// can consume it, then restores the reader for downstream parsers.
func readSlackBody(r *http.Request) ([]byte, error) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, err
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	return body, nil
}

// verifySlackSignature defers to the registered Slack provider's
// VerifyWebhook (which uses SLACK_SIGNING_SECRET). Returns an error if
// the provider is unregistered (SLACK_CLIENT_ID unset) or the signature
// fails.
func verifySlackSignature(r *http.Request) error {
	provider := IntegrationRegistry.Get("slack")
	if provider == nil {
		return errors.New("slack provider not registered (SLACK_CLIENT_ID unset?)")
	}
	return provider.VerifyWebhook(r, "")
}
