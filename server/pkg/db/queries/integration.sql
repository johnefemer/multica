-- name: UpsertIntegrationConnection :one
-- Creates or replaces the connection for a given workspace+provider.
-- Called after OAuth callback completes.
INSERT INTO integration_connection (
    workspace_id, connected_by, provider,
    provider_account_id, provider_account_name, provider_account_avatar,
    access_token, refresh_token, token_expires_at, scope, meta, status
) VALUES (
    @workspace_id, @connected_by, @provider,
    @provider_account_id, @provider_account_name, @provider_account_avatar,
    @access_token, @refresh_token, @token_expires_at, @scope, @meta, 'active'
)
ON CONFLICT (workspace_id, provider) DO UPDATE SET
    connected_by            = EXCLUDED.connected_by,
    provider_account_id     = EXCLUDED.provider_account_id,
    provider_account_name   = EXCLUDED.provider_account_name,
    provider_account_avatar = EXCLUDED.provider_account_avatar,
    access_token            = EXCLUDED.access_token,
    refresh_token           = EXCLUDED.refresh_token,
    token_expires_at        = EXCLUDED.token_expires_at,
    scope                   = EXCLUDED.scope,
    meta                    = EXCLUDED.meta,
    status                  = 'active',
    error_message           = NULL,
    disconnected_at         = NULL,
    updated_at              = now()
RETURNING *;

-- name: GetIntegrationConnection :one
SELECT * FROM integration_connection
WHERE workspace_id = @workspace_id AND provider = @provider
  AND disconnected_at IS NULL;

-- name: ListIntegrationConnections :many
SELECT * FROM integration_connection
WHERE workspace_id = @workspace_id
  AND disconnected_at IS NULL
ORDER BY provider ASC;

-- name: DisconnectIntegration :one
UPDATE integration_connection
SET status          = 'active',
    disconnected_at = now(),
    updated_at      = now()
WHERE workspace_id = @workspace_id AND provider = @provider
  AND disconnected_at IS NULL
RETURNING *;

-- name: SetIntegrationError :exec
UPDATE integration_connection
SET status        = 'error',
    error_message = @error_message,
    updated_at    = now()
WHERE workspace_id = @workspace_id AND provider = @provider;

-- name: UpdateIntegrationMeta :one
-- Merges a JSONB patch into the meta column without touching other fields.
UPDATE integration_connection
SET meta       = meta || @patch::jsonb,
    updated_at = now()
WHERE workspace_id = @workspace_id AND provider = @provider
  AND disconnected_at IS NULL
RETURNING *;

-- name: InsertWebhookEvent :one
INSERT INTO integration_webhook_event (
    workspace_id, provider, delivery_id, event_type, payload
) VALUES (
    @workspace_id, @provider, @delivery_id, @event_type, @payload
)
ON CONFLICT (delivery_id) DO NOTHING
RETURNING *;

-- name: MarkWebhookEventProcessed :exec
UPDATE integration_webhook_event
SET processed_at = now(),
    error        = @error
WHERE id = @id;

-- name: GetWebhookEvent :one
SELECT * FROM integration_webhook_event WHERE id = @id;

-- name: GetIssueByIntegration :one
SELECT * FROM issue
WHERE workspace_id       = @workspace_id
  AND integration_provider    = @provider
  AND integration_repo        = @repo
  AND integration_external_id = @external_id;

-- name: CreateIntegrationIssue :one
-- Creates an issue that originated from an external provider (e.g. GitHub).
INSERT INTO issue (
    workspace_id, title, description, status, priority,
    creator_type, creator_id, origin_type,
    integration_provider, integration_external_id, integration_external_url,
    integration_repo, integration_synced_at
) VALUES (
    @workspace_id, @title, @description, @status, @priority,
    @creator_type, @creator_id, 'integration',
    @integration_provider, @integration_external_id, @integration_external_url,
    @integration_repo, now()
)
RETURNING *;

