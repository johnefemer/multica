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
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/events"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// IntegrationWebhook is the entry point for all provider webhook events.
// POST /webhooks/{provider}?workspace_id={uuid}
func (h *Handler) IntegrationWebhook(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	providerName := chi.URLParam(r, "provider")

	provider := IntegrationRegistry.Get(providerName)
	if provider == nil {
		writeError(w, http.StatusNotFound, fmt.Sprintf("unknown provider: %s", providerName))
		return
	}

	// Read and buffer the body so VerifyWebhook can consume it, then we can re-read.
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}
	r.Body = io.NopCloser(bytes.NewReader(bodyBytes))

	// Verify HMAC signature.
	secret := os.Getenv("GITHUB_WEBHOOK_SECRET")
	if verifyErr := provider.VerifyWebhook(r, secret); verifyErr != nil {
		slog.Warn("webhook signature verification failed",
			"provider", providerName, "error", verifyErr)
		writeError(w, http.StatusUnauthorized, "invalid webhook signature")
		return
	}

	// Resolve workspace from query param.
	wsIDStr := r.URL.Query().Get("workspace_id")
	wsID := parseUUID(wsIDStr)

	// Idempotency key.
	deliveryID := r.Header.Get("X-GitHub-Delivery")
	if deliveryID == "" {
		deliveryID = fmt.Sprintf("%s-%d", providerName, time.Now().UnixNano())
	}
	eventType := r.Header.Get("X-GitHub-Event")
	if eventType == "" {
		eventType = "unknown"
	}

	// Record event before processing (idempotent — ON CONFLICT DO NOTHING).
	ev, insertErr := h.Queries.InsertWebhookEvent(ctx, db.InsertWebhookEventParams{
		WorkspaceID: wsID,
		Provider:    providerName,
		DeliveryID:  deliveryID,
		EventType:   eventType,
		Payload:     bodyBytes,
	})
	if insertErr != nil {
		if errors.Is(insertErr, pgx.ErrNoRows) {
			// Duplicate delivery — already processed.
			w.WriteHeader(http.StatusNoContent)
			return
		}
		slog.Error("failed to record webhook event", "provider", providerName, "error", insertErr)
		writeError(w, http.StatusInternalServerError, "failed to record event")
		return
	}

	// Respond 202 immediately; process async.
	w.WriteHeader(http.StatusAccepted)

	go func() {
		bgCtx := context.Background()
		var processErr error
		defer func() {
			errMsg := pgtype.Text{}
			if processErr != nil {
				errMsg = pgtype.Text{String: processErr.Error(), Valid: true}
				slog.Error("webhook processing failed",
					"provider", providerName, "event", eventType, "error", processErr)
			}
			h.Queries.MarkWebhookEventProcessed(bgCtx, ev.ID, errMsg) //nolint:errcheck
		}()

		if !wsID.Valid {
			processErr = fmt.Errorf("no valid workspace_id in webhook URL")
			return
		}

		switch providerName {
		case "github":
			processErr = h.processGitHubWebhook(bgCtx, wsID, eventType, bodyBytes)
		}
	}()
}

// ── GitHub event routing ────────────────────────────────────────────────────

// processGitHubWebhook dispatches a verified GitHub event to the specific handler.
func (h *Handler) processGitHubWebhook(ctx context.Context, wsID pgtype.UUID, eventType string, payload []byte) error {
	switch eventType {
	case "issues":
		return h.handleGitHubIssueEvent(ctx, wsID, payload)
	case "pull_request":
		return h.handleGitHubPullRequestEvent(ctx, wsID, payload)
	case "workflow_run":
		return h.handleGitHubWorkflowRunEvent(ctx, wsID, payload)
	default:
		return nil // unhandled event types are silently ignored
	}
}

