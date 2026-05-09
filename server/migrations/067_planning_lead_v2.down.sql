DROP INDEX IF EXISTS planning_lead_priority_idx;

ALTER TABLE planning_lead
    DROP COLUMN IF EXISTS priority_lead,
    DROP COLUMN IF EXISTS lead_score,
    DROP COLUMN IF EXISTS lead_score_signals,
    DROP COLUMN IF EXISTS wont_fix,
    DROP COLUMN IF EXISTS milestones,
    DROP COLUMN IF EXISTS autopilot_routines,
    DROP COLUMN IF EXISTS starter_skills,
    DROP COLUMN IF EXISTS agent_roster;
