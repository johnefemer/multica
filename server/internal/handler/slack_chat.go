package handler

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

// Slack chat mirroring (Phase 4 of #18).
//
// Inbound flow:
//
//   1. app_mention or threaded message arrives at /webhooks/slack/events
//   2. Channel binding lookup → workspace
//   3. Identity resolution → Agenthost user (Phase 3 plumbing)
//   4. If existing chat_session for this thread → append + enqueue
//      Else if 1 active agent OR binding.default_agent_id → auto-pick + dispatch
//      Else → post ephemeral agent picker (slack_pending_chat_pick keyed by UUID)
//   5. Picker selection lands at /webhooks/slack/interactivity → dispatch
//
// Outbound (chat:done → Slack thread) lives in cmd/server/slack_chat_listener.go
// so it can subscribe to the event bus at startup.

const (
	// slackPickerActionID identifies our picker block in interactivity payloads.
	slackPickerActionID = "agenthost_chat_pick_agent"
	// slackPendingPickTTL is how long a pending pick row stays valid.
	slackPendingPickTTL = 10 * time.Minute
	// slackChatTitleMaxLen caps the chat_session title to keep tooltips/lists tidy.
	slackChatTitleMaxLen = 80
)

// SlackEventEnvelope is the slim shape we care about from the Events API.
// Mirrors the inline struct in slack_webhook.go but exported for cross-file
// dispatch.
type SlackEventEnvelope struct {
	TeamID  string
	EventID string
	Type    string // outer envelope type (event_callback, etc.)
	Event   SlackInnerEvent
}

// SlackInnerEvent is the inner `event` object.
type SlackInnerEvent struct {
	Type     string // app_mention, message, etc.
	User     string
	Channel  string
	Text     string
	TS       string // event message ts
	ThreadTS string // parent ts when this is a threaded reply
	BotID    string // present when the message is from our own bot
}

// dispatchSlackEvent is called by the events webhook after signature
// verification + idempotency. It resolves the binding/identity and routes
// to the right handler.
func (h *Handler) dispatchSlackEvent(ctx context.Context, env SlackEventEnvelope) error {
	// Skip our own bot's posts to avoid feedback loops.
	if env.Event.BotID != "" {
		return nil
	}

	switch env.Event.Type {
	case "app_mention":
		return h.handleSlackAppMention(ctx, env)
	case "message":
		// Only act on thread replies in a bound channel that already has a session.
		if env.Event.ThreadTS == "" || env.Event.ThreadTS == env.Event.TS {
			return nil
		}
		return h.handleSlackThreadReply(ctx, env)
	default:
		return nil
	}
}

