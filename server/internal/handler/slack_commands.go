package handler

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/messaging"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// The `/agenthost` slash command surface.
//
// Every command runs inside a bound channel: the binding is what maps a Slack
// channel to an Agenthost workspace, and without it there is no workspace to
// act in. `help` is the one exception, so a confused user always gets an
// answer instead of an error.
//
// Slack gives a slash command three seconds to reply. Everything here is a
// handful of local DB round-trips plus at most one Slack API call, so the work
// happens inline and the reply is the return value. Anything slower would need
// the response_url deferred-reply path instead.

const (
	// slackModalNewIssue is the callback_id on the issue-creation modal, used
	// to route view_submission payloads back here.
	slackModalNewIssue = "agenthost_modal_issue_new"
	// slackModalDispatch is the callback_id on the agent-dispatch modal.
	slackModalDispatch = "agenthost_modal_dispatch"
)

// slackCommandRequest is the slim shape read off a slash-command POST body.
type slackCommandRequest struct {
	Command     string
	Text        string
	TeamID      string
	ChannelID   string
	ChannelName string
	SlackUserID string
	TriggerID   string
	ResponseURL string
}

// slackCommandScope is the resolved context every write command needs:
// which workspace, which bot token, and who is asking.
type slackCommandScope struct {
	Workspace  db.Workspace
	Connection db.IntegrationConnection
	Binding    db.ChatChannelBinding
	User       db.User
}

// routeSlackCommand parses and dispatches a slash command, returning the JSON
// body to write back to Slack.
func (h *Handler) routeSlackCommand(ctx context.Context, req slackCommandRequest) map[string]any {
	cmd := messaging.ParseCommand(req.Text)

	// Help needs no workspace context — answer it before resolving anything.
	if cmd.Root == "" || cmd.Root == "help" {
		return slackEphemeral(slackHelpText())
	}

	scope, errResp := h.resolveSlackCommandScope(ctx, req)
	if errResp != nil {
		return errResp
	}

	switch cmd.Root {
	case "issue", "issues":
		return h.slackIssueCommand(ctx, req, scope, cmd)
	case "chat":
		return h.slackChatCommand(ctx, req, scope, cmd)
	case "dispatch":
		return h.slackDispatchCommand(ctx, req, scope, cmd)
	case "agent", "agents":
		return h.slackAgentsCommand(ctx, req, scope, cmd)
	case "link":
		return h.slackLinkCommand(ctx, scope)
	case "whoami":
		return slackEphemeral(fmt.Sprintf(
			"You're *%s* (%s) in workspace *%s*.",
			scope.User.Name, scope.User.Email, scope.Workspace.Name))
	default:
		return slackEphemeral(fmt.Sprintf(
			"Unknown command `%s`.\n\n%s", cmd.Root, slackHelpText()))
	}
}

