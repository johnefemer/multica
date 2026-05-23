import { Resend } from "resend";
import { dbQuery } from "@/lib/db";
import { generatePlanHash } from "./hash";
import { renderPlanEmail } from "./email-template";
import type {
  GeneratedPlan,
  LeadScoreSignals,
  PlannerChatMessage,
} from "./types";

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

// Lead score is capped at 100; >= 60 flips priority_lead to true and fires
// the Slack webhook. Rubric is documented in generate-plan.schema.json so
// the planner prompt and the server can be reviewed against the same source.
const PRIORITY_THRESHOLD = 60;

export function computeLeadScore(signals: LeadScoreSignals): number {
  let score = 0;

  switch (signals.team_size_band) {
    case "solo":
      score -= 30;
      break;
    case "small":
      score += 10;
      break;
    case "mid":
      score += 20;
      break;
    case "large":
      score += 30;
      break;
  }

  switch (signals.stack_maturity) {
    case "production":
      score += 15;
      break;
    case "scaling":
      score += 25;
      break;
    // 'early' adds nothing
  }

  switch (signals.delegation_specificity) {
    case "moderate":
      score += 10;
      break;
    case "high":
      score += 20;
      break;
    // 'vague' adds nothing
  }

  if (signals.compliance_signal) score += 15;

  if (score < 0) return 0;
  if (score > 100) return 100;
  return score;
}

function appUrl(): string {
  return (
    process.env.AGENTHOST_APP_URL ||
    process.env.MULTICA_APP_URL ||
    "https://agenthost.pro"
  ).replace(/\/$/, "");
}

async function insertLead(
  input: CaptureInput,
  leadScore: number,
  priorityLead: boolean,
  attempts = 3,
): Promise<PlanningLeadInsertRow> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const hash = generatePlanHash();
    try {
      const rows = await dbQuery<PlanningLeadInsertRow>(
        `INSERT INTO planning_lead
           (hash, primary_email, primary_name, cc_emails,
            recommended_tier, project_summary, conversation, plan_markdown,
            agent_roster, starter_skills, autopilot_routines,
            milestones, wont_fix, lead_score_signals,
            lead_score, priority_lead)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8,
                 $9::jsonb, $10::jsonb, $11::jsonb,
                 $12::jsonb, $13::jsonb, $14::jsonb,
                 $15, $16)
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
          JSON.stringify(input.plan.agent_roster),
          JSON.stringify(input.plan.starter_skills),
          JSON.stringify(input.plan.autopilot_routines),
          JSON.stringify(input.plan.milestones),
          JSON.stringify(input.plan.wont_fix),
          JSON.stringify(input.plan.lead_score_signals),
          leadScore,
          priorityLead,
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

// Fire-and-forget Slack notification on priority leads. We don't block the
// capture response on this — if Slack is down the lead is still saved and
// emailed; the sales team picks it up from the priority-leads view instead.
async function notifyPriorityLead(
  hash: string,
  input: CaptureInput,
  leadScore: number,
): Promise<void> {
  const webhookUrl = process.env.SLACK_PRIORITY_LEAD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const planUrl = `${appUrl()}/plan/${hash}`;
  const signals = input.plan.lead_score_signals;
  const summary = input.plan.plan_summary.split(".")[0] ?? "";

  const text =
    `*New priority lead* — score ${leadScore}\n` +
    `*${input.primary_name}* <${input.primary_email}>\n` +
    `${summary}\n` +
    `Tier: \`${input.plan.recommended_tier}\` · Team: \`${signals.team_size_band}\` · ` +
    `Stack: \`${signals.stack_maturity}\` · Delegation: \`${signals.delegation_specificity}\`` +
    `${signals.compliance_signal ? " · *compliance*" : ""}\n` +
    `<${planUrl}|Open plan →>`;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("[capture-service] slack webhook failed:", err);
  }
}

export async function executeCapture(
  input: CaptureInput,
): Promise<CaptureResult> {
  const leadScore = computeLeadScore(input.plan.lead_score_signals);
  const priorityLead = leadScore >= PRIORITY_THRESHOLD;

  const lead = await insertLead(input, leadScore, priorityLead);
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

  if (priorityLead) {
    await notifyPriorityLead(lead.hash, input, leadScore);
  }

  return {
    hash: lead.hash,
    plan_url: planUrl,
    recipients_emailed: emailedCount,
  };
}