// handleSlackAppMention starts a new chat thread from an `@agenthost ...`
// mention. The mention's ts becomes the thread root.
func (h *Handler) handleSlackAppMention(ctx context.Context, env SlackEventEnvelope) error {
	if env.Event.User == "" || env.Event.Channel == "" || env.Event.TS == "" {
		return nil
	}

	binding, err := h.Queries.GetChatChannelBindingByChannel(ctx, db.GetChatChannelBindingByChannelParams{
		Platform:          "slack",
		ExternalChannelID: env.Event.Channel,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Unbound channel — Slack has no thread context yet; reply ephemerally
		// so the user knows what happened.
		conn, _, lookupErr := h.lookupSlackTeamConnection(ctx, env.TeamID)
		if lookupErr == nil {
			_ = slackprovider.PostEphemeral(ctx, conn.AccessToken, env.Event.Channel, env.Event.User,
				"Agenthost isn't bound to this channel yet — ask a workspace admin to add it from Settings → Integrations → Slack.", nil)
		}
		return nil
	}
	if err != nil {
		return fmt.Errorf("lookup binding: %w", err)
	}

	ws, err := h.Queries.GetWorkspace(ctx, binding.WorkspaceID)
	if err != nil {
		return fmt.Errorf("lookup workspace: %w", err)
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, ws.ID, "slack")
	if err != nil {
		return fmt.Errorf("lookup slack connection: %w", err)
	}

	user, err := h.ResolveSlackUser(ctx, ws, env.TeamID, env.Event.User, conn.AccessToken)
	if err != nil {
		// Friendly ephemeral feedback per error type.
		var msg string
		switch {
		case errors.Is(err, ErrSlackEmailUnavailable):
			msg = "I can't see your Slack profile email — ask the workspace owner to grant the `users:read.email` scope, or sign in to Agenthost first."
		case errors.Is(err, ErrAutoOnboardingDisabled):
			msg = "Auto-onboarding from Slack is disabled in this workspace. Ask an admin to add you, then mention me again."
		default:
			slog.Error("slack chat: identity resolution failed",
				"workspace_id", uuidToString(ws.ID), "slack_user_id", env.Event.User, "error", err)
			msg = "Couldn't link your Slack identity to Agenthost — please try again or ask an admin."
		}
		_ = slackprovider.PostEphemeral(ctx, conn.AccessToken, env.Event.Channel, env.Event.User, msg, nil)
		return nil
	}

	// Pick an agent: binding default → only-active-agent → picker.
	agents, err := h.Queries.ListAgents(ctx, ws.ID)
	if err != nil {
		return fmt.Errorf("list agents: %w", err)
	}
	usable := filterUsableAgents(agents)
	if len(usable) == 0 {
		_ = slackprovider.PostEphemeral(ctx, conn.AccessToken, env.Event.Channel, env.Event.User,
			"No agents are available in this workspace yet. Add an agent in Agenthost first.", nil)
		return nil
	}

	threadID := env.Event.TS
	cleanedText := stripBotMention(env.Event.Text)

	// Auto-pick when binding has a default agent and it's still usable, or
	// when only one usable agent exists.
	chosen := pickAutoAgent(binding.DefaultAgentID, usable)
	if chosen != nil {
		return h.startSlackChatSession(ctx, slackChatStartArgs{
			Workspace:         ws,
			Connection:        conn,
			Agent:             *chosen,
			Creator:           user,
			TeamID:            env.TeamID,
			ChannelID:         env.Event.Channel,
			ThreadID:          threadID,
			InitialText:       cleanedText,
			NotifySlackUserID: env.Event.User,
		})
	}

	// Multi-agent case: stash text + identity in slack_pending_chat_pick,
	// post ephemeral picker.
	expiresAt := time.Now().Add(slackPendingPickTTL)
	pick, err := h.Queries.CreateSlackPendingChatPick(ctx, db.CreateSlackPendingChatPickParams{
		WorkspaceID:       ws.ID,
		CreatorID:         user.ID,
		ExternalTeamID:    env.TeamID,
		ExternalChannelID: env.Event.Channel,
		ExternalThreadID:  threadID,
		InitialText:       cleanedText,
		ExpiresAt:         pgtype.Timestamptz{Time: expiresAt, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("create pending pick: %w", err)
	}

	blocks := slackAgentPickerBlocks(uuidToString(pick.ID), usable)
	if err := slackprovider.PostEphemeral(ctx, conn.AccessToken, env.Event.Channel, env.Event.User,
		"Pick an agent to handle this thread:", blocks); err != nil {
		// Pending row stays — user can re-mention to retry.
		return fmt.Errorf("post picker: %w", err)
	}
	return nil
}

// handleSlackThreadReply is invoked for message events in a channel where a
// chat_session already exists for this thread. We append a user message and
// enqueue a follow-up task — but only when the replier is the original
// session creator (single-user chat is the v1 limitation).
func (h *Handler) handleSlackThreadReply(ctx context.Context, env SlackEventEnvelope) error {
	session, err := h.Queries.GetChatSessionBySlackThread(ctx, db.GetChatSessionBySlackThreadParams{
		ExternalChannelID: pgtype.Text{String: env.Event.Channel, Valid: true},
		ExternalThreadID:  pgtype.Text{String: env.Event.ThreadTS, Valid: true},
	})
	if errors.Is(err, pgx.ErrNoRows) {
		// Reply in a channel that's bound but the parent message wasn't an
		// app_mention — ignore (Slack delivers all channel messages once the
		// scope is granted).
		return nil
	}
	if err != nil {
		return fmt.Errorf("lookup chat session by thread: %w", err)
	}

	ws, err := h.Queries.GetWorkspace(ctx, session.WorkspaceID)
	if err != nil {
		return fmt.Errorf("lookup workspace: %w", err)
	}

	conn, err := h.Queries.GetIntegrationConnection(ctx, ws.ID, "slack")
	if err != nil {
		return fmt.Errorf("lookup slack connection: %w", err)
	}

	user, err := h.ResolveSlackUser(ctx, ws, env.TeamID, env.Event.User, conn.AccessToken)
	if err != nil {
		// Same friendly feedback as app_mention.
		return nil
	}

	if uuidToString(user.ID) != uuidToString(session.CreatorID) {
		// Only the original starter drives the conversation in v1.
		_ = slackprovider.PostEphemeral(ctx, conn.AccessToken, env.Event.Channel, env.Event.User,
			"Agenthost only listens to the thread starter for now. Multi-user chat is on the roadmap.", nil)
		return nil
	}

	// Append user message, enqueue follow-up.
	cleanedText := stripBotMention(env.Event.Text)
	if cleanedText == "" {
		return nil
	}
	_, err = h.Queries.CreateSlackChatMessage(ctx, db.CreateSlackChatMessageParams{
		ChatSessionID:     session.ID,
		Role:              "user",
		Content:           cleanedText,
		ExternalMessageID: pgtype.Text{String: env.Event.TS, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("create user chat message: %w", err)
	}

	if _, err := h.TaskService.EnqueueChatTask(ctx, session); err != nil {
		_ = slackprovider.PostMessageInThread(ctx, conn.AccessToken, env.Event.Channel, env.Event.ThreadTS,
			"⚠️ Couldn't enqueue a task: "+err.Error())
		return fmt.Errorf("enqueue follow-up task: %w", err)
	}
	if err := h.Queries.TouchChatSession(ctx, session.ID); err != nil {
		slog.Warn("slack chat: touch session failed", "session_id", uuidToString(session.ID), "error", err)
	}
	return nil
}

// HandleSlackPickerSelection is dispatched from the interactivity webhook when
// the agent-picker static_select fires.
func (h *Handler) HandleSlackPickerSelection(ctx context.Context, payload SlackInteractivityPayload) error {
	if len(payload.Actions) == 0 {
		return nil
	}
	action := payload.Actions[0]
	if action.ActionID != slackPickerActionID {
		return nil
	}
	pickID, agentID, ok := decodePickerValue(action.SelectedOption.Value)
	if !ok {
		return fmt.Errorf("malformed picker value: %q", action.SelectedOption.Value)
	}

	pickUUID := parseUUID(pickID)
	agentUUID := parseUUID(agentID)
	if !pickUUID.Valid || !agentUUID.Valid {
		return fmt.Errorf("invalid uuids in picker value")
	}

	pick, err := h.Queries.GetSlackPendingChatPick(ctx, pickUUID)
	if err != nil {
		return fmt.Errorf("lookup pending pick: %w", err)
	}
	defer func() {
		if delErr := h.Queries.DeleteSlackPendingChatPick(ctx, pickUUID); delErr != nil {
			slog.Warn("slack chat: delete pending pick failed", "pick_id", pickID, "error", delErr)
		}
	}()

	if pick.ExpiresAt.Valid && time.Now().After(pick.ExpiresAt.Time) {
		return fmt.Errorf("pending pick expired")
	}

	ws, err := h.Queries.GetWorkspace(ctx, pick.WorkspaceID)
	if err != nil {
		return fmt.Errorf("lookup workspace: %w", err)
	}
	conn, err := h.Queries.GetIntegrationConnection(ctx, ws.ID, "slack")
	if err != nil {
		return fmt.Errorf("lookup slack connection: %w", err)
	}
	agent, err := h.Queries.GetAgent(ctx, agentUUID)
	if err != nil {
		return fmt.Errorf("lookup agent: %w", err)
	}
	user, err := h.Queries.GetUser(ctx, pick.CreatorID)
	if err != nil {
		return fmt.Errorf("lookup user: %w", err)
	}

	return h.startSlackChatSession(ctx, slackChatStartArgs{
		Workspace:         ws,
		Connection:        conn,
		Agent:             agent,
		Creator:           user,
		TeamID:            pick.ExternalTeamID,
		ChannelID:         pick.ExternalChannelID,
		ThreadID:          pick.ExternalThreadID,
		InitialText:       pick.InitialText,
		NotifySlackUserID: payload.User.ID,
	})
}

type slackChatStartArgs struct {
	Workspace         db.Workspace
	Connection        db.IntegrationConnection
	Agent             db.Agent
	Creator           db.User
	TeamID            string
	ChannelID         string
	ThreadID          string
	InitialText       string
	NotifySlackUserID string // for ephemeral failure replies
}

// startSlackChatSession creates the chat_session + initial user message,
// enqueues an agent task, and posts a "Working on it…" reply in the thread.
// Idempotent against re-runs: if a session already exists for this thread
// (e.g. picker fired twice) it logs and returns without dispatching again.
func (h *Handler) startSlackChatSession(ctx context.Context, args slackChatStartArgs) error {
	if args.Agent.ArchivedAt.Valid {
		_ = slackprovider.PostEphemeral(ctx, args.Connection.AccessToken, args.ChannelID, args.NotifySlackUserID,
			"That agent is archived. Pick another, or mention me again to retry.", nil)
		return nil
	}
	if !args.Agent.RuntimeID.Valid {
		_ = slackprovider.PostEphemeral(ctx, args.Connection.AccessToken, args.ChannelID, args.NotifySlackUserID,
			"That agent has no runtime attached yet. Configure one in Agenthost first.", nil)
		return nil
	}

	// Idempotency: was a session already created for this thread? (Picker
	// double-click, retry from Slack, etc.)
	if existing, err := h.Queries.GetChatSessionBySlackThread(ctx, db.GetChatSessionBySlackThreadParams{
		ExternalChannelID: pgtype.Text{String: args.ChannelID, Valid: true},
		ExternalThreadID:  pgtype.Text{String: args.ThreadID, Valid: true},
	}); err == nil {
		slog.Info("slack chat: session already exists, skipping dispatch",
			"chat_session_id", uuidToString(existing.ID))
		return nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("idempotency check: %w", err)
	}

	title := args.InitialText
	if len(title) > slackChatTitleMaxLen {
		title = title[:slackChatTitleMaxLen]
	}

	session, err := h.Queries.CreateSlackChatSession(ctx, db.CreateSlackChatSessionParams{
		WorkspaceID:       args.Workspace.ID,
		AgentID:           args.Agent.ID,
		CreatorID:         args.Creator.ID,
		Title:             title,
		ExternalTeamID:    pgtype.Text{String: args.TeamID, Valid: true},
		ExternalChannelID: pgtype.Text{String: args.ChannelID, Valid: true},
		ExternalThreadID:  pgtype.Text{String: args.ThreadID, Valid: true},
	})
	if err != nil {
		return fmt.Errorf("create chat session: %w", err)
	}

	if _, err := h.Queries.CreateSlackChatMessage(ctx, db.CreateSlackChatMessageParams{
		ChatSessionID:     session.ID,
		Role:              "user",
		Content:           args.InitialText,
		ExternalMessageID: pgtype.Text{String: args.ThreadID, Valid: true}, // mention's own ts
	}); err != nil {
		return fmt.Errorf("create initial chat message: %w", err)
	}

	if _, err := h.TaskService.EnqueueChatTask(ctx, session); err != nil {
		_ = slackprovider.PostMessageInThread(ctx, args.Connection.AccessToken, args.ChannelID, args.ThreadID,
			"⚠️ Couldn't enqueue a task: "+err.Error())
		return fmt.Errorf("enqueue chat task: %w", err)
	}

	ack := fmt.Sprintf("🤖 *%s* is on it…", args.Agent.Name)
	if _, err := slackprovider.PostMessage(ctx, args.Connection.AccessToken, args.ChannelID, ack, &slackprovider.PostMessageOptions{
		ThreadTS: args.ThreadID,
	}); err != nil {
		slog.Warn("slack chat: ack post failed",
			"channel_id", args.ChannelID, "thread_ts", args.ThreadID, "error", err)
	}

	slog.Info("slack chat: session started",
		"workspace_id", uuidToString(args.Workspace.ID),
		"chat_session_id", uuidToString(session.ID),
		"agent_id", uuidToString(args.Agent.ID),
		"thread_ts", args.ThreadID,
	)
	return nil
}

// lookupSlackTeamConnection finds the (workspace, integration_connection)
// for a Slack team. Used where we have no binding to derive workspace context
// from: the unbound-channel ephemeral hint, and slash commands in channels
// that were never bound.
//
// A Slack team can be installed into several Agenthost workspaces. Any of
// their bot tokens can post the reply (Slack issues one token per team), so
// the oldest connection wins. Callers that need real workspace context must
// resolve it from a binding instead.
func (h *Handler) lookupSlackTeamConnection(ctx context.Context, teamID string) (db.IntegrationConnection, db.Workspace, error) {
	if teamID == "" {
		return db.IntegrationConnection{}, db.Workspace{}, errors.New("empty slack team id")
	}
	conn, err := h.Queries.GetIntegrationConnectionByProviderAccount(ctx, "slack", teamID)
	if err != nil {
		return db.IntegrationConnection{}, db.Workspace{}, fmt.Errorf("lookup slack connection by team: %w", err)
	}
	ws, err := h.Queries.GetWorkspace(ctx, conn.WorkspaceID)
	if err != nil {
		return conn, db.Workspace{}, fmt.Errorf("lookup workspace: %w", err)
	}
	return conn, ws, nil
}

// filterUsableAgents drops archived agents and agents without a runtime.
// EnqueueChatTask requires both, so filtering here lets us skip showing
// agents in the picker that would 500 on selection.
func filterUsableAgents(agents []db.Agent) []db.Agent {
	out := make([]db.Agent, 0, len(agents))
	for _, a := range agents {
		if a.ArchivedAt.Valid {
			continue
		}
		if !a.RuntimeID.Valid {
			continue
		}
		out = append(out, a)
	}
	return out
}

// pickAutoAgent returns the agent to use without prompting:
//  1. binding.default_agent_id when set and still usable
//  2. the only entry in `usable` when there's exactly one
//  3. nil otherwise (caller posts the picker)
func pickAutoAgent(defaultID pgtype.UUID, usable []db.Agent) *db.Agent {
	if defaultID.Valid {
		for i := range usable {
			if uuidToString(usable[i].ID) == uuidToString(defaultID) {
				return &usable[i]
			}
		}
	}
	if len(usable) == 1 {
		return &usable[0]
	}
	return nil
}

// stripBotMention removes the leading `<@Uxxxx>` mention from an app_mention
// text so the agent doesn't see "@agenthost" prefixed on every input.
func stripBotMention(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "<@") {
		return s
	}
	end := strings.Index(s, ">")
	if end < 0 {
		return s
	}
	return strings.TrimSpace(s[end+1:])
}

// slackAgentPickerBlocks renders the ephemeral picker as Block Kit blocks.
// Each option encodes (pick_id|agent_id) — both UUIDs, fits in 75 chars.
func slackAgentPickerBlocks(pickID string, agents []db.Agent) []map[string]any {
	options := make([]map[string]any, 0, len(agents))
	for _, a := range agents {
		options = append(options, map[string]any{
			"text": map[string]any{
				"type": "plain_text",
				"text": a.Name,
			},
			"value": pickID + "|" + uuidToString(a.ID),
		})
	}
	return []map[string]any{
		{
			"type": "section",
			"text": map[string]any{
				"type": "mrkdwn",
				"text": "Choose an agent for this thread:",
			},
		},
		{
			"type":     "actions",
			"block_id": "agenthost_chat_pick",
			"elements": []map[string]any{
				{
					"type":      "static_select",
					"action_id": slackPickerActionID,
					"placeholder": map[string]any{
						"type": "plain_text",
						"text": "Pick an agent",
					},
					"options": options,
				},
			},
		},
	}
}

// decodePickerValue inverts the (pick_id|agent_id) encoding.
func decodePickerValue(value string) (pickID, agentID string, ok bool) {
	parts := strings.SplitN(value, "|", 2)
	if len(parts) != 2 {
		return "", "", false
	}
	return parts[0], parts[1], true
}

// SlackInteractivityPayload mirrors the slim shape we read from a Slack
// interactivity webhook payload. It covers both interaction families we
// handle: block_actions (agent picker, issue card buttons) and
// view_submission (the issue-creation and dispatch modals).
type SlackInteractivityPayload struct {
	Type      string `json:"type"`
	TriggerID string `json:"trigger_id"`
	User      struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"user"`
	Team struct {
		ID string `json:"id"`
	} `json:"team"`
	Container struct {
		ChannelID string `json:"channel_id"`
		ThreadTS  string `json:"thread_ts"`
	} `json:"container"`
	// Channel is populated on block_actions from a posted message. The
	// container carries it too, but only for some interaction sources, so we
	// read both and prefer whichever is non-empty.
	Channel struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"channel"`
	Actions []struct {
		ActionID       string `json:"action_id"`
		BlockID        string `json:"block_id"`
		Value          string `json:"value"`
		SelectedOption struct {
			Value string `json:"value"`
		} `json:"selected_option"`
	} `json:"actions"`
	View struct {
		ID              string `json:"id"`
		CallbackID      string `json:"callback_id"`
		PrivateMetadata string `json:"private_metadata"`
		State           struct {
			Values slackViewState `json:"values"`
		} `json:"state"`
	} `json:"view"`
}

// ChannelID returns the channel the interaction came from, preferring the
// container (set for message-attached actions) and falling back to the
// top-level channel object.
func (p SlackInteractivityPayload) ChannelID() string {
	if p.Container.ChannelID != "" {
		return p.Container.ChannelID
	}
	return p.Channel.ID
}

// parseSlackInteractivityPayload unmarshals the form-encoded `payload`
// JSON. Convenience for the webhook handler.
func parseSlackInteractivityPayload(raw string) (SlackInteractivityPayload, error) {
	var p SlackInteractivityPayload
	err := json.Unmarshal([]byte(raw), &p)
	return p, err
}
