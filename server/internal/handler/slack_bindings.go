package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// SlackNotifyEventTypes is the set of workspace events a bound channel can
// subscribe to. It is the contract shared by three places: the settings UI
// renders one checkbox per entry, this handler validates writes against it,
// and the outbound listener in cmd/server subscribes to exactly these.
var SlackNotifyEventTypes = []string{
	protocol.EventIssueCreated,
	protocol.EventIssueUpdated,
	protocol.EventTaskCompleted,
	protocol.EventTaskFailed,
}

func isSlackNotifyEventType(s string) bool {
	for _, e := range SlackNotifyEventTypes {
		if e == s {
			return true
		}
	}
	return false
}

// ChatChannelBindingResponse is the public shape of a chat_channel_binding row.
type ChatChannelBindingResponse struct {
	ID                  string   `json:"id"`
	WorkspaceID         string   `json:"workspace_id"`
	Platform            string   `json:"platform"`
	ExternalTeamID      string   `json:"external_team_id"`
	ExternalChannelID   string   `json:"external_channel_id"`
	ExternalChannelName *string  `json:"external_channel_name"`
	EventFilters        []string `json:"event_filters"`
	DefaultAgentID      *string  `json:"default_agent_id"`
	CreatedAt           string   `json:"created_at"`
	CreatedBy           *string  `json:"created_by,omitempty"`
}

