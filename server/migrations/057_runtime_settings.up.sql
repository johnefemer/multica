-- Add user-controlled settings column to agent_runtime.
-- Intentionally separate from `metadata` (daemon-controlled) so the daemon's
-- UpsertAgentRuntime cannot overwrite user-configured values (e.g. PATs).
ALTER TABLE agent_runtime
    ADD COLUMN settings JSONB NOT NULL DEFAULT '{}';
