DROP INDEX IF EXISTS issue_integration_idx;
ALTER TABLE issue
    DROP COLUMN IF EXISTS integration_synced_at,
    DROP COLUMN IF EXISTS integration_repo,
    DROP COLUMN IF EXISTS integration_external_url,
    DROP COLUMN IF EXISTS integration_external_id,
    DROP COLUMN IF EXISTS integration_provider;
