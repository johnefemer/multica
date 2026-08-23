package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/handler"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	"github.com/multica-ai/multica/server/internal/util"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
)

// Outbound issue notifications: workspace events → Block Kit posts in bound
// Slack channels.
//
// Deliberately separate from registerNotificationListeners: inbox items and
// channel notifications answer different questions ("what do I personally need
// to look at" versus "what is this channel watching"), and folding them
// together would mean every future delivery target has to reason about inbox
// subscription rules that don't apply to it.
//
// Opt-in per binding. A channel with an empty event_filters array receives
// nothing, so binding a channel never starts a firehose by surprise.

// slackNotifyEvents is the set of event types a channel can subscribe to.
// It aliases the handler's list so the events we subscribe to here and the
// values the API accepts can never disagree.
var slackNotifyEvents = handler.SlackNotifyEventTypes

// registerSlackNotifyListeners subscribes the outbound notifier to the bus.
func registerSlackNotifyListeners(bus *events.Bus, queries *db.Queries) {
	for _, eventType := range slackNotifyEvents {
		et := eventType
		bus.Subscribe(et, func(e events.Event) {
			go func() {
				ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
				defer cancel()
				if err := notifySlackChannels(ctx, queries, et, e); err != nil {
					slog.Error("slack notify: delivery failed",
						"event_type", et, "workspace_id", e.WorkspaceID, "error", err)
				}
			}()
		})
	}
}

// notifySlackChannels posts one event to every bound channel subscribed to it.
func notifySlackChannels(ctx context.Context, queries *db.Queries, eventType string, e events.Event) error {
	wsID := util.ParseUUID(e.WorkspaceID)
	if !wsID.Valid {
		return nil
	}

	bindings, err := queries.ListChatChannelBindingsForNotify(ctx, db.ListChatChannelBindingsForNotifyParams{
		WorkspaceID: wsID,
		Platform:    "slack",
		EventType:   eventType,
	})
	if err != nil {
		return fmt.Errorf("list bindings: %w", err)
	}
	if len(bindings) == 0 {
		// The overwhelmingly common case. Bail before doing any joins.
		return nil
	}

	issueID, ok := slackIssueIDFromEvent(e)
	if !ok {
		return nil
	}
	issue, err := queries.GetIssue(ctx, util.ParseUUID(issueID))
	if err != nil {
		return fmt.Errorf("load issue %s: %w", issueID, err)
	}
	ws, err := queries.GetWorkspace(ctx, wsID)
	if err != nil {
		return fmt.Errorf("load workspace: %w", err)
	}
	conn, err := queries.GetIntegrationConnection(ctx, wsID, "slack")
	if err != nil {
		return fmt.Errorf("load slack connection: %w", err)
	}

	view := handler.SlackIssueViewFor(ctx, queries, ws, issue)
	headline := slackNotifyHeadline(eventType, e)
	blocks := slackprovider.IssueCardBlocks(view, headline, true)
	fallback := slackprovider.IssueFallbackText(view, headline)

	// One slow or failing channel must not stop the others, so failures are
	// logged per binding rather than aborting the loop.
	for _, b := range bindings {
		if _, err := slackprovider.PostMessage(ctx, conn.AccessToken, b.ExternalChannelID, fallback,
			&slackprovider.PostMessageOptions{Blocks: blocks},
		); err != nil {
			slog.Warn("slack notify: post failed",
				"channel_id", b.ExternalChannelID,
				"workspace_id", e.WorkspaceID,
				"event_type", eventType,
				"error", err)
		}
	}
	return nil
}

// slackNotifyHeadline renders the context line above the card.
func slackNotifyHeadline(eventType string, e events.Event) string {
	actor := ""
	if e.ActorType == "agent" {
		actor = " by an agent"
	}
	switch eventType {
	case protocol.EventIssueCreated:
		return "🆕 New issue" + actor
	case protocol.EventIssueUpdated:
		return "✏️ Issue updated" + actor
	case protocol.EventTaskCompleted:
		return "✅ Agent finished a task"
	case protocol.EventTaskFailed:
		return "⚠️ Agent task failed"
	default:
		return ""
	}
}

// slackIssueIDFromEvent digs the issue id out of an event payload.
//
// Two payload shapes reach the bus. Issue events publish
// map[string]any{"issue": IssueResponse{…}} — a map whose value is a *struct*,
// so a plain type assertion on the inner value fails. Task events publish a
// flat map with "issue_id" as a string. Marshalling the whole payload through
// JSON normalizes both, which is why there is no fast path here: skipping the
// round trip for the already-a-map case would silently miss every issue event.
func slackIssueIDFromEvent(e events.Event) (string, bool) {
	raw, err := json.Marshal(e.Payload)
	if err != nil {
		return "", false
	}
	var payload struct {
		Issue struct {
			ID string `json:"id"`
		} `json:"issue"`
		IssueID string `json:"issue_id"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return "", false
	}
	if payload.Issue.ID != "" {
		return payload.Issue.ID, true
	}
	// Chat and autopilot tasks have no issue; issue_id marshals to the empty
	// string for those and they are correctly skipped.
	if payload.IssueID != "" {
		return payload.IssueID, true
	}
	return "", false
}
