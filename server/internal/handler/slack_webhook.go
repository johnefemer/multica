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
			BotID     string `json:"bot_id"`
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

		// Phase 4: dispatch to chat-mirroring handlers.
		processErr = h.dispatchSlackEvent(bgCtx, SlackEventEnvelope{
			TeamID:  envelope.TeamID,
			EventID: envelope.EventID,
			Type:    envelope.Type,
			Event: SlackInnerEvent{
				Type:     envelope.Event.Type,
				User:     envelope.Event.User,
				Channel:  channelOrDefault(envelope.Event.Channel, envelope.Event.ChannelID),
				Text:     envelope.Event.Text,
				TS:       envelope.Event.TS,
				ThreadTS: envelope.Event.ThreadTS,
				BotID:    envelope.Event.BotID,
			},
		})
	}()
}

// channelOrDefault returns the first non-empty channel id. Slack sends
// `channel` for most event types and `channel_id` for a few legacy ones.
func channelOrDefault(a, b string) string {
	if a != "" {
		return a
	}
	return b
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

	parsed, err := parseSlackInteractivityPayload(payload)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid payload JSON")
		return
	}

	// 200 ack within Slack's 3s window. Real work happens in a goroutine
	// — picker selection eventually posts a threaded "Working on it…" via
	// chat.postMessage, so the user sees the result asynchronously.
	w.WriteHeader(http.StatusOK)

	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		switch parsed.Type {
		case "block_actions":
			if err := h.HandleSlackPickerSelection(bgCtx, parsed); err != nil {
				slog.Error("slack interactivity dispatch failed",
					"type", parsed.Type, "user_id", parsed.User.ID, "error", err)
			}
		default:
			slog.Debug("slack interactivity ignored",
				"type", parsed.Type, "user_id", parsed.User.ID)
		}
	}()
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