// gitHubIssuePayload is the minimal shape of a GitHub issues webhook payload.
type gitHubIssuePayload struct {
	Action string `json:"action"`
	Issue  struct {
		Number  int    `json:"number"`
		Title   string `json:"title"`
		Body    string `json:"body"`
		HTMLURL string `json:"html_url"`
		State   string `json:"state"`
	} `json:"issue"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

func (h *Handler) handleGitHubIssueEvent(ctx context.Context, wsID pgtype.UUID, payload []byte) error {
	var ev gitHubIssuePayload
	if err := json.Unmarshal(payload, &ev); err != nil {
		return fmt.Errorf("parse issues payload: %w", err)
	}

	repo := ev.Repository.FullName
	extID := fmt.Sprintf("%d", ev.Issue.Number)

	switch ev.Action {
	case "opened":
		// Create issue if not already present (import may have done it already).
		_, lookupErr := h.Queries.GetIssueByIntegration(ctx, wsID, "github", repo, extID)
		if lookupErr == nil {
			return nil // already exists
		}
		if !errors.Is(lookupErr, pgx.ErrNoRows) {
			return lookupErr
		}

		ws, err := h.Queries.GetWorkspace(ctx, wsID)
		if err != nil {
			return fmt.Errorf("get workspace: %w", err)
		}
		conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "github")
		if err != nil {
			return fmt.Errorf("get github connection: %w", err)
		}

		issue, err := h.Queries.CreateIntegrationIssue(ctx, db.CreateIntegrationIssueParams{
			WorkspaceID:            wsID,
			Title:                  ev.Issue.Title,
			Description:            pgtype.Text{String: ev.Issue.Body, Valid: ev.Issue.Body != ""},
			Status:                 "todo",
			Priority:               "medium",
			CreatorType:            "system",
			CreatorID:              conn.ConnectedBy,
			IntegrationProvider:    "github",
			IntegrationExternalID:  extID,
			IntegrationExternalURL: ev.Issue.HTMLURL,
			IntegrationRepo:        repo,
		})
		if err != nil {
			return fmt.Errorf("create issue: %w", err)
		}
		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueCreated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(issue, ws.IssuePrefix),
		})

	case "edited":
		existing, err := h.Queries.GetIssueByIntegration(ctx, wsID, "github", repo, extID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		ws, err := h.Queries.GetWorkspace(ctx, wsID)
		if err != nil {
			return err
		}
		desc := pgtype.Text{String: ev.Issue.Body, Valid: ev.Issue.Body != ""}
		updated, err := h.Queries.UpdateIssue(ctx, db.UpdateIssueParams{
			ID:          existing.ID,
			Title:       pgtype.Text{String: ev.Issue.Title, Valid: true},
			Description: desc,
		})
		if err != nil {
			return err
		}
		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueUpdated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(updated, ws.IssuePrefix),
		})

	case "closed":
		existing, err := h.Queries.GetIssueByIntegration(ctx, wsID, "github", repo, extID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		ws, err := h.Queries.GetWorkspace(ctx, wsID)
		if err != nil {
			return err
		}
		updated, err := h.Queries.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
			ID:     existing.ID,
			Status: "done",
		})
		if err != nil {
			return err
		}
		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueUpdated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(updated, ws.IssuePrefix),
		})

	case "reopened":
		existing, err := h.Queries.GetIssueByIntegration(ctx, wsID, "github", repo, extID)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		ws, err := h.Queries.GetWorkspace(ctx, wsID)
		if err != nil {
			return err
		}
		updated, err := h.Queries.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
			ID:     existing.ID,
			Status: "todo",
		})
		if err != nil {
			return err
		}
		h.Bus.Publish(events.Event{
			Type:        protocol.EventIssueUpdated,
			WorkspaceID: uuidToString(wsID),
			Payload:     issueToResponse(updated, ws.IssuePrefix),
		})
	}
	return nil
}

type gitHubPRPayload struct {
	Action      string `json:"action"`
	PullRequest struct {
		Number  int    `json:"number"`
		Title   string `json:"title"`
		HTMLURL string `json:"html_url"`
		Merged  bool   `json:"merged"`
		Body    string `json:"body"`
	} `json:"pull_request"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

func (h *Handler) handleGitHubPullRequestEvent(ctx context.Context, wsID pgtype.UUID, payload []byte) error {
	var ev gitHubPRPayload
	if err := json.Unmarshal(payload, &ev); err != nil {
		return fmt.Errorf("parse pull_request payload: %w", err)
	}
	// Only act on merged PRs for now — post a comment on any linked issue.
	if ev.Action != "closed" || !ev.PullRequest.Merged {
		return nil
	}
	slog.Info("github PR merged",
		"workspace", uuidToString(wsID),
		"repo", ev.Repository.FullName,
		"pr", ev.PullRequest.Number,
		"url", ev.PullRequest.HTMLURL,
	)
	return nil
}

type gitHubWorkflowRunPayload struct {
	Action      string `json:"action"`
	WorkflowRun struct {
		Name       string `json:"name"`
		Status     string `json:"status"`
		Conclusion string `json:"conclusion"`
		HTMLURL    string `json:"html_url"`
	} `json:"workflow_run"`
	Repository struct {
		FullName string `json:"full_name"`
	} `json:"repository"`
}

func (h *Handler) handleGitHubWorkflowRunEvent(ctx context.Context, wsID pgtype.UUID, payload []byte) error {
	var ev gitHubWorkflowRunPayload
	if err := json.Unmarshal(payload, &ev); err != nil {
		return fmt.Errorf("parse workflow_run payload: %w", err)
	}
	if ev.Action != "completed" {
		return nil
	}
	slog.Info("github workflow run completed",
		"workspace", uuidToString(wsID),
		"repo", ev.Repository.FullName,
		"workflow", ev.WorkflowRun.Name,
		"conclusion", ev.WorkflowRun.Conclusion,
	)
	return nil
}
