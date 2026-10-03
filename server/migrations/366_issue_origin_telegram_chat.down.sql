-- Restore the validated pre-Telegram constraint. This intentionally fails
-- closed while telegram_chat rows remain, because a rollback must not leave a
-- trusted constraint that existing rows violate.
ALTER TABLE issue DROP CONSTRAINT IF EXISTS issue_origin_type_check;
-- Kensink: keep 'integration' (fork migration 060_issue_origin_type_integration);
-- dropping it rejects GitHub-imported issues.
ALTER TABLE issue ADD CONSTRAINT issue_origin_type_check
    CHECK (origin_type IN ('autopilot', 'integration', 'quick_create', 'lark_chat', 'slack_chat', 'agent_create', 'dingtalk_chat', 'wecom_chat'))
    NOT VALID;
ALTER TABLE issue VALIDATE CONSTRAINT issue_origin_type_check;
