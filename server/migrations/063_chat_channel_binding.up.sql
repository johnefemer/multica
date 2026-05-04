-- Channel binding: maps a chat-platform channel (Slack today; Discord/Teams later)
-- to exactly one Agenthost workspace. Inbound events use this table to resolve
-- which workspace context a message belongs to.
--
-- Cardinality:
--   - A channel can route to at most one workspace (UNIQUE on platform+channel_id).
--   - A workspace can host many bindings (different channels routing in).
--
-- default_agent_id and event_filters columns exist now even though Phase 2 ships
-- no UI for them — they're load-bearing in Phases 4 (chat picker skip) and 6
-- (notification opt-in). Adding them later would mean a churny second migration.
CREATE TABLE chat_channel_binding (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID        NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    platform              TEXT        NOT NULL,                      -- 'slack' | 'discord' | 'teams'
    external_team_id      TEXT        NOT NULL,                      -- Slack team id (T0123...)
    external_channel_id   TEXT        NOT NULL,                      -- Slack channel id (C0123...)
    external_channel_name TEXT,                                      -- denormalized for UI; refresh on rename
    default_agent_id      UUID        REFERENCES agent(id) ON DELETE SET NULL,
    event_filters         TEXT[]      NOT NULL DEFAULT '{}',         -- which workspace events post here (Phase 6)
    created_by            UUID        REFERENCES "user"(id),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (platform, external_channel_id)
);

CREATE INDEX idx_chat_channel_binding_workspace
    ON chat_channel_binding (workspace_id);
