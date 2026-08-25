package handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/multica-ai/multica/server/internal/aicoach"
	"github.com/multica-ai/multica/server/internal/events"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// AI Coach connects with a pasted API key rather than an OAuth redirect, so it
// does not go through IntegrationOAuthStart. The key still lands in the same
// integration_connection row every other provider uses, which means listing,
// disconnecting and the integrations UI need no special case.

type ConnectAICoachRequest struct {
	APIKey string `json:"api_key"`
}

// ConnectAICoach validates an AI Coach API key and stores it for the workspace.
//
// PUT /api/workspaces/{id}/integrations/aicoach
//
// The key is verified against /api/v1/me before it is written. A key that is
// wrong, revoked or from the wrong environment fails here, at paste time, with
// a message the admin can act on, instead of surfacing later as an import that
// mysteriously cannot find a skill.
func (h *Handler) ConnectAICoach(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	workspaceID := chi.URLParam(r, "id")
	wsID := parseUUID(workspaceID)
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	// The key buys skills on behalf of everyone in the workspace, so attaching
	// it is an admin action, consistent with the other integrations.
	if _, ok := h.requireWorkspaceRole(w, r, workspaceID, "workspace not found", "owner", "admin"); !ok {
		return
	}

	var req ConnectAICoachRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.APIKey = strings.TrimSpace(req.APIKey)
	if req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "api_key is required")
		return
	}

	client := aicoach.New(os.Getenv("AICOACH_BASE_URL"), req.APIKey)
	account, err := client.Account(ctx)
	if err != nil {
		// The key is the user's input, so a rejection is a 400 about what they
		// pasted, not a 502 about AI Coach being broken.
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	label := account.Label()
	conn, err := h.Queries.UpsertIntegrationConnection(ctx, db.UpsertIntegrationConnectionParams{
		WorkspaceID:           wsID,
		ConnectedBy:           parseUUID(userID),
		Provider:              "aicoach",
		ProviderAccountID:     strconv.FormatInt(account.ID, 10),
		ProviderAccountName:   strToText(label),
		ProviderAccountAvatar: ptrToText(emptyToNil(account.AvatarURL)),
		AccessToken:           req.APIKey,
		Meta:                  []byte("{}"),
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to save the AI Coach connection")
		return
	}

	h.Bus.Publish(events.Event{
		Type:        protocol.EventIntegrationConnected,
		WorkspaceID: workspaceID,
		Payload:     map[string]string{"provider": "aicoach"},
	})
	writeJSON(w, http.StatusOK, connectionToResponse(conn))
}

func emptyToNil(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

// aicoachKeyForWorkspace returns the workspace's AI Coach key, or "" when none
// is connected. An empty key is not an error: curated skills are public and
// import without one, and only user-published skills need a credential.
func (h *Handler) aicoachKeyForWorkspace(ctx context.Context, workspaceID string) string {
	wsID := parseUUID(workspaceID)
	if !wsID.Valid {
		return ""
	}
	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "aicoach")
	if err != nil {
		if !errors.Is(err, pgx.ErrNoRows) {
			// Worth knowing about, but not worth failing an import that may
			// not need a key at all.
			return ""
		}
		return ""
	}
	if conn.Status != "active" {
		return ""
	}
	return conn.AccessToken
}

// AICoachKeyResolver builds the per-workspace key lookup the sync worker needs.
// It takes a querier rather than the handler so the background worker can use
// it without a request in hand.
func AICoachKeyResolver(q *db.Queries) func(context.Context, string) string {
	return func(ctx context.Context, workspaceID string) string {
		wsID := parseUUID(workspaceID)
		if !wsID.Valid {
			return ""
		}
		conn, err := q.GetIntegrationConnection(ctx, wsID, "aicoach")
		if err != nil || conn.Status != "active" {
			return ""
		}
		return conn.AccessToken
	}
}
