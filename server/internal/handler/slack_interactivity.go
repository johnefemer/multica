package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// Slack interactivity: modal submissions and issue-card button presses.
//
// Two different response contracts live here. A view_submission must answer
// synchronously with a response_action body, so those handlers return a map.
// A block_action was already acked by the webhook, so those handlers report
// back through chat.postEphemeral and return only an error for logging.

// handleSlackBlockActions routes a block_actions payload. The agent picker
// keeps its dedicated handler; everything else is an issue-card button.
func (h *Handler) handleSlackBlockActions(ctx context.Context, payload SlackInteractivityPayload) error {
	if len(payload.Actions) == 0 {
		return nil
	}
	switch payload.Actions[0].ActionID {
	case slackPickerActionID:
		return h.HandleSlackPickerSelection(ctx, payload)
	case slackActionAssignToMe, slackActionMarkDone, slackActionDispatch:
		return h.handleSlackIssueCardAction(ctx, payload)
	default:
		slog.Debug("slack block action ignored", "action_id", payload.Actions[0].ActionID)
		return nil
	}
}

// handleSlackIssueCardAction applies an issue-card button press. The button
// value carries the issue identifier, so no server-side state is needed
// between rendering the card and handling the click.
func (h *Handler) handleSlackIssueCardAction(ctx context.Context, payload SlackInteractivityPayload) error {
	action := payload.Actions[0]
	channelID := payload.ChannelID()

	scope, errResp := h.resolveSlackCommandScope(ctx, slackCommandRequest{
		TeamID:      payload.Team.ID,
		ChannelID:   channelID,
		SlackUserID: payload.User.ID,
	})
	if errResp != nil {
		return h.postSlackActionError(ctx, payload.Team.ID, channelID, payload.User.ID, errResp)
	}

	issue, resp := h.slackResolveIssueArg(ctx, scope, action.Value, "an issue card button")
	if resp != nil {
		return h.postSlackEphemeralResponse(ctx, scope.Connection.AccessToken, channelID, payload.User.ID, resp)
	}

	switch action.ActionID {
	case slackActionAssignToMe:
		resp = h.slackApplyAssignee(ctx, scope, issue, "member", scope.User.ID,
			fmt.Sprintf("Assigned to *%s*", slackEscape(scope.User.Name)))
	case slackActionMarkDone:
		resp = h.slackApplyStatus(ctx, scope, issue, "done")
	case slackActionDispatch:
		resp = h.slackDispatchFromCard(ctx, payload, scope, issue)
	}
	if resp == nil {
		return nil
	}
	return h.postSlackEphemeralResponse(ctx, scope.Connection.AccessToken, channelID, payload.User.ID, resp)
}

// slackDispatchFromCard handles the "Dispatch to agent" button. With a single
// candidate it dispatches immediately; otherwise it opens the picker modal,
// which is why it needs the payload's trigger_id.
func (h *Handler) slackDispatchFromCard(
	ctx context.Context, payload SlackInteractivityPayload, scope slackCommandScope, issue db.Issue,
) map[string]any {
	dispatchable, err := h.slackDispatchableAgents(ctx, scope)
	if err != nil {
		return slackEphemeral("Couldn't load agents for this workspace.")
	}
	switch len(dispatchable) {
	case 0:
		return slackEphemeral("There are no agents you can dispatch to here.")
	case 1:
		return h.slackDoDispatch(ctx, scope, issue, dispatchable[0])
	}
	if payload.TriggerID == "" {
		return slackEphemeral("Use `/agenthost dispatch " +
			h.slackIssueIdentifier(scope.Workspace, issue) + " <agent>` to pick an agent.")
	}
	view := slackDispatchModal(
		uuidToString(scope.Workspace.ID), payload.ChannelID(), uuidToString(issue.ID),
		h.slackIssueIdentifier(scope.Workspace, issue), dispatchable,
	)
	if err := slackprovider.OpenModal(ctx, scope.Connection.AccessToken, payload.TriggerID, view); err != nil {
		slog.Error("slack card dispatch: views.open failed", "error", err)
		return slackEphemeral("Couldn't open the agent picker: " + err.Error())
	}
	return nil
}

// ── modal submissions ────────────────────────────────────────────────────────

