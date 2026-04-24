-- Allow 'integration' as an origin_type for issues imported from external
-- providers (GitHub, Linear, ...). Previously the CHECK constraint added by
-- migration 042 only permitted 'autopilot', which caused all integration
-- imports to fail silently with a check_violation.
ALTER TABLE issue DROP CONSTRAINT IF EXISTS issue_origin_type_check;
ALTER TABLE issue ADD CONSTRAINT issue_origin_type_check
    CHECK (origin_type IN ('autopilot', 'integration'));
