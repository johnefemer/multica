import { NextResponse } from "next/server";
import {
  MAX_TEAMMATE_EMAILS,
  type CaptureRequestBody,
  type CaptureResponse,
  type GeneratedPlan,
  type PlannerChatMessage,
  type RecommendedTier,
} from "@/lib/landing/team-planner/types";
import { executeCapture } from "@/lib/landing/team-planner/capture-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// =============================================================================
// Legacy form-based capture endpoint.
//
// The chat planner now collects name/email/teammates conversationally and
// fires the submit_capture tool inside POST /api/landing/team-planner/chat.
// This route stays as a fallback / backward-compat surface — no current
// client calls it, but we don't want a future caller to silently 404. All
// real DB + email work lives in lib/landing/team-planner/capture-service.
// =============================================================================

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
    if (e === primary_email) return null;
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

  try {
    const result = await executeCapture(valid);
    const ok: CaptureResponse = {
      ok: true,
      hash: result.hash,
      plan_url: result.plan_url,
      recipients_emailed: result.recipients_emailed,
    };
    return NextResponse.json(ok);
  } catch (err) {
    console.error("[planner/capture] executeCapture failed:", err);
    const r: CaptureResponse = {
      ok: false,
      error: "could not save the plan; please try again",
    };
    return NextResponse.json(r, { status: 503 });
  }
}