// handleSlackViewSubmission routes a modal submission by callback_id. A nil
// return means "no response body", which Slack treats as closing the modal.
func (h *Handler) handleSlackViewSubmission(
	ctx context.Context, payload SlackInteractivityPayload,
) map[string]any {
	meta := decodeSlackModalMetadata(payload.View.PrivateMetadata)

	scope, errMsg := h.resolveSlackModalScope(ctx, payload, meta)
	if errMsg != "" {
		return slackErrorResponse(slackBlockTitle, errMsg)
	}

	switch payload.View.CallbackID {
	case slackModalNewIssue:
		return h.slackSubmitNewIssue(ctx, payload, scope, meta)
	case slackModalDispatch:
		return h.slackSubmitDispatch(ctx, payload, scope, meta)
	default:
		slog.Debug("slack view_submission ignored", "callback_id", payload.View.CallbackID)
		return nil
	}
}

// resolveSlackModalScope rebuilds the command scope from the modal's private
// metadata. The workspace comes from metadata rather than a channel lookup so
// a modal still submits correctly if the channel was unbound while it was open.
func (h *Handler) resolveSlackModalScope(
	ctx context.Context, payload SlackInteractivityPayload, meta slackModalMetadata,
) (slackCommandScope, string) {
	wsID := parseUUID(meta.WorkspaceID)
	if !wsID.Valid {
		return slackCommandScope{}, "This form has expired. Run the command again."
	}
	ws, err := h.Queries.GetWorkspace(ctx, wsID)
	if err != nil {
		return slackCommandScope{}, "That workspace no longer exists."
	}
	conn, err := h.Queries.GetIntegrationConnection(ctx, ws.ID, "slack")
	if err != nil {
		return slackCommandScope{}, "Slack isn't connected for this workspace any more."
	}
	user, err := h.ResolveSlackUser(ctx, ws, payload.Team.ID, payload.User.ID, conn.AccessToken)
	if err != nil {
		return slackCommandScope{}, "Couldn't match your Slack account to an Agenthost user."
	}

	scope := slackCommandScope{Workspace: ws, Connection: conn, User: user}
	// The binding is optional here — only the default-agent lookup uses it.
	if binding, err := h.Queries.GetChatChannelBindingByChannel(ctx, db.GetChatChannelBindingByChannelParams{
		Platform:          "slack",
		ExternalChannelID: meta.ChannelID,
	}); err == nil {
		scope.Binding = binding
	} else if !errors.Is(err, pgx.ErrNoRows) {
		slog.Warn("slack modal: binding lookup failed", "channel_id", meta.ChannelID, "error", err)
	}
	return scope, ""
}

// slackSubmitNewIssue creates the issue described by the modal, then posts the
// resulting card into the originating channel so the whole team sees it.
func (h *Handler) slackSubmitNewIssue(
	ctx context.Context, payload SlackInteractivityPayload, scope slackCommandScope, meta slackModalMetadata,
) map[string]any {
	state := payload.View.State.Values
	title := strings.TrimSpace(state.field(slackBlockTitle))
	if title == "" {
		return slackErrorResponse(slackBlockTitle, "Give the issue a title.")
	}

	priority := state.field(slackBlockPriority)
	if priority == "" {
		priority = "none"
	}

	issue, err := h.createIssueFromSlack(ctx, scope, slackNewIssueInput{
		Title:       title,
		Description: state.field(slackBlockDescription),
		Priority:    priority,
		ProjectID:   parseUUID(state.field(slackBlockProject)),
		AssigneeID:  parseUUID(state.field(slackBlockAssignee)),
	})
	if err != nil {
		slog.Error("slack modal: create issue failed",
			"workspace_id", uuidToString(scope.Workspace.ID), "error", err)
		return slackErrorResponse(slackBlockTitle, "Couldn't create the issue: "+err.Error())
	}

	// Posting is best-effort: the issue exists either way, so a failed post
	// must not surface as a modal validation error.
	go func(channelID string, issueID pgtype.UUID) {
		bgCtx, cancel := detachedSlackContext()
		defer cancel()
		created, err := h.Queries.GetIssue(bgCtx, issueID)
		if err != nil {
			return
		}
		view := h.slackIssueViewOf(bgCtx, scope.Workspace, created)
		headline := fmt.Sprintf("New issue from <@%s>", payload.User.ID)
		if _, err := slackprovider.PostMessage(bgCtx, scope.Connection.AccessToken, channelID,
			slackIssueFallbackText(view, "New issue"),
			&slackprovider.PostMessageOptions{Blocks: slackIssueCardBlocks(view, headline, true)},
		); err != nil {
			slog.Warn("slack modal: issue card post failed", "channel_id", channelID, "error", err)
		}
	}(meta.ChannelID, issue.ID)

	return slackClearResponse()
}

