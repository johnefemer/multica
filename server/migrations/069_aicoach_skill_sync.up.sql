-- Provenance and sync state for skills pulled from an external registry.
--
-- Imported skills previously kept no record of where they came from, so a copy
-- froze at whatever the source said on import day and there was no way to tell
-- a mirrored skill from a hand-written one. These columns make an imported
-- skill re-syncable and let the sync worker poll only what it tracks.

ALTER TABLE skill ADD COLUMN IF NOT EXISTS source        TEXT NOT NULL DEFAULT 'local';
-- 'local' | 'aicoach' | 'clawhub' | 'skills_sh'
ALTER TABLE skill ADD COLUMN IF NOT EXISTS source_ref    TEXT;
-- registry-scoped identifier, e.g. 'aicoach/ab-test-setup'
ALTER TABLE skill ADD COLUMN IF NOT EXISTS source_url    TEXT;
ALTER TABLE skill ADD COLUMN IF NOT EXISTS source_rev    TEXT;
-- revision token last pulled; compared against the registry manifest
ALTER TABLE skill ADD COLUMN IF NOT EXISTS auto_sync     BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE skill ADD COLUMN IF NOT EXISTS synced_at     TIMESTAMPTZ;
ALTER TABLE skill ADD COLUMN IF NOT EXISTS sync_state    TEXT NOT NULL DEFAULT 'ok';
-- 'ok' | 'syncing' | 'error' | 'gone'
ALTER TABLE skill ADD COLUMN IF NOT EXISTS sync_error    TEXT;

-- A registry skill is mirrored at most once per workspace.
CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_source_ref
  ON skill (workspace_id, source, source_ref)
  WHERE source_ref IS NOT NULL;

-- The sync worker's only scan: tracked skills, oldest check first.
CREATE INDEX IF NOT EXISTS idx_skill_autosync
  ON skill (auto_sync, synced_at)
  WHERE auto_sync = TRUE;
