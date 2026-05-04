package main

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"github.com/multica-ai/multica/server/internal/events"
	slackprovider "github.com/multica-ai/multica/server/internal/messaging/slack"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
	"github.com/multica-ai/multica/server/pkg/protocol"
	"github.com/multica-ai/multica/server/internal/util"
)

// registerSlackChatListener wires the chat:done event to a goroutine that
// relays the agent's assistant reply back into the Slack thread the chat
// originated from.
//
// Pre-requisites this listener relies on (Phases 1–3 of #18):
//   - chat_session.source == 'slack' AND external_channel_id/thread_id set
//     (CreateSlackChatSession in Phase 4)
//   - integration_connection.access_token contains the bot token (Phase 1)
//   - chat_message.task_id was set on the assistant reply (existing CompleteTask)
//
// Web sessions (source='web') are no-ops — the existing realtime hub already
// pushes them over WebSocket to the in-app chat UI.
func registerSlackChatListener(bus *events.Bus, queries *db.Queries) {
	bus.Subscribe(protocol.EventChatDone, func(e events.Event) {
		go func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := relayChatDoneToSlack(ctx, queries, e); err != nil {
				slog.Error("slack chat listener: relay failed",
					"chat_session_id", e.ChatSessionID, "error", err)
			}
		}()
	})
}

func relayChatDoneToSlack(ctx context.Context, queries *db.Queries, e events.Event) error {
	payload, ok := e.Payload.(protocol.ChatDonePayload)
	if !ok {
		// Map-shaped payloads from JSON-decoded events also valid; ignore otherwise.
		return nil
	}

	sessionID := parseUUIDLocal(payload.ChatSessionID)
	taskID := parseUUIDLocal(payload.TaskID)
	if !sessionID.Valid || !taskID.Valid {
		return nil
	}

	session, err := queries.GetChatSession(ctx, sessionID)
	if err != nil {
		return err
	}
	if session.Source != "slack" {
		return nil
	}
	if !session.ExternalChannelID.Valid || !session.ExternalThreadID.Valid {
		return nil
	}

	conn, err := queries.GetIntegrationConnection(ctx, session.WorkspaceID, "slack")
	if err != nil {
		return err
	}

	// Find the assistant message just produced by this task. The chat_done
	// event fires after CompleteTask saves it.
	msg, err := queries.GetChatMessageByTask(ctx, taskID)
	if err != nil {
		// If the agent finished without producing a chat_message (rare —
		// agent crashed mid-write, or chat:done fired for a non-chat task),
		// post a short heads-up so the thread doesn't go silent.
		_ = slackprovider.PostMessageInThread(ctx, conn.AccessToken,
			session.ExternalChannelID.String, session.ExternalThreadID.String,
			"⚠️ Agent finished without producing output. Check the chat in Agenthost for details.")
		return err
	}

	if msg.Content == "" {
		return nil
	}

	result, err := slackprovider.PostMessage(ctx, conn.AccessToken,
		session.ExternalChannelID.String,
		formatAgentReplyForSlack(msg.Content),
		&slackprovider.PostMessageOptions{
			ThreadTS: session.ExternalThreadID.String,
		})
	if err != nil {
		return err
	}

	// Stamp the relayed Slack ts on the chat_message so future phases can
	// edit/update or thread further interactions off of it.
	if result != nil && result.TS != "" {
		_ = queries.SetChatMessageExternalID(ctx, db.SetChatMessageExternalIDParams{
			ID:                msg.ID,
			ExternalMessageID: pgtype.Text{String: result.TS, Valid: true},
		})
	}
	return nil
}

// formatAgentReplyForSlack converts the agent's markdown-ish output to
// Slack mrkdwn. Phase 4 keeps it minimal — Slack already renders ``` and
// *bold* and _italic_ acceptably, but standard markdown headings and
// bullet styles need light touching up. Real Block Kit rendering with
// tool-call timeline collapse is a Phase 6 polish.
func formatAgentReplyForSlack(s string) string {
	// Slack truncates >40k chars; cap aggressively to avoid being silently dropped.
	const maxLen = 30000
	if len(s) > maxLen {
		s = s[:maxLen] + "\n\n…(truncated)"
	}
	return s
}

// parseUUIDLocal mirrors handler.parseUUID — duplicated here to avoid a
// cyclic import. The handler-package version is what callers in handler/
// use; keeping this private to cmd/server is the minimal reuse footprint.
func parseUUIDLocal(s string) pgtype.UUID {
	if s == "" {
		return pgtype.UUID{}
	}
	var u pgtype.UUID
	if err := u.Scan(s); err != nil {
		return pgtype.UUID{}
	}
	return u
}

// Compile-time assertion that the listener's util import isn't pruned by
// goimports despite no direct call — kept around for future Block Kit
// formatters that may use util.UUIDToString.
var _ = util.UUIDToString
