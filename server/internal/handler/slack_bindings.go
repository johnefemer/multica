package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// ChatChannelBindingResponse is the public shape of a chat_channel_binding row.
type ChatChannelBindingResponse struct {
	ID                  string  `json:"id"`
	WorkspaceID         string  `json:"workspace_id"`
	Platform            string  `json:"platform"`
	ExternalTeamID      string  `json:"external_team_id"`
	ExternalChannelID   string  `json:"external_channel_id"`
	ExternalChannelName *string `json:"external_channel_name"`
	CreatedAt           string  `json:"created_at"`
	CreatedBy           *string `json:"created_by,omitempty"`
}

func bindingToResponse(b db.ChatChannelBinding) ChatChannelBindingResponse {
	resp := ChatChannelBindingResponse{
		ID:                  uuidToString(b.ID),
		WorkspaceID:         uuidToString(b.WorkspaceID),
		Platform:            b.Platform,
		ExternalTeamID:      b.ExternalTeamID,
		ExternalChannelID:   b.ExternalChannelID,
		ExternalChannelName: textToPtr(b.ExternalChannelName),
		CreatedAt:           timestampToString(b.CreatedAt),
	}
	if b.CreatedBy.Valid {
		s := uuidToString(b.CreatedBy)
		resp.CreatedBy = &s
	}
	return resp
}

// ListSlackChannels proxies Slack's conversations.list using the workspace's
// connected bot token. Used to populate the binding picker.
//
// GET /api/workspaces/{id}/integrations/slack/channels
func (h *Handler) ListSlackChannels(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "slack")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusNotFound, "Slack not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	channels, err := slackprovider.ListChannels(ctx, conn.AccessToken)
	if err != nil {
		writeError(w, http.StatusBadGateway, "failed to list Slack channels: "+err.Error())
		return
	}
	writeJSON(w, http.StatusOK, channels)
}

// ListChatChannelBindings returns all chat-channel bindings for a workspace.
//
// GET /api/workspaces/{id}/integrations/slack/bindings
func (h *Handler) ListChatChannelBindings(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	rows, err := h.Queries.ListChatChannelBindings(ctx, db.ListChatChannelBindingsParams{
		WorkspaceID: wsID,
		Platform:    "slack",
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list bindings")
		return
	}
	resp := make([]ChatChannelBindingResponse, len(rows))
	for i, b := range rows {
		resp[i] = bindingToResponse(b)
	}
	writeJSON(w, http.StatusOK, resp)
}

// CreateChatChannelBindingRequest is the body for POST /bindings.
type CreateChatChannelBindingRequest struct {
	ExternalChannelID   string `json:"external_channel_id"`
	ExternalChannelName string `json:"external_channel_name"`
}

// CreateChatChannelBinding binds a Slack channel to the workspace. The Slack
// team ID is read from the existing integration connection so the caller
// doesn't have to supply it.
//
// POST /api/workspaces/{id}/integrations/slack/bindings
func (h *Handler) CreateChatChannelBinding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	if !wsID.Valid {
		writeError(w, http.StatusBadRequest, "invalid workspace id")
		return
	}

	var req CreateChatChannelBindingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ExternalChannelID == "" {
		writeError(w, http.StatusBadRequest, "external_channel_id is required")
		return
	}

	// Look up the Slack connection to get the team ID.
	conn, err := h.Queries.GetIntegrationConnection(ctx, wsID, "slack")
	if errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusBadRequest, "Slack not connected")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	// Reject if the channel is already bound (anywhere). The UNIQUE index
	// would catch this too, but a clearer error helps the UI.
	existing, err := h.Queries.GetChatChannelBindingByChannel(ctx, db.GetChatChannelBindingByChannelParams{
		Platform:          "slack",
		ExternalChannelID: req.ExternalChannelID,
	})
	if err == nil {
		if uuidToString(existing.WorkspaceID) == uuidToString(wsID) {
			writeError(w, http.StatusConflict, "channel is already bound to this workspace")
		} else {
			writeError(w, http.StatusConflict, "channel is already bound to another workspace")
		}
		return
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		writeError(w, http.StatusInternalServerError, "db error")
		return
	}

	userID, ok := requireUserID(w, r)
	if !ok {
		return
	}

	binding, err := h.Queries.CreateChatChannelBinding(ctx, db.CreateChatChannelBindingParams{
		WorkspaceID:         wsID,
		Platform:            "slack",
		ExternalTeamID:      conn.ProviderAccountID,
		ExternalChannelID:   req.ExternalChannelID,
		ExternalChannelName: pgtype.Text{String: req.ExternalChannelName, Valid: req.ExternalChannelName != ""},
		CreatedBy:           parseUUID(userID),
	})
	if err != nil {
		slog.Error("failed to create chat channel binding", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to create binding")
		return
	}

	// Post a greeting in the bound channel. Best-effort — a posting failure
	// (bot not in channel, missing scope) shouldn't roll back the binding;
	// the user can still re-bind after fixing the cause. We log loudly so
	// the symptom is debuggable.
	go func(token, channelID, channelName string) {
		// Detached ctx — request ctx will be canceled by the time this runs.
		bgCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		text := slackGreetingText(channelName)
		if _, err := slackprovider.PostMessage(bgCtx, token, channelID, text, nil); err != nil {
			slog.Warn("slack greeting post failed",
				"channel_id", channelID,
				"workspace_id", uuidToString(wsID),
				"error", err,
			)
		}
	}(conn.AccessToken, req.ExternalChannelID, req.ExternalChannelName)

	writeJSON(w, http.StatusCreated, bindingToResponse(binding))
}

// slackGreetingText returns the introductory message posted to a channel
// the moment it's bound. Kept honest about the current capability surface —
// don't promise mention/command handling that Phases 4/5 haven't shipped.
func slackGreetingText(channelName string) string {
	prefix := "👋 Hi from Agenthost!"
	if channelName != "" {
		prefix = "👋 Hi from Agenthost — #" + channelName + " is now bound."
	}
	return prefix + "\n\n" +
		"This channel is connected to an Agenthost workspace. " +
		"Channel notifications, `@agenthost` mentions, and `/agenthost` commands are rolling out in upcoming phases."
}

// DeleteChatChannelBinding removes a binding. The DELETE is scoped by
// workspace ID so a stale binding URL from another workspace can't escape.
//
// DELETE /api/workspaces/{id}/integrations/slack/bindings/{bindingId}
func (h *Handler) DeleteChatChannelBinding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	bindingID := parseUUID(chi.URLParam(r, "bindingId"))
	if !wsID.Valid || !bindingID.Valid {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	if err := h.Queries.DeleteChatChannelBinding(ctx, db.DeleteChatChannelBindingParams{
		ID:          bindingID,
		WorkspaceID: wsID,
	}); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete binding")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
