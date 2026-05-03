-- Map a project to an external integration repo (e.g. GitHub owner/repo).
-- This lets imports route into a specific project, and webhook events
-- look up the project for the repo before creating issues.
ALTER TABLE project
    ADD COLUMN integration_provider TEXT,
    ADD COLUMN integration_repo     TEXT;

-- One project per (workspace, provider, repo) tuple. Partial index so
-- projects without a mapping don't collide on (NULL, NULL).
CREATE UNIQUE INDEX idx_project_integration_repo
    ON project(workspace_id, integration_provider, integration_repo)
    WHERE integration_repo IS NOT NULL;