func bindingToResponse(b db.ChatChannelBinding) ChatChannelBindingResponse {
	// Normalize NULL/absent arrays to [] so the client never has to null-check
	// before mapping over the filters.
	filters := b.EventFilters
	if filters == nil {
		filters = []string{}
	}
	resp := ChatChannelBindingResponse{
		ID:                  uuidToString(b.ID),
		WorkspaceID:         uuidToString(b.WorkspaceID),
		Platform:            b.Platform,
		ExternalTeamID:      b.ExternalTeamID,
		ExternalChannelID:   b.ExternalChannelID,
		ExternalChannelName: textToPtr(b.ExternalChannelName),
		EventFilters:        filters,
		CreatedAt:           timestampToString(b.CreatedAt),
	}
	if b.DefaultAgentID.Valid {
		s := uuidToString(b.DefaultAgentID)
		resp.DefaultAgentID = &s
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

	// Make the bot a member before writing the row. A binding on a channel the
	// bot isn't in is inert: app_mention never fires and chat.postMessage
	// returns not_in_channel. Public channels are self-joinable; private ones
	// need a human to run /invite.
	info, err := slackprovider.EnsureBotInChannel(ctx, conn.AccessToken, req.ExternalChannelID)
	if err != nil {
		channelLabel := req.ExternalChannelName
		if channelLabel == "" {
			channelLabel = req.ExternalChannelID
		}
		switch {
		case errors.Is(err, slackprovider.ErrPrivateChannelNeedsInvite):
			writeError(w, http.StatusConflict, fmt.Sprintf(
				"#%s is private, so the bot can't add itself. Run `/invite @agenthost` in the channel, then bind it here.",
				channelLabel))
		case errors.Is(err, slackprovider.ErrJoinScopeMissing):
			writeError(w, http.StatusConflict,
				"This Slack connection predates the channels:join scope. Disconnect and reconnect Slack, then bind the channel again.")
		case errors.Is(err, slackprovider.ErrChannelNotFound):
			writeError(w, http.StatusNotFound, "That Slack channel no longer exists or is archived.")
		default:
			slog.Error("slack: failed to ensure bot membership",
				"channel_id", req.ExternalChannelID, "workspace_id", uuidToString(wsID), "error", err)
			writeError(w, http.StatusBadGateway, "failed to add the bot to that channel: "+err.Error())
		}
		return
	}

	// Prefer the name Slack just gave us over whatever the client sent — the
	// channel may have been renamed since the picker list was cached.
	channelName := req.ExternalChannelName
	if info != nil && info.Name != "" {
		channelName = info.Name
	}

	binding, err := h.Queries.CreateChatChannelBinding(ctx, db.CreateChatChannelBindingParams{
		WorkspaceID:         wsID,
		Platform:            "slack",
		ExternalTeamID:      conn.ProviderAccountID,
		ExternalChannelID:   req.ExternalChannelID,
		ExternalChannelName: pgtype.Text{String: channelName, Valid: channelName != ""},
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
	}(conn.AccessToken, req.ExternalChannelID, channelName)

	writeJSON(w, http.StatusCreated, bindingToResponse(binding))
}

// slackGreetingText returns the introductory message posted to a channel the
// moment it's bound. Keep this in step with what actually works — a greeting
// that promises unshipped behavior is worse than no greeting.
func slackGreetingText(channelName string) string {
	prefix := "👋 Hi from Agenthost!"
	if channelName != "" {
		prefix = "👋 Hi from Agenthost. #" + channelName + " is now bound."
	}
	return prefix + "\n\n" +
		"Mention `@agenthost <your message>` to start a chat thread with an agent, " +
		"or run `/agenthost help` to see what I can do."
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

// UpdateChatChannelBindingRequest is the body for PATCH /bindings/{bindingId}.
// Both fields are pointers so an absent key means "leave unchanged" while an
// explicit null (default_agent_id) or empty array (event_filters) clears it.
type UpdateChatChannelBindingRequest struct {
	EventFilters   *[]string `json:"event_filters"`
	DefaultAgentID *string   `json:"default_agent_id"`
}

// UpdateChatChannelBinding changes which events post into a bound channel and
// which agent new threads there default to.
//
// PATCH /api/workspaces/{id}/integrations/slack/bindings/{bindingId}
func (h *Handler) UpdateChatChannelBinding(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	wsID := parseUUID(chi.URLParam(r, "id"))
	bindingID := parseUUID(chi.URLParam(r, "bindingId"))
	if !wsID.Valid || !bindingID.Valid {
		writeError(w, http.StatusBadRequest, "invalid id")
		return
	}

	var req UpdateChatChannelBindingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.EventFilters == nil && req.DefaultAgentID == nil {
		writeError(w, http.StatusBadRequest, "nothing to update")
		return
	}

	binding := db.ChatChannelBinding{}
	updated := false

	if req.EventFilters != nil {
		// Reject unknown event types rather than storing them: the outbound
		// listener only subscribes to the known set, so anything else would sit
		// in the array looking enabled while never firing.
		filters := make([]string, 0, len(*req.EventFilters))
		seen := make(map[string]bool, len(*req.EventFilters))
		for _, f := range *req.EventFilters {
			if !isSlackNotifyEventType(f) {
				writeError(w, http.StatusBadRequest, "unknown event type: "+f)
				return
			}
			if seen[f] {
				continue
			}
			seen[f] = true
			filters = append(filters, f)
		}
		b, err := h.Queries.UpdateChatChannelBindingFilters(ctx, db.UpdateChatChannelBindingFiltersParams{
			EventFilters: filters,
			ID:           bindingID,
			WorkspaceID:  wsID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "binding not found")
			return
		}
		if err != nil {
			slog.Error("failed to update binding filters", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to update binding")
			return
		}
		binding, updated = b, true
	}

	if req.DefaultAgentID != nil {
		var agentID pgtype.UUID
		if *req.DefaultAgentID != "" {
			agentID = parseUUID(*req.DefaultAgentID)
			if !agentID.Valid {
				writeError(w, http.StatusBadRequest, "invalid default_agent_id")
				return
			}
			// Confirm the agent belongs to this workspace before pointing the
			// binding at it; the FK alone would allow a cross-workspace id.
			if _, err := h.Queries.GetAgentInWorkspace(ctx, db.GetAgentInWorkspaceParams{
				ID:          agentID,
				WorkspaceID: wsID,
			}); err != nil {
				writeError(w, http.StatusBadRequest, "agent not found in this workspace")
				return
			}
		}
		b, err := h.Queries.UpdateChatChannelBindingDefaultAgent(ctx, db.UpdateChatChannelBindingDefaultAgentParams{
			DefaultAgentID: agentID,
			ID:             bindingID,
			WorkspaceID:    wsID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			writeError(w, http.StatusNotFound, "binding not found")
			return
		}
		if err != nil {
			slog.Error("failed to update binding default agent", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to update binding")
			return
		}
		binding, updated = b, true
	}

	if !updated {
		writeError(w, http.StatusBadRequest, "nothing to update")
		return
	}
	writeJSON(w, http.StatusOK, bindingToResponse(binding))
}

// ListSlackNotifyEventTypes exposes the subscribable event types so the
// settings UI renders the same list the server validates against.
//
// GET /api/workspaces/{id}/integrations/slack/event-types
func (h *Handler) ListSlackNotifyEventTypes(w http.ResponseWriter, r *http.Request) {
	type eventTypeResponse struct {
		Value string `json:"value"`
		Label string `json:"label"`
	}
	labels := map[string]string{
		protocol.EventIssueCreated:  "Issue created",
		protocol.EventIssueUpdated:  "Issue updated",
		protocol.EventTaskCompleted: "Agent task completed",
		protocol.EventTaskFailed:    "Agent task failed",
	}
	resp := make([]eventTypeResponse, 0, len(SlackNotifyEventTypes))
	for _, e := range SlackNotifyEventTypes {
		resp = append(resp, eventTypeResponse{Value: e, Label: labels[e]})
	}
	writeJSON(w, http.StatusOK, resp)
}
