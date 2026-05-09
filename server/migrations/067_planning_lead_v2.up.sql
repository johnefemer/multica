-- planning_lead v2 — extend the row with the structured plan payload the
-- v2 planner emits (agent roster, starter skills, autopilot routines,
-- milestones, won't-fix list) plus computed lead-score signals.
--
-- All new columns are nullable: rows inserted before this migration stay
-- valid. The page renderer treats missing columns as empty.

ALTER TABLE planning_lead
    ADD COLUMN agent_roster        JSONB,
    ADD COLUMN starter_skills      JSONB,
    ADD COLUMN autopilot_routines  JSONB,
    ADD COLUMN milestones          JSONB,
    ADD COLUMN wont_fix            JSONB,
    ADD COLUMN lead_score_signals  JSONB,
    ADD COLUMN lead_score          SMALLINT,
    ADD COLUMN priority_lead       BOOLEAN     NOT NULL DEFAULT false;

-- Sales triage queries hit (priority_lead, created_at). Partial index keeps
-- it tight — only priority leads are ever surfaced this way.
CREATE INDEX planning_lead_priority_idx
    ON planning_lead (priority_lead, created_at DESC)
    WHERE priority_lead = true;