// resolveSlackCommandScope maps the channel to a workspace and the Slack user
// to an Agenthost user. Returns a ready-to-send error body on failure so
// callers can `return errResp` without translating anything.
func (h *Handler) resolveSlackCommandScope(
	ctx context.Context, req slackCommandRequest,
) (slackCommandScope, map[string]any) {
	binding, err := h.Queries.GetChatChannelBindingByChannel(ctx, db.GetChatChannelBindingByChannelParams{
		Platform:          "slack",
		ExternalChannelID: req.ChannelID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return slackCommandScope{}, slackEphemeral(
			"This channel isn't connected to an Agenthost workspace yet. " +
				"A workspace admin can bind it under Settings → Integrations → Slack.")
	}
	if err != nil {
		slog.Error("slack command: binding lookup failed", "channel_id", req.ChannelID, "error", err)
		return slackCommandScope{}, slackEphemeral("Something went wrong looking up this channel.")
	}

	ws, err := h.Queries.GetWorkspace(ctx, binding.WorkspaceID)
	if err != nil {
		return slackCommandScope{}, slackEphemeral("Couldn't load the workspace for this channel.")
	}
	conn, err := h.Queries.GetIntegrationConnection(ctx, ws.ID, "slack")
	if err != nil {
		return slackCommandScope{}, slackEphemeral("Slack isn't connected for this workspace any more.")
	}

	user, err := h.ResolveSlackUser(ctx, ws, req.TeamID, req.SlackUserID, conn.AccessToken)
	if err != nil {
		switch {
		case errors.Is(err, ErrSlackEmailUnavailable):
			return slackCommandScope{}, slackEphemeral(
				"I can't see your Slack profile email, so I can't tell which Agenthost account is yours. " +
					"Ask the workspace owner to grant the `users:read.email` scope.")
		case errors.Is(err, ErrAutoOnboardingDisabled):
			return slackCommandScope{}, slackEphemeral(
				"Auto-onboarding from Slack is off in this workspace. Ask an admin to add you, then try again.")
		default:
			slog.Error("slack command: identity resolution failed",
				"workspace_id", uuidToString(ws.ID), "slack_user_id", req.SlackUserID, "error", err)
			return slackCommandScope{}, slackEphemeral("Couldn't link your Slack identity to Agenthost.")
		}
	}

	return slackCommandScope{Workspace: ws, Connection: conn, Binding: binding, User: user}, nil
}

// ── issue subcommands ────────────────────────────────────────────────────────

func (h *Handler) slackIssueCommand(
	ctx context.Context, req slackCommandRequest, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	switch cmd.Sub {
	case "new", "create":
		return h.slackIssueNew(ctx, req, scope, cmd)
	case "show", "view":
		return h.slackIssueShow(ctx, scope, cmd)
	case "assign":
		return h.slackIssueAssign(ctx, scope, cmd)
	case "status":
		return h.slackIssueStatus(ctx, scope, cmd)
	case "":
		return slackEphemeral("Usage: `/agenthost issue new|show|assign|status …`\n\n" + slackHelpText())
	default:
		return slackEphemeral(fmt.Sprintf("Unknown issue subcommand `%s`.\n\n%s", cmd.Sub, slackHelpText()))
	}
}

// slackIssueNew opens the creation modal. Any text after `issue new` prefills
// the title, so `/agenthost issue new fix the login bug` skips retyping it.
func (h *Handler) slackIssueNew(
	ctx context.Context, req slackCommandRequest, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	if req.TriggerID == "" {
		return slackEphemeral("Couldn't open the form (no trigger). Try the command again.")
	}

	projects, err := h.Queries.ListProjects(ctx, db.ListProjectsParams{WorkspaceID: scope.Workspace.ID})
	if err != nil {
		slog.Warn("slack command: list projects failed", "error", err)
		projects = nil
	}
	members, err := h.Queries.ListMembersWithUser(ctx, scope.Workspace.ID)
	if err != nil {
		slog.Warn("slack command: list members failed", "error", err)
		members = nil
	}

	view := slackNewIssueModal(slackNewIssueModalArgs{
		WorkspaceID:  uuidToString(scope.Workspace.ID),
		ChannelID:    req.ChannelID,
		InitialTitle: cmd.Remainder,
		Projects:     projects,
		Members:      members,
	})

	if err := slackprovider.OpenModal(ctx, scope.Connection.AccessToken, req.TriggerID, view); err != nil {
		if errors.Is(err, slackprovider.ErrTriggerExpired) {
			return slackEphemeral("That took too long to open. Run the command again.")
		}
		slog.Error("slack command: views.open failed", "error", err)
		return slackEphemeral("Couldn't open the issue form: " + err.Error())
	}
	// Slack closes the command with an empty 200 once the modal is open.
	return nil
}

func (h *Handler) slackIssueShow(
	ctx context.Context, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	issue, resp := h.slackResolveIssueArg(ctx, scope, cmd.Arg(0), "`/agenthost issue show ISS-12`")
	if resp != nil {
		return resp
	}
	view := h.slackIssueViewOf(ctx, scope.Workspace, issue)
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, ""),
		slackIssueCardBlocks(view, "", true),
	)
}

