import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  MAX_TEAMMATE_EMAILS,
  type CaptureRequestBody,
  type CaptureResponse,
  type GeneratedPlan,
  type PlannerChatMessage,
  type RecommendedTier,
} from "@/lib/landing/team-planner/types";
import { dbQuery } from "@/lib/db";
import { generatePlanHash } from "@/lib/landing/team-planner/hash";
import { renderPlanEmail } from "@/lib/landing/team-planner/email-template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email validation — practical, not RFC-perfect.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME_LEN = 100;
const MAX_EMAIL_LEN = 254;
const MAX_PLAN_MARKDOWN = 50_000;
const MAX_CONVERSATION_TURNS = 60;

function isValidTier(t: unknown): t is RecommendedTier {
  return t === "solo" || t === "team" || t === "frontier";
}

function isValidPlan(p: unknown): p is GeneratedPlan {
  if (!p || typeof p !== "object") return false;
  const x = p as Record<string, unknown>;
  return (
    isValidTier(x.recommended_tier) &&
    typeof x.tier_why === "string" &&
    typeof x.plan_summary === "string" &&
    Array.isArray(x.gist_bullets) &&
    x.gist_bullets.every((b) => typeof b === "string") &&
    typeof x.plan_markdown === "string" &&
    x.plan_markdown.length > 0 &&
    x.plan_markdown.length <= MAX_PLAN_MARKDOWN
  );
}

function isValidConversation(c: unknown): c is PlannerChatMessage[] {
  if (!Array.isArray(c)) return false;
  if (c.length === 0 || c.length > MAX_CONVERSATION_TURNS) return false;
  return c.every((m) => {
    if (!m || typeof m !== "object") return false;
    const x = m as Record<string, unknown>;
    return (x.role === "user" || x.role === "agent") && typeof x.text === "string";
  });
}

function validateBody(body: unknown): CaptureRequestBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  if (typeof b.primary_name !== "string") return null;
  if (typeof b.primary_email !== "string") return null;
  if (!Array.isArray(b.cc_emails)) return null;

  const primary_name = b.primary_name.trim();
  const primary_email = b.primary_email.trim().toLowerCase();
  if (!primary_name || primary_name.length > MAX_NAME_LEN) return null;
  if (!EMAIL_RE.test(primary_email) || primary_email.length > MAX_EMAIL_LEN) {
    return null;
  }

  const cc_emails = b.cc_emails
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);

  if (cc_emails.length > MAX_TEAMMATE_EMAILS) return null;
  for (const e of cc_emails) {
    if (!EMAIL_RE.test(e) || e.length > MAX_EMAIL_LEN) return null;
    if (e === primary_email) return null; // dedupe — primary already gets one
  }

  if (!isValidPlan(b.plan)) return null;
  if (!isValidConversation(b.conversation)) return null;

  return {
    primary_name,
    primary_email,
    cc_emails,
    plan: b.plan,
    conversation: b.conversation,
  };
}

function appUrl(): string {
  return (
    process.env.AGENTHOST_APP_URL ||
    process.env.MULTICA_APP_URL ||
    "https://agenthost.kensink.com"
  ).replace(/\/$/, "");
}

interface PlanningLeadRow extends Record<string, unknown> {
  id: string;
  hash: string;
}

async function insertLead(
  body: CaptureRequestBody,
  attempts = 3,
): Promise<PlanningLeadRow> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const hash = generatePlanHash();
    try {
      const rows = await dbQuery<PlanningLeadRow>(
        `INSERT INTO planning_lead
           (hash, primary_email, primary_name, cc_emails,
            recommended_tier, project_summary, conversation, plan_markdown)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
         RETURNING id, hash`,
        [
          hash,
          body.primary_email,
          body.primary_name,
          body.cc_emails,
          body.plan.recommended_tier,
          body.plan.plan_summary,
          JSON.stringify(body.conversation),
          body.plan.plan_markdown,
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

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const r: CaptureResponse = { ok: false, error: "invalid json" };
    return NextResponse.json(r, { status: 400 });
  }

  const valid = validateBody(body);
  if (!valid) {
    const r: CaptureResponse = { ok: false, error: "invalid body shape" };
    return NextResponse.json(r, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    const r: CaptureResponse = { ok: false, error: "capture not configured" };
    return NextResponse.json(r, { status: 503 });
  }

  let lead: PlanningLeadRow;
  try {
    lead = await insertLead(valid);
  } catch (err) {
    console.error("[planner/capture] insert failed:", err);
    const r: CaptureResponse = {
      ok: false,
      error: "could not save the plan; please try again",
    };
    return NextResponse.json(r, { status: 503 });
  }

  const planUrl = `${appUrl()}/plan/${lead.hash}`;

  // Send emails best-effort — the lead is already saved, so a partial email
  // failure doesn't lose the data. The user always gets a hotlink back.
  const recipients = [
    {
      email: valid.primary_email,
      name: valid.primary_name,
      isPrimary: true,
    },
    ...valid.cc_emails.map((email) => ({
      email,
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
          primaryName: valid.primary_name,
          hotlinkUrl: planUrl,
          plan: valid.plan,
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
          `[planner/capture] resend failed for ${r.email}:`,
          err,
        );
      }
    }
  } else {
    console.warn(
      `[planner/capture] RESEND_API_KEY not set; skipping emails. Lead saved with hash ${lead.hash}.`,
    );
  }

  const ok: CaptureResponse = {
    ok: true,
    hash: lead.hash,
    plan_url: planUrl,
    recipients_emailed: emailedCount,
  };
  return NextResponse.json(ok);
}
