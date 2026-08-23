-- name: GetChatUserLink :one
SELECT * FROM chat_user_link
WHERE workspace_id     = @workspace_id
  AND platform         = @platform
  AND external_user_id = @external_user_id;

-- name: CreateChatUserLink :one
INSERT INTO chat_user_link (
    workspace_id, user_id, platform,
    external_team_id, external_user_id,
    external_email, external_name
) VALUES (
    @workspace_id, @user_id, @platform,
    @external_team_id, @external_user_id,
    @external_email, @external_name
)
RETURNING *;

-- name: ListChatUserLinks :many
SELECT * FROM chat_user_link
WHERE workspace_id = @workspace_id
  AND platform     = @platform
ORDER BY linked_at ASC;

-- name: GetChatUserLinkByUser :one
-- Forward lookup: which external chat account belongs to this Agenthost user?
-- Used when Agenthost needs to reach a specific member on Slack (ownership
-- approval DMs, assignment pings).
SELECT * FROM chat_user_link
WHERE workspace_id = @workspace_id
  AND platform     = @platform
  AND user_id      = @user_id;
