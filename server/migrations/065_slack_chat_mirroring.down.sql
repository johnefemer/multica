DROP TABLE IF EXISTS slack_pending_chat_pick;
ALTER TABLE chat_message DROP COLUMN IF EXISTS external_message_id;
DROP INDEX IF EXISTS chat_session_external_thread_idx;
ALTER TABLE chat_session
    DROP COLUMN IF EXISTS external_thread_id,
    DROP COLUMN IF EXISTS external_channel_id,
    DROP COLUMN IF EXISTS external_team_id,
    DROP COLUMN IF EXISTS source;
