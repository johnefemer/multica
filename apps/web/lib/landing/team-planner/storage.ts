import { dbQuery } from "@/lib/db";
import { isValidHashShape } from "./hash";
import type { RecommendedTier } from "./types";

// Row shape from the planning_lead table — mirrors migration 066. The page
// renderer at /plan/<hash> is the only consumer for now; the capture
// endpoint owns inserts.
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
}

export async function getLeadByHash(
  hash: string,
): Promise<PlanningLead | null> {
  if (!isValidHashShape(hash)) return null;
  const rows = await dbQuery<PlanningLead>(
    `SELECT id, hash, primary_email, primary_name, cc_emails,
            recommended_tier, project_summary, plan_markdown,
            edit_version, edited_at, created_at
       FROM planning_lead
      WHERE hash = $1
      LIMIT 1`,
    [hash],
  );
  return rows[0] ?? null;
}
