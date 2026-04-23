-- Generic OAuth connection table used by all integrations (GitHub, Slack, Notion, …).
-- One active connection per provider per workspace.
CREATE TABLE integration_connection (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id            UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    connected_by            UUID        NOT NULL REFERENCES "user"(id),
    provider                TEXT        NOT NULL,           -- 'github' | 'slack' | 'notion' | 'email'
    provider_account_id     TEXT        NOT NULL,           -- provider's user/org/bot ID
    provider_account_name   TEXT,                           -- login, team name, etc.
    provider_account_avatar TEXT,
    access_token            TEXT        NOT NULL,           -- OAuth access token
    refresh_token           TEXT,                           -- for providers that issue refresh tokens
    token_expires_at        TIMESTAMPTZ,                    -- NULL = non-expiring
    scope                   TEXT,                           -- granted OAuth scopes
    meta                    JSONB       NOT NULL DEFAULT '{}', -- provider-specific metadata
    status                  TEXT        NOT NULL DEFAULT 'active', -- 'active' | 'expired' | 'error'
    error_message           TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    disconnected_at         TIMESTAMPTZ,
    UNIQUE(workspace_id, provider)
);

-- Idempotency log for all inbound webhook events from any provider.
CREATE TABLE integration_webhook_event (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID        REFERENCES workspace(id) ON DELETE SET NULL,
    provider     TEXT        NOT NULL,
    delivery_id  TEXT        NOT NULL UNIQUE, -- X-GitHub-Delivery, etc.
    event_type   TEXT        NOT NULL,
    payload      JSONB       NOT NULL,
    processed_at TIMESTAMPTZ,
    error        TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
