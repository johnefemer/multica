-- name: ListChatChannelBindings :many
SELECT * FROM chat_channel_binding
WHERE workspace_id = @workspace_id
  AND platform     = @platform
ORDER BY created_at ASC;

-- name: GetChatChannelBindingByChannel :one
SELECT * FROM chat_channel_binding
WHERE platform            = @platform
  AND external_channel_id = @external_channel_id;

-- name: CreateChatChannelBinding :one
INSERT INTO chat_channel_binding (
    workspace_id, platform, external_team_id,
    external_channel_id, external_channel_name, created_by
) VALUES (
    @workspace_id, @platform, @external_team_id,
    @external_channel_id, @external_channel_name, @created_by
)
RETURNING *;

-- name: DeleteChatChannelBinding :exec
DELETE FROM chat_channel_binding
WHERE id           = @id
  AND workspace_id = @workspace_id;

-- name: UpdateChatChannelBindingFilters :one
-- Sets which workspace events post into this channel. An empty array means
-- "no notifications"; the outbound listener treats it as opt-out.
UPDATE chat_channel_binding
SET event_filters = @event_filters
WHERE id = @id AND workspace_id = @workspace_id
RETURNING *;

-- name: UpdateChatChannelBindingDefaultAgent :one
-- Sets (or clears, when NULL) the agent used for new threads in this channel,
-- which lets the app_mention handler skip the ephemeral agent picker.
UPDATE chat_channel_binding
SET default_agent_id = sqlc.narg('default_agent_id')
WHERE id = @id AND workspace_id = @workspace_id
RETURNING *;

-- name: ListChatChannelBindingsForNotify :many
-- All bindings in a workspace whose event_filters include the given event
-- type. Drives outbound issue notifications.
SELECT * FROM chat_channel_binding
WHERE workspace_id = @workspace_id
  AND platform     = @platform
  AND @event_type::text = ANY(event_filters)
ORDER BY created_at ASC;