func (h *Handler) slackIssueAssign(
	ctx context.Context, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	issue, resp := h.slackResolveIssueArg(ctx, scope, cmd.Arg(0), "`/agenthost issue assign ISS-12 @me`")
	if resp != nil {
		return resp
	}
	target := cmd.ArgsFrom(1)
	if target == "" {
		return slackEphemeral("Who should I assign it to? Try `/agenthost issue assign ISS-12 @me`.")
	}

	assignee, resp := h.slackResolveAssignee(ctx, scope, target)
	if resp != nil {
		return resp
	}

	updated, err := h.Queries.UpdateIssue(ctx, db.UpdateIssueParams{
		ID:            issue.ID,
		AssigneeType:  pgtype.Text{String: "member", Valid: true},
		AssigneeID:    assignee.ID,
		Position:      pgtype.Float8{Float64: issue.Position, Valid: true},
		DueDate:       issue.DueDate,
		ParentIssueID: issue.ParentIssueID,
		ProjectID:     issue.ProjectID,
	})
	if err != nil {
		slog.Error("slack command: assign failed", "issue_id", uuidToString(issue.ID), "error", err)
		return slackEphemeral("Couldn't update the assignee.")
	}

	h.publishSlackIssueEvent(protocol.EventIssueUpdated, scope, updated)

	view := h.slackIssueViewOf(ctx, scope.Workspace, updated)
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, "Assigned"),
		slackIssueCardBlocks(view, fmt.Sprintf("Assigned to *%s*", slackEscape(assignee.Name)), false),
	)
}

func (h *Handler) slackIssueStatus(
	ctx context.Context, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	issue, resp := h.slackResolveIssueArg(ctx, scope, cmd.Arg(0), "`/agenthost issue status ISS-12 done`")
	if resp != nil {
		return resp
	}
	raw := cmd.ArgsFrom(1)
	status, ok := normalizeIssueStatus(raw)
	if !ok {
		return slackEphemeral(fmt.Sprintf(
			"`%s` isn't a status I know. Try one of: %s.",
			raw, strings.Join(slackKnownStatuses(), ", ")))
	}
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
		slog.Error("slack command: status update failed", "issue_id", uuidToString(issue.ID), "error", err)
		return slackEphemeral("Couldn't update the status.")
	}

	h.publishSlackIssueEvent(protocol.EventIssueUpdated, scope, updated)

	view := h.slackIssueViewOf(ctx, scope.Workspace, updated)
	headline := fmt.Sprintf("Status: *%s* → *%s*",
		slackIssueStatusLabel(previous), slackIssueStatusLabel(status))
	return slackEphemeralBlocks(
		slackIssueFallbackText(view, "Status changed"),
		slackIssueCardBlocks(view, headline, false),
	)
}

// ── chat / link ──────────────────────────────────────────────────────────────

// slackChatCommand starts a chat thread without an @mention. Slash commands
// carry no message timestamp, so we post a visible message first and use its
// ts as the thread root — that keeps the Slack thread ↔ chat_session mapping
// identical to the mention path.
func (h *Handler) slackChatCommand(
	ctx context.Context, req slackCommandRequest, scope slackCommandScope, cmd messaging.Command,
) map[string]any {
	text := strings.TrimSpace(cmd.Remainder)
	if text == "" {
		return slackEphemeral("What should I work on? Try `/agenthost chat summarize today's open issues`.")
	}

	agents, err := h.Queries.ListAgents(ctx, scope.Workspace.ID)
	if err != nil {
		return slackEphemeral("Couldn't load agents for this workspace.")
	}
	usable := filterUsableAgents(agents)
	if len(usable) == 0 {
		return slackEphemeral("No agents are available in this workspace yet. Add one in Agenthost first.")
	}
	chosen := pickAutoAgent(scope.Binding.DefaultAgentID, usable)
	if chosen == nil {
		return slackEphemeral(
			"This channel has several agents and no default. Mention `@agenthost " + text + "` " +
				"instead and I'll ask which one to use, or set a default agent for the channel in Agenthost.")
	}

	root, err := slackprovider.PostMessage(ctx, scope.Connection.AccessToken, req.ChannelID,
		fmt.Sprintf("<@%s> asked: %s", req.SlackUserID, text), nil)
	if err != nil {
		slog.Error("slack command: chat root post failed", "error", err)
		return slackEphemeral("Couldn't post to this channel: " + err.Error())
	}

	if err := h.startSlackChatSession(ctx, slackChatStartArgs{
		Workspace:         scope.Workspace,
		Connection:        scope.Connection,
		Agent:             *chosen,
		Creator:           scope.User,
		TeamID:            req.TeamID,
		ChannelID:         req.ChannelID,
		ThreadID:          root.TS,
		InitialText:       text,
		NotifySlackUserID: req.SlackUserID,
	}); err != nil {
		slog.Error("slack command: chat session start failed", "error", err)
		return slackEphemeral("Couldn't start the chat: " + err.Error())
	}
	return nil
}

