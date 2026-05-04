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
