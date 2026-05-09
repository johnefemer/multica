import { dbQuery } from "@/lib/db";
import { isValidHashShape } from "./hash";
import type {
  AgentRosterEntry,
  AutopilotRoutine,
  PlanMilestones,
  RecommendedTier,
  StarterSkill,
} from "./types";

// Row shape from the planning_lead table — mirrors migrations 066 + 067.
// The JSONB columns added in 067 (agent_roster, starter_skills, …) are
// nullable so rows inserted before v2 still load cleanly. The page
// renderer treats null as "v1 plan, render markdown only".
export interface PlanningLead extends Record<string, unknown> {
  id: string;
  hash: string;
  primary_email: string;
  primary_name: string;
  cc_emails: string[];
  recommended_tier: RecommendedTier;
  project_summary: string;
  plan_markdown: string;
  edit_version: number;
  edited_at: string | null;
  created_at: string;
  // v2 columns — null on legacy rows.
  agent_roster: AgentRosterEntry[] | null;
  starter_skills: StarterSkill[] | null;
  autopilot_routines: AutopilotRoutine[] | null;
  milestones: PlanMilestones | null;
  wont_fix: string[] | null;
}

export async function getLeadByHash(
  hash: string,
): Promise<PlanningLead | null> {
  if (!isValidHashShape(hash)) return null;
  const rows = await dbQuery<PlanningLead>(
    `SELECT id, hash, primary_email, primary_name, cc_emails,
            recommended_tier, project_summary, plan_markdown,
            edit_version, edited_at, created_at,
            agent_roster, starter_skills, autopilot_routines,
            milestones, wont_fix
       FROM planning_lead
      WHERE hash = $1
      LIMIT 1`,
    [hash],
  );
  return rows[0] ?? null;
}
