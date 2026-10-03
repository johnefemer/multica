-- Revert to the pre-Lark issue_origin_type_check list. Any existing rows
-- with origin_type='lark_chat' would violate the rolled-back constraint;
-- the down migration assumes the operator has already deleted or relabeled
-- those rows. We keep this strict (no DROP NOT VALID dance) to preserve
-- the schema invariant downstream code relies on.
ALTER TABLE issue DROP CONSTRAINT IF EXISTS issue_origin_type_check;
-- Kensink: keep 'integration' (fork migration 060_issue_origin_type_integration);
-- dropping it rejects GitHub-imported issues.
ALTER TABLE issue ADD CONSTRAINT issue_origin_type_check
    CHECK (origin_type IN ('autopilot', 'integration', 'quick_create'));
