-- name: CreateSlackChatSession :one
INSERT INTO chat_session (
    workspace_id, agent_id, creator_id, title,
    source, external_team_id, external_channel_id, external_thread_id
) VALUES (
    @workspace_id, @agent_id, @creator_id, @title,
    'slack', @external_team_id, @external_channel_id, @external_thread_id
)
RETURNING *;

-- name: GetChatSessionBySlackThread :one
SELECT * FROM chat_session
WHERE source             = 'slack'
  AND external_channel_id = @external_channel_id
  AND external_thread_id  = @external_thread_id;

-- name: CreateSlackChatMessage :one
-- Creates a chat message and remembers the Slack message ts (when relayed
-- from Agenthost). For inbound user messages external_message_id is the
-- Slack ts of the user's text; for assistant messages it's the bot's reply
-- post ts (filled in by SetChatMessageExternalID after the post lands).
INSERT INTO chat_message (
    chat_session_id, role, content, task_id, external_message_id
) VALUES (
    @chat_session_id, @role, @content, sqlc.narg(task_id), sqlc.narg(external_message_id)
)
RETURNING *;

-- name: SetChatMessageExternalID :exec
UPDATE chat_message SET external_message_id = @external_message_id
WHERE id = @id;

-- name: GetChatMessageByTask :one
-- Returns the latest assistant chat_message produced by a given task. Used
-- by the slack_chat_listener to find what content to relay to the Slack
-- thread after the task finishes.
SELECT * FROM chat_message
WHERE task_id = @task_id AND role = 'assistant'
ORDER BY created_at DESC
LIMIT 1;

-- name: CreateSlackPendingChatPick :one
INSERT INTO slack_pending_chat_pick (
    workspace_id, creator_id,
    external_team_id, external_channel_id, external_thread_id,
    initial_text, expires_at
) VALUES (
    @workspace_id, @creator_id,
    @external_team_id, @external_channel_id, @external_thread_id,
    @initial_text, @expires_at
)
RETURNING *;

-- name: GetSlackPendingChatPick :one
SELECT * FROM slack_pending_chat_pick
WHERE id = @id;

-- name: DeleteSlackPendingChatPick :exec
DELETE FROM slack_pending_chat_pick
WHERE id = @id;

-- name: DeleteExpiredSlackPendingChatPicks :exec
-- Periodic GC: callers should run this on a schedule. Phase 4 ships
-- without the cron, so stale rows accumulate until then. Harmless —
-- they're keyed by UUID and only consume bytes.
DELETE FROM slack_pending_chat_pick
WHERE expires_at < now();
