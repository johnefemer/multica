// Shared types for the /build-your-team chat planner. Used by both the
// route handler at app/api/landing/team-planner/chat and the client at
// features/landing/components/build-your-team-page-client.

// Tier IDs match apps/web/features/landing/components/pricing-page-client.tsx
// so the planner's recommendation keys directly into the live pricing tiers.
export type RecommendedTier = "solo" | "team" | "frontier";

export interface PlannerChatMessage {
  role: "user" | "agent";
  text: string;
}

export interface ChatRequestBody {
  messages: PlannerChatMessage[];
}

export interface GeneratedPlan {
  recommended_tier: RecommendedTier;
  tier_why: string;
  plan_summary: string;
  gist_bullets: string[];
  plan_markdown: string;
}

// NDJSON stream events. One JSON object per line.
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call_started"; name: string }
  | { type: "plan_ready"; plan: GeneratedPlan }
  | { type: "done" }
  | { type: "error"; message: string; status?: number };

// =============================================================================
// Capture — POST /api/landing/team-planner/capture
// =============================================================================

export const MAX_TEAMMATE_EMAILS = 3;

export interface CaptureRequestBody {
  primary_name: string;
  primary_email: string;
  cc_emails: string[]; // 0..MAX_TEAMMATE_EMAILS
  plan: GeneratedPlan;
  // Full conversation history that produced the plan, including the seeded
  // greeting. The seed is included here (unlike the chat endpoint) so the
  // saved transcript is complete for support / future fine-tuning.
  conversation: PlannerChatMessage[];
}

export interface CaptureResponseSuccess {
  ok: true;
  hash: string; // 10-char base62
  plan_url: string; // absolute URL to /plan/<hash>
  recipients_emailed: number;
}

export interface CaptureResponseFailure {
  ok: false;
  error: string;
}

export type CaptureResponse = CaptureResponseSuccess | CaptureResponseFailure;
