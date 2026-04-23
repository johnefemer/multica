-- Add integration sync columns to issue so any provider (GitHub, Linear, …)
-- can link an Agenthost issue to its external counterpart.
ALTER TABLE issue
    ADD COLUMN integration_provider     TEXT,
    ADD COLUMN integration_external_id  TEXT,
    ADD COLUMN integration_external_url TEXT,
    ADD COLUMN integration_repo         TEXT,
    ADD COLUMN integration_synced_at    TIMESTAMPTZ;

-- Prevents duplicate imports for the same external issue.
CREATE UNIQUE INDEX issue_integration_idx
    ON issue(workspace_id, integration_provider, integration_repo, integration_external_id)
    WHERE integration_external_id IS NOT NULL;
