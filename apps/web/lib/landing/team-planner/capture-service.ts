import { Resend } from "resend";
import { dbQuery } from "@/lib/db";
import { generatePlanHash } from "./hash";
import { renderPlanEmail } from "./email-template";
import type { GeneratedPlan, PlannerChatMessage } from "./types";

// =============================================================================
// Capture service — shared between:
//   - POST /api/landing/team-planner/capture  (legacy form-based path)
//   - POST /api/landing/team-planner/chat     (agent's submit_capture tool)
//
// The HTTP route handlers do their own input validation (different shapes:
// one validates an external request body, the other trusts the LLM's strict
// tool input). Both then call executeCapture() with a normalised input.
// =============================================================================

export interface CaptureInput {
  primary_name: string;
  primary_email: string;
  cc_emails: string[];
  plan: GeneratedPlan;
  conversation: PlannerChatMessage[];
}

export interface CaptureResult {
  hash: string;
  plan_url: string;
  recipients_emailed: number;
}

interface PlanningLeadInsertRow extends Record<string, unknown> {
  id: string;
  hash: string;
}

function appUrl(): string {
  return (
    process.env.AGENTHOST_APP_URL ||
    process.env.MULTICA_APP_URL ||
    "https://agenthost.kensink.com"
  ).replace(/\/$/, "");
}

async function insertLead(
  input: CaptureInput,
  attempts = 3,
): Promise<PlanningLeadInsertRow> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const hash = generatePlanHash();
    try {
      const rows = await dbQuery<PlanningLeadInsertRow>(
        `INSERT INTO planning_lead
           (hash, primary_email, primary_name, cc_emails,
            recommended_tier, project_summary, conversation, plan_markdown)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING id, hash`,
        [
          hash,
          input.primary_email,
          input.primary_name,
          input.cc_emails,
          input.plan.recommended_tier,
          input.plan.plan_summary,
          JSON.stringify(input.conversation),
          input.plan.plan_markdown,
        ],
      );
      const row = rows[0];
      if (!row) throw new Error("planning_lead insert returned no row");
      return row;
    } catch (err: unknown) {
      // 23505 = unique_violation. With 60 bits of entropy collisions are
      // implausible; if one happens, just generate a fresh hash and retry.
      const pgErr = err as { code?: string };
      if (pgErr?.code === "23505" && i < attempts - 1) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error("hash collision retries exhausted");
}

export async function executeCapture(
  input: CaptureInput,
): Promise<CaptureResult> {
  const lead = await insertLead(input);
  const planUrl = `${appUrl()}/plan/${lead.hash}`;

  const recipients = [
    {
      email: input.primary_email,
      name: input.primary_name,
      isPrimary: true,
    },
    ...input.cc_emails.map((email) => ({
      email,
      // Best-effort name from local-part; the email body greets these
      // recipients with a "your teammate added you" line anyway.
      name: email.split("@")[0] || email,
      isPrimary: false,
    })),
  ];

  let emailedCount = 0;

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "Agenthost <noreply@kensink.com>";

    for (const r of recipients) {
      try {
        const rendered = renderPlanEmail({
          recipientName: r.name,
          isPrimary: r.isPrimary,
          primaryName: input.primary_name,
          hotlinkUrl: planUrl,
          plan: input.plan,
        });
        await resend.emails.send({
          from: fromEmail,
          to: r.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        emailedCount++;
      } catch (err) {
        console.error(
          `[capture-service] resend failed for ${r.email}:`,
          err,
        );
      }
    }
  } else {
    console.warn(
      `[capture-service] RESEND_API_KEY not set; skipping emails. Lead saved with hash ${lead.hash}.`,
    );
  }

  return {
    hash: lead.hash,
    plan_url: planUrl,
    recipients_emailed: emailedCount,
  };
}
