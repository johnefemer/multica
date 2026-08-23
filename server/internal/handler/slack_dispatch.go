package handler

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/messaging"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// Agent dispatch and listing from Slack.
//
// Agent ownership already exists in the schema as agent.owner_id plus
// agent.visibility ('workspace' | 'private'), and canAssignAgent is the rule
// the web UI enforces. Slack reuses exactly that rather than introducing a
// second ownership model: a private agent is dispatchable by its owner or a
// workspace admin/owner, a workspace-visible agent by any member.

// slackDispatchCommand hands an issue to an agent.
//
//	/agenthost dispatch ISS-12 Python-Agent
//	/agenthost dispatch ISS-12              → modal picker when several fit
func (h *Handler) slackDispatchCommand(
	ctx context.Context, req slackCommandRequest, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	issue, resp := h.slackResolveIssueArg(ctx, scope, cmd.Arg(0), "`/agenthost dispatch ISS-12 <agent>`")
	if resp != nil {
		return resp
	}

	dispatchable, err := h.slackDispatchableAgents(ctx, scope)
	if err != nil {
		slog.Error("slack dispatch: list agents failed", "error", err)
		return slackEphemeral("Couldn't load agents for this workspace.")
	}
	if len(dispatchable) == 0 {
		return slackEphemeral(
			"There are no agents you can dispatch to here. Private agents are limited to their owner " +
				"and workspace admins; ask an admin to share one or make you its owner.")
	}

	name := cmd.ArgsFrom(1)
	if name == "" {
		// No agent named. One candidate dispatches straight away, several open
		// the picker rather than guessing.
		if len(dispatchable) == 1 {
			return h.slackDoDispatch(ctx, scope, issue, dispatchable[0])
		}
		if req.TriggerID == "" {
			return slackEphemeral("Name an agent: `/agenthost dispatch " +
				h.slackIssueIdentifier(scope.Workspace, issue) + " <agent>`")
		}
		view := slackDispatchModal(
			uuidToString(scope.Workspace.ID), req.ChannelID, uuidToString(issue.ID),
			h.slackIssueIdentifier(scope.Workspace, issue), dispatchable,
		)
		if err := slackprovider.OpenModal(ctx, scope.Connection.AccessToken, req.TriggerID, view); err != nil {
			slog.Error("slack dispatch: views.open failed", "error", err)
			return slackEphemeral("Couldn't open the agent picker: " + err.Error())
		}
		return nil
	}

	agent, resp := slackMatchAgentByName(dispatchable, name)
	if resp != nil {
		return resp
	}
	return h.slackDoDispatch(ctx, scope, issue, agent)
}

// slackDoDispatch assigns the issue to the agent and enqueues the task. It is
// the single write path shared by the named-agent, single-agent, and modal
// routes so the three can't drift.
func (h *Handler) slackDoDispatch(
	ctx context.Context, scope slackCommandScope, issue db.Issue, agent db.Agent,
) map[string]any {
	if !agent.RuntimeID.Valid {
		return slackEphemeral(fmt.Sprintf(
			"*%s* has no runtime attached, so it can't pick up work yet. Configure one in Agenthost first.",
			agent.Name))
	}

	updated, err := h.Queries.UpdateIssue(ctx, db.UpdateIssueParams{
		ID:            issue.ID,
		AssigneeType:  pgtype.Text{String: "agent", Valid: true},
		AssigneeID:    agent.ID,
		Position:      pgtype.Float8{Float64: issue.Position, Valid: true},
		DueDate:       issue.DueDate,
		ParentIssueID: issue.ParentIssueID,
		ProjectID:     issue.ProjectID,
	})
	if err != nil {
		slog.Error("slack dispatch: assign failed", "issue_id", uuidToString(issue.ID), "error", err)
		return slackEphemeral("Couldn't assign the issue to that agent.")
	}

	if _, err := h.TaskService.EnqueueTaskForIssue(ctx, updated); err != nil {
		// The assignment stuck even though the queue push failed, so say so
		// rather than implying nothing happened.
		slog.Error("slack dispatch: enqueue failed", "issue_id", uuidToString(updated.ID), "error", err)
		return slackEphemeral(fmt.Sprintf(
			"Assigned %s to *%s*, but couldn't queue the task: %s",
			h.slackIssueIdentifier(scope.Workspace, updated), agent.Name, err.Error()))
	}

	h.publishSlackIssueEvent(protocol.EventIssueUpdated, scope, updated)

	view := h.slackIssueViewOf(ctx, scope.Workspace, updated)
	headline := fmt.Sprintf("Queued for *%s*. The agent picks it up on its next poll.", slackEscape(agent.Name))
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, "Dispatched"),
		slackIssueCardBlocks(view, headline, false),
	)
}

