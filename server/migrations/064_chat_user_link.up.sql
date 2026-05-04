-- Identity bridge: external chat user (Slack today; Discord/Teams later)
-- ↔ Agenthost user, scoped to a workspace.
--
-- Cardinality:
--   - One Slack user maps to one Agenthost user per workspace
--     (UNIQUE(workspace_id, platform, external_user_id)).
--   - One Agenthost user has at most one chat link per platform per workspace
--     (UNIQUE(workspace_id, user_id, platform)).
--
-- The link is created lazily on first inbound contact in a bound channel —
-- see messaging/identity.go for the resolution algorithm.
CREATE TABLE chat_user_link (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id           UUID        NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    platform          TEXT        NOT NULL,             -- 'slack' | 'discord' | 'teams'
    external_team_id  TEXT        NOT NULL,             -- Slack team id (T0123...)
    external_user_id  TEXT        NOT NULL,             -- Slack user id (U0123...)
    external_email    TEXT,                             -- snapshot at link time, for audit
    external_name     TEXT,                             -- snapshot at link time, for audit
    linked_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, platform, external_user_id),
    UNIQUE (workspace_id, user_id, platform)
);

CREATE INDEX idx_chat_user_link_external
    ON chat_user_link (platform, external_user_id);

-- Per-workspace switch: gate seamless auto-onboarding from Slack profiles.
-- Default true so first-touch users land in the workspace without admin
-- intervention; flip to false from settings to require an explicit invite.
ALTER TABLE workspace
    ADD COLUMN chat_auto_onboard BOOLEAN NOT NULL DEFAULT true;
