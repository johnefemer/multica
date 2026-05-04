-- Slack thread ↔ chat_session bridge (Phase 4 of #18).
--
-- Schema additions, all backwards-compatible: existing web chat sessions
-- get source='web' via the column default and the new columns are NULL.

ALTER TABLE chat_session
    ADD COLUMN source              TEXT NOT NULL DEFAULT 'web'
        CHECK (source IN ('web', 'slack', 'discord', 'teams')),
    ADD COLUMN external_team_id    TEXT,
    ADD COLUMN external_channel_id TEXT,
    ADD COLUMN external_thread_id  TEXT;

-- One Slack thread maps to exactly one chat_session. Partial index lets
-- existing web sessions (NULL thread_id) coexist without colliding.
CREATE UNIQUE INDEX chat_session_external_thread_idx
    ON chat_session (source, external_thread_id)
    WHERE external_thread_id IS NOT NULL;

-- Slack message timestamp of the relayed assistant reply. Used to update
-- or thread later replies. Nullable — web messages don't have one.
ALTER TABLE chat_message
    ADD COLUMN external_message_id TEXT;

-- Pending agent-picker state for the multi-agent case. The user's mention
-- text doesn't fit in a Block Kit static_select value (75 chars), so we
-- stash it here keyed by a UUID and put the UUID in the picker option
-- value. On selection the row is consumed; on 10-min expiry a periodic
-- cleanup (Phase 4 follow-up) drops it.
CREATE TABLE slack_pending_chat_pick (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id        UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    creator_id          UUID        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    external_team_id    TEXT        NOT NULL,
    external_channel_id TEXT        NOT NULL,
    external_thread_id  TEXT        NOT NULL,
    initial_text        TEXT        NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_slack_pending_chat_pick_thread
    ON slack_pending_chat_pick (external_channel_id, external_thread_id);