// slackSubmitDispatch applies the agent chosen in the dispatch modal.
func (h *Handler) slackSubmitDispatch(
	ctx context.Context, payload SlackInteractivityPayload, scope slackCommandScope, meta slackModalMetadata,
) map[string]any {
	agentID := parseUUID(payload.View.State.Values.field(slackBlockAgent))
	if !agentID.Valid {
		return slackErrorResponse(slackBlockAgent, "Pick an agent.")
	}
	issueID := parseUUID(meta.IssueID)
	if !issueID.Valid {
		return slackErrorResponse(slackBlockAgent, "This form has expired. Run the command again.")
	}

	issue, err := h.Queries.GetIssueInWorkspace(ctx, db.GetIssueInWorkspaceParams{
		ID:          issueID,
		WorkspaceID: scope.Workspace.ID,
	})
	if err != nil {
		return slackErrorResponse(slackBlockAgent, "That issue no longer exists.")
	}

	// Re-check permission at submit time: the modal may have sat open while
	// the agent's visibility or ownership changed.
	dispatchable, err := h.slackDispatchableAgents(ctx, scope)
	if err != nil {
		return slackErrorResponse(slackBlockAgent, "Couldn't load agents.")
	}
	var agent db.Agent
	found := false
	for _, a := range dispatchable {
		if uuidToString(a.ID) == uuidToString(agentID) {
			agent, found = a, true
			break
		}
	}
	if !found {
		return slackErrorResponse(slackBlockAgent, "You can't dispatch to that agent any more.")
	}

	resp := h.slackDoDispatch(ctx, scope, issue, agent)
	go func(channelID string) {
		bgCtx, cancel := detachedSlackContext()
		defer cancel()
		if err := h.postSlackEphemeralResponse(bgCtx, scope.Connection.AccessToken,
			channelID, payload.User.ID, resp); err != nil {
			slog.Warn("slack modal: dispatch confirmation failed", "error", err)
		}
	}(meta.ChannelID)

	return slackClearResponse()
}

// ── shared write paths ───────────────────────────────────────────────────────

type slackNewIssueInput struct {
	Title       string
	Description string
	Priority    string
	ProjectID   pgtype.UUID
	AssigneeID  pgtype.UUID // member; invalid when unassigned
}

// createIssueFromSlack mirrors the HTTP CreateIssue path: the issue number
// comes from the workspace counter inside a transaction, the created event is
// published so the web UI updates live, and an agent assignee gets queued.
func (h *Handler) createIssueFromSlack(
	ctx context.Context, scope slackCommandScope, in slackNewIssueInput,
) (db.Issue, error) {
	tx, err := h.TxStarter.Begin(ctx)
	if err != nil {
		return db.Issue{}, fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	qtx := h.Queries.WithTx(tx)
	number, err := qtx.IncrementIssueCounter(ctx, scope.Workspace.ID)
	if err != nil {
		return db.Issue{}, fmt.Errorf("allocate issue number: %w", err)
	}

	var assigneeType pgtype.Text
	if in.AssigneeID.Valid {
		assigneeType = pgtype.Text{String: "member", Valid: true}
	}

	issue, err := qtx.CreateIssue(ctx, db.CreateIssueParams{
		WorkspaceID:  scope.Workspace.ID,
		Title:        in.Title,
		Description:  pgtype.Text{String: in.Description, Valid: in.Description != ""},
		Status:       "todo",
		Priority:     in.Priority,
		AssigneeType: assigneeType,
		AssigneeID:   in.AssigneeID,
		CreatorType:  "member",
		CreatorID:    scope.User.ID,
		Position:     0,
		Number:       number,
		ProjectID:    in.ProjectID,
	})
	if err != nil {
		return db.Issue{}, fmt.Errorf("create issue: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return db.Issue{}, fmt.Errorf("commit: %w", err)
	}

	h.publishSlackIssueEvent(protocol.EventIssueCreated, scope, issue)
	return issue, nil
}

// slackApplyAssignee sets an assignee and returns the confirmation body.
func (h *Handler) slackApplyAssignee(
	ctx context.Context, scope slackCommandScope, issue db.Issue,
	assigneeType string, assigneeID pgtype.UUID, headline string,
) map[string]any {
	updated, err := h.Queries.UpdateIssue(ctx, db.UpdateIssueParams{
		ID:            issue.ID,
		AssigneeType:  pgtype.Text{String: assigneeType, Valid: true},
		AssigneeID:    assigneeID,
		Position:      pgtype.Float8{Float64: issue.Position, Valid: true},
		DueDate:       issue.DueDate,
		ParentIssueID: issue.ParentIssueID,
		ProjectID:     issue.ProjectID,
	})
	if err != nil {
		slog.Error("slack: assign failed", "issue_id", uuidToString(issue.ID), "error", err)
		return slackEphemeral("Couldn't update the assignee.")
	}
	h.publishSlackIssueEvent(protocol.EventIssueUpdated, scope, updated)
	view := h.slackIssueViewOf(ctx, scope.Workspace, updated)
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, "Assigned"),
		slackIssueCardBlocks(view, headline, false),
	)
}

