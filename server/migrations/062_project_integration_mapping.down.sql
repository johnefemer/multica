DROP INDEX IF EXISTS idx_project_integration_repo;
ALTER TABLE project
    DROP COLUMN IF EXISTS integration_repo,
    DROP COLUMN IF EXISTS integration_provider;