// slackLinkCommand reports the current identity mapping. The seamless
// email-match path means most people never need this; it exists so someone
// whose mapping looks wrong can see what Agenthost actually thinks.
func (h *Handler) slackLinkCommand(ctx context.Context, scope slackCommandScope) map[string]any {
	link, err := h.Queries.GetChatUserLinkByUser(ctx, db.GetChatUserLinkByUserParams{
		WorkspaceID: scope.Workspace.ID,
		Platform:    "slack",
		UserID:      scope.User.ID,
	})
	if err != nil {
		return slackEphemeral(fmt.Sprintf(
			"You're signed in as *%s* (%s) in workspace *%s*.",
			scope.User.Name, scope.User.Email, scope.Workspace.Name))
	}
	return slackEphemeral(fmt.Sprintf(
		"Your Slack account is linked to *%s* (%s) in workspace *%s*, matched on %s.\n"+
			"To change it, an admin can remove you from the workspace and re-add you with the right email.",
		scope.User.Name, scope.User.Email, scope.Workspace.Name, link.ExternalEmail.String))
}

// ── shared helpers ───────────────────────────────────────────────────────────

// slackIssueRefRe matches an issue reference with or without the workspace
// prefix: "ISS-12", "iss-12", "#12", "12".
var slackIssueRefRe = regexp.MustCompile(`^#?(?:[A-Za-z]+-)?(\d+)$`)

// parseSlackIssueRef extracts the issue number from a user-typed reference.
// The prefix is not validated against the workspace: within a bound channel
// there is exactly one workspace, so the number alone identifies the issue,
// and rejecting a mistyped prefix would only be pedantic.
func parseSlackIssueRef(ref string) (int32, bool) {
	m := slackIssueRefRe.FindStringSubmatch(strings.TrimSpace(ref))
	if m == nil {
		return 0, false
	}
	n, err := strconv.Atoi(m[1])
	if err != nil || n <= 0 {
		return 0, false
	}
	return int32(n), true
}