// slackAgentsCommand lists the agents visible to the caller and who owns them.
func (h *Handler) slackAgentsCommand(
	ctx context.Context, _ slackCommandRequest, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	if cmd.Sub == "request" {
		return slackEphemeral(
			"Agent ownership is managed in Agenthost under *Agents* → the agent → *Owner*. " +
				"A workspace admin can assign it to you there.")
	}

	agents, err := h.Queries.ListAgents(ctx, scope.Workspace.ID)
	if err != nil {
		return slackEphemeral("Couldn't load agents for this workspace.")
	}
	if len(agents) == 0 {
		return slackEphemeral("No agents in *" + scope.Workspace.Name + "* yet.")
	}

	isAdmin := h.slackCallerIsWorkspaceAdmin(ctx, scope)
	callerID := uuidToString(scope.User.ID)

	var lines []string
	for _, a := range agents {
		lines = append(lines, slackAgentLine(a, callerID, isAdmin))
	}
	text := "*Agents in " + scope.Workspace.Name + "*\n" + strings.Join(lines, "\n")
	if scope.Binding.DefaultAgentID.Valid {
		for _, a := range agents {
			if uuidToString(a.ID) == uuidToString(scope.Binding.DefaultAgentID) {
				text += fmt.Sprintf("\n\nThis channel defaults to *%s* for new threads.", a.Name)
				break
			}
		}
	}
	return slackEphemeral(text)
}

// slackAgentLine renders one row of the agents listing.
func slackAgentLine(a db.Agent, callerUserID string, isAdmin bool) string {
	var notes []string
	if a.Visibility == "private" {
		if uuidToString(a.OwnerID) == callerUserID {
			notes = append(notes, "private, yours")
		} else if isAdmin {
			notes = append(notes, "private, not yours (admin override)")
		} else {
			notes = append(notes, "private, not yours")
		}
	}
	if !a.RuntimeID.Valid {
		notes = append(notes, "no runtime")
	}
	line := "• *" + slackEscape(a.Name) + "*"
	if len(notes) > 0 {
		line += " — _" + strings.Join(notes, ", ") + "_"
	}
	return line
}

// slackDispatchableAgents returns the agents the caller may hand work to,
// applying the same visibility rule as canAssignAgent: workspace-visible
// agents are open to any member, private ones to their owner or an admin.
// Archived agents are dropped outright.
func (h *Handler) slackDispatchableAgents(
	ctx context.Context, scope slackCommandScope,
) ([]db.Agent, error) {
	agents, err := h.Queries.ListAgents(ctx, scope.Workspace.ID)
	if err != nil {
		return nil, err
	}
	isAdmin := h.slackCallerIsWorkspaceAdmin(ctx, scope)
	callerID := uuidToString(scope.User.ID)

	out := make([]db.Agent, 0, len(agents))
	for _, a := range agents {
		if a.ArchivedAt.Valid {
			continue
		}
		if a.Visibility == "private" && uuidToString(a.OwnerID) != callerID && !isAdmin {
			continue
		}
		out = append(out, a)
	}
	return out, nil
}

// slackCallerIsWorkspaceAdmin reports whether the Slack caller holds owner or
// admin in the workspace. A lookup failure is treated as "not admin" so a
// transient DB error can never widen access.
func (h *Handler) slackCallerIsWorkspaceAdmin(ctx context.Context, scope slackCommandScope) bool {
	member, err := h.getWorkspaceMember(ctx, uuidToString(scope.User.ID), uuidToString(scope.Workspace.ID))
	if err != nil {
		return false
	}
	return roleAllowed(member.Role, "owner", "admin")
}

// slackMatchAgentByName resolves a typed agent name against the dispatchable
// set: exact match first (case-insensitive), then unique prefix. Ambiguity is
// reported rather than resolved arbitrarily.
func slackMatchAgentByName(agents []db.Agent, name string) (db.Agent, map[string]any) {
	needle := strings.ToLower(strings.TrimSpace(name))

	for _, a := range agents {
		if strings.ToLower(a.Name) == needle {
			return a, nil
		}
	}

	var partial []db.Agent
	for _, a := range agents {
		if strings.Contains(strings.ToLower(a.Name), needle) {
			partial = append(partial, a)
		}
	}
	switch len(partial) {
	case 1:
		return partial[0], nil
	case 0:
		names := make([]string, 0, len(agents))
		for _, a := range agents {
			names = append(names, a.Name)
		}
		return db.Agent{}, slackEphemeral(fmt.Sprintf(
			"No agent called `%s`. Available: %s.", name, strings.Join(names, ", ")))
	default:
		names := make([]string, 0, len(partial))
		for _, a := range partial {
			names = append(names, a.Name)
		}
		return db.Agent{}, slackEphemeral(fmt.Sprintf(
			"`%s` matches several agents: %s. Use the full name.", name, strings.Join(names, ", ")))
	}
}