// slackApplyStatus sets a status and returns the confirmation body.
func (h *Handler) slackApplyStatus(
	ctx context.Context, scope slackCommandScope, issue db.Issue, status string,
) map[string]any {
	if issue.Status == status {
		return slackEphemeral(fmt.Sprintf("%s is already *%s*.",
			h.slackIssueIdentifier(scope.Workspace, issue), slackIssueStatusLabel(status)))
	}
	previous := issue.Status
	updated, err := h.Queries.UpdateIssueStatus(ctx, db.UpdateIssueStatusParams{
		ID:     issue.ID,
		Status: status,
	})
	if err != nil {
		slog.Error("slack: status update failed", "issue_id", uuidToString(issue.ID), "error", err)
		return slackEphemeral("Couldn't update the status.")
	}
	h.publishSlackIssueEvent(protocol.EventIssueUpdated, scope, updated)
	view := h.slackIssueViewOf(ctx, scope.Workspace, updated)
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, "Status changed"),
		slackIssueCardBlocks(view, fmt.Sprintf("Status: *%s* → *%s*",
			slackIssueStatusLabel(previous), slackIssueStatusLabel(status)), false),
	)
}

// ── reply plumbing ───────────────────────────────────────────────────────────

// postSlackEphemeralResponse delivers a command-shaped response map through
// chat.postEphemeral, which is how a background block_action handler talks
// back to the person who clicked.
func (h *Handler) postSlackEphemeralResponse(
	ctx context.Context, token, channelID, slackUserID string, resp map[string]any,
) error {
	if resp == nil {
		return nil
	}
	text, _ := resp["text"].(string)
	blocks, _ := resp["blocks"].([]map[string]any)
	if text == "" && len(blocks) == 0 {
		return nil
	}
	return slackprovider.PostEphemeral(ctx, token, channelID, slackUserID, text, blocks)
}

// postSlackActionError reports a failure that happened before scope
// resolution produced a bot token. It recovers one from the Slack team id;
// if even that fails there is no way to reach the user, so the message is
// logged and dropped rather than retried into a void.
func (h *Handler) postSlackActionError(
	ctx context.Context, teamID, channelID, slackUserID string, resp map[string]any,
) error {
	conn, _, err := h.lookupSlackTeamConnection(ctx, teamID)
	if err != nil {
		text, _ := resp["text"].(string)
		slog.Warn("slack action: no token to report error with",
			"team_id", teamID, "channel_id", channelID,
			"slack_user_id", slackUserID, "message", text)
		return nil
	}
	return h.postSlackEphemeralResponse(ctx, conn.AccessToken, channelID, slackUserID, resp)
}

// detachedSlackContext returns a background context for work that outlives the
// HTTP request, such as posting a confirmation after a modal has been closed.
func detachedSlackContext() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), 30*time.Second)
}