// slackResolveIssueArg turns a user-supplied issue reference into an issue,
// returning a ready-to-send error body when it can't.
func (h *Handler) slackResolveIssueArg(
	ctx context.Context, scope slackCommandScope, ref, usage string,
) (db.Issue, map[string]any) {
	if ref == "" {
		return db.Issue{}, slackEphemeral("Which issue? Try " + usage + ".")
	}
	number, ok := parseSlackIssueRef(ref)
	if !ok {
		return db.Issue{}, slackEphemeral(fmt.Sprintf(
			"`%s` doesn't look like an issue reference. Try %s.", ref, usage))
	}
	issue, err := h.Queries.GetIssueByNumber(ctx, db.GetIssueByNumberParams{
		WorkspaceID: scope.Workspace.ID,
		Number:      number,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Issue{}, slackEphemeral(fmt.Sprintf(
			"No issue %s-%d in *%s*.", scope.Workspace.IssuePrefix, number, scope.Workspace.Name))
	}
	if err != nil {
		slog.Error("slack command: issue lookup failed", "error", err)
		return db.Issue{}, slackEphemeral("Couldn't look that issue up.")
	}
	return issue, nil
}

// slackResolveAssignee maps an assignment target onto a workspace member.
// Accepts `@me`, a Slack mention (`<@U123|name>`), a plain @name, a bare name,
// or an email. Agents are deliberately not assignable here: they go through
// `/agenthost dispatch`, which also enforces ownership.
func (h *Handler) slackResolveAssignee(
	ctx context.Context, scope slackCommandScope, target string,
) (db.User, map[string]any) {
	target = strings.TrimSpace(target)

	if strings.EqualFold(target, "@me") || strings.EqualFold(target, "me") {
		return scope.User, nil
	}

	// Slack expands an @mention in command text to <@U08ABC|display-name>.
	if slackUserID, ok := parseSlackUserMention(target); ok {
		user, err := h.ResolveSlackUser(ctx, scope.Workspace, scope.Binding.ExternalTeamID,
			slackUserID, scope.Connection.AccessToken)
		if err != nil {
			return db.User{}, slackEphemeral(
				"I couldn't match that Slack user to an Agenthost account. " +
					"They may need to say something in this channel first.")
		}
		return user, nil
	}

	needle := strings.ToLower(strings.TrimPrefix(target, "@"))
	members, err := h.Queries.ListMembersWithUser(ctx, scope.Workspace.ID)
	if err != nil {
		return db.User{}, slackEphemeral("Couldn't load workspace members.")
	}
	var matches []db.ListMembersWithUserRow
	for _, m := range members {
		if strings.ToLower(m.UserName) == needle || strings.ToLower(m.UserEmail) == needle {
			matches = append(matches, m)
		}
	}
	if len(matches) == 0 {
		// Fall back to a prefix match so partial names work.
		for _, m := range members {
			if strings.HasPrefix(strings.ToLower(m.UserName), needle) {
				matches = append(matches, m)
			}
		}
	}
	switch len(matches) {
	case 0:
		return db.User{}, slackEphemeral(fmt.Sprintf("No workspace member matches `%s`.", target))
	case 1:
		user, err := h.Queries.GetUser(ctx, matches[0].UserID)
		if err != nil {
			return db.User{}, slackEphemeral("Couldn't load that member.")
		}
		return user, nil
	default:
		names := make([]string, 0, len(matches))
		for _, m := range matches {
			names = append(names, m.UserName)
		}
		return db.User{}, slackEphemeral(fmt.Sprintf(
			"`%s` matches several members: %s. Be more specific or use their email.",
			target, strings.Join(names, ", ")))
	}
}

// slackMentionRe matches Slack's encoded user mention, with or without the
// trailing display name: <@U08ABC> or <@U08ABC|jane>.
var slackMentionRe = regexp.MustCompile(`^<@([UW][A-Z0-9]+)(?:\|[^>]*)?>$`)

func parseSlackUserMention(s string) (string, bool) {
	m := slackMentionRe.FindStringSubmatch(strings.TrimSpace(s))
	if m == nil {
		return "", false
	}
	return m[1], true
}

// slackStatusAliases maps what people actually type onto DB status values.
var slackStatusAliases = map[string]string{
	"backlog":     "backlog",
	"todo":        "todo",
	"to-do":       "todo",
	"open":        "todo",
	"inprogress":  "in_progress",
	"in_progress": "in_progress",
	"in-progress": "in_progress",
	"progress":    "in_progress",
	"doing":       "in_progress",
	"started":     "in_progress",
	"inreview":    "in_review",
	"in_review":   "in_review",
	"in-review":   "in_review",
	"review":      "in_review",
	"done":        "done",
	"complete":    "done",
	"completed":   "done",
	"closed":      "done",
	"blocked":     "blocked",
	"cancelled":   "cancelled",
	"canceled":    "cancelled",
}

// normalizeIssueStatus accepts "In Progress", "in-progress", "doing", etc.
func normalizeIssueStatus(raw string) (string, bool) {
	key := strings.ToLower(strings.TrimSpace(raw))
	key = strings.ReplaceAll(key, " ", "_")
	if s, ok := slackStatusAliases[key]; ok {
		return s, true
	}
	// Try the hyphen form too, so "in-progress" and "in progress" agree.
	if s, ok := slackStatusAliases[strings.ReplaceAll(key, "_", "-")]; ok {
		return s, true
	}
	return "", false
}

// slackKnownStatuses lists the canonical statuses for error messages, in
// workflow order rather than map order so the hint reads sensibly.
func slackKnownStatuses() []string {
	return []string{"backlog", "todo", "in progress", "in review", "blocked", "done", "cancelled"}
}

// slackIssueIdentifier renders the workspace-prefixed issue id ("ISS-42").
func (h *Handler) slackIssueIdentifier(ws db.Workspace, issue db.Issue) string {
	return ws.IssuePrefix + "-" + strconv.Itoa(int(issue.Number))
}

// slackIssueViewOf is the Handler-bound form of SlackIssueViewFor.
func (h *Handler) slackIssueViewOf(ctx context.Context, ws db.Workspace, issue db.Issue) slackIssueView {
	return SlackIssueViewFor(ctx, h.Queries, ws, issue)
}

// SlackIssueViewFor resolves the display joins (assignee, project) an issue
// card needs. Lookup failures degrade to a blank field rather than an error —
// a card missing its project name still beats no card.
//
// Exported because the outbound notification listener in cmd/server renders
// the same cards and holds a *db.Queries rather than a Handler.
func SlackIssueViewFor(ctx context.Context, q *db.Queries, ws db.Workspace, issue db.Issue) slackIssueView {
	v := slackIssueView{
		Identifier:  ws.IssuePrefix + "-" + strconv.Itoa(int(issue.Number)),
		Title:       issue.Title,
		Description: issue.Description.String,
		Status:      issue.Status,
		Priority:    issue.Priority,
		URL:         slackIssueURL(ws.Slug, uuidToString(issue.ID)),
	}

	if issue.AssigneeType.Valid && issue.AssigneeID.Valid {
		switch issue.AssigneeType.String {
		case "agent":
			if a, err := q.GetAgent(ctx, issue.AssigneeID); err == nil {
				v.Assignee, v.IsAgent = a.Name, true
			}
		default:
			if u, err := q.GetUser(ctx, issue.AssigneeID); err == nil {
				v.Assignee = u.Name
			}
		}
	}
	if issue.ProjectID.Valid {
		if p, err := q.GetProject(ctx, issue.ProjectID); err == nil {
			v.Project = p.Title
		}
	}
	return v
}

// slackIssueURL builds the absolute link to an issue, or "" when no app URL is
// configured (self-hosted setups that never set AGENTHOST_APP_URL). Callers
// render a plain title in that case rather than a broken link.
func slackIssueURL(workspaceSlug, issueID string) string {
	base := appURL()
	if base == "" {
		return ""
	}
	return fmt.Sprintf("%s/%s/issues/%s", strings.TrimSuffix(base, "/"), workspaceSlug, issueID)
}

// publishSlackIssueEvent mirrors a Slack-originated write onto the internal
// event bus so the web UI updates live and inbox notifications still fire.
func (h *Handler) publishSlackIssueEvent(eventType string, scope slackCommandScope, issue db.Issue) {
	h.publish(eventType, uuidToString(scope.Workspace.ID), "member", uuidToString(scope.User.ID),
		map[string]any{"issue": issueToResponse(issue, scope.Workspace.IssuePrefix)})
}

// ── responses ────────────────────────────────────────────────────────────────

// slackEphemeral builds a private reply visible only to the caller.
func slackEphemeral(text string) map[string]any {
	return map[string]any{"response_type": "ephemeral", "text": text}
}

// slackEphemeralBlocks builds a private Block Kit reply. text is the fallback
// used in notifications and unsupported clients.
func slackEphemeralBlocks(text string, blocks []map[string]any) map[string]any {
	return map[string]any{
		"response_type": "ephemeral",
		"text":          text,
		"blocks":        blocks,
	}
}

func slackHelpText() string {
	return strings.Join([]string{
		"*Agenthost commands*",
		"",
		"`/agenthost chat <message>` — start a thread with this channel's agent",
		"`/agenthost issue new [title]` — open the new-issue form",
		"`/agenthost issue show ISS-12` — show an issue",
		"`/agenthost issue assign ISS-12 @me` — assign to a member",
		"`/agenthost issue status ISS-12 done` — change status",
		"`/agenthost dispatch ISS-12 <agent>` — hand an issue to an agent you own",
		"`/agenthost agents` — list agents and your ownership",
		"`/agenthost agents request <agent>` — ask an admin for ownership",
		"`/agenthost link` — show which Agenthost account you're mapped to",
		"",
		"You can also just mention `@agenthost <message>` in a bound channel.",
	}, "\n")
}
