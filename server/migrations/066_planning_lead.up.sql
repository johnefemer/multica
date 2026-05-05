-- planning_lead — leads captured from the /build-your-team marketing page.
--
-- Each row represents one user submitting the email-capture form after the
-- Agenthost Planner generated a plan for them. Recipients (primary + up to
-- 3 teammates) all receive the same hotlink at /plan/<hash>.
--
-- The hash is a 10-char URL-safe random token that gates access to the
-- /plan/<hash> page (page is noindex + 404s on missing hash).

CREATE TABLE planning_lead (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 10-char base62 token used in the public hotlink URL. Unique by index
    -- below — collision odds are negligible, retry on the unlikely 23505.
    hash              TEXT        NOT NULL,

    primary_email     TEXT        NOT NULL,
    primary_name      TEXT        NOT NULL,

    -- Up to 3 additional recipients. Empty array if solo.
    cc_emails         TEXT[]      NOT NULL DEFAULT '{}',

    -- Tier the planner recommended. Loosely typed (TEXT) — enum lives in
    -- the TypeScript types and the planner system prompt; we don't want to
    -- migrate this column every time the pricing page renames a tier.
    recommended_tier  TEXT        NOT NULL,

    project_summary   TEXT        NOT NULL,

    -- Full transcript of the chat that led to the plan (debugging, support,
    -- future model fine-tuning). Stored as the array we'd send back to
    -- Anthropic, plus the seeded greeting prepended.
    conversation      JSONB       NOT NULL,

    plan_markdown     TEXT        NOT NULL,

    -- Phase-2 edit support. v1 leaves edited_at NULL and edit_version=1;
    -- the editable-plan PR will bump these.
    edit_version      INT         NOT NULL DEFAULT 1,
    edited_at         TIMESTAMPTZ,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX planning_lead_hash_idx ON planning_lead (hash);
CREATE INDEX planning_lead_primary_email_idx ON planning_lead (primary_email);
CREATE INDEX planning_lead_created_at_idx ON planning_lead (created_at DESC);
