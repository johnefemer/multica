ALTER TABLE issue DROP CONSTRAINT IF EXISTS issue_origin_type_check;
-- Kensink: keep 'integration' (fork migration 060_issue_origin_type_integration);
-- dropping it rejects GitHub-imported issues.
ALTER TABLE issue ADD CONSTRAINT issue_origin_type_check
    CHECK (origin_type IN ('autopilot', 'integration'));
