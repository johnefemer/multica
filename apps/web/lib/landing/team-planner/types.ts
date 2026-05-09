// Shared types for the /build-your-team chat planner. Used by both the
// route handler at app/api/landing/team-planner/chat and the client at
// features/landing/components/build-your-team-page-client.

// Tier IDs match apps/web/features/landing/components/pricing-page-client.tsx
// so the planner's recommendation keys directly into the live pricing tiers.
export type RecommendedTier = "solo" | "team" | "frontier";

// Canonical runtime IDs — matches the Go backend at server/pkg/agent/agent.go.
// The planner emits one of these per agent in the roster; the daemon
// detects the matching CLI and registers it as a runtime.
export type SuggestedCli =
  | "claude"
  | "codex"
  | "cursor"
  | "gemini"
  | "opencode"
  | "openclaw"
  | "hermes"
  | "pi"
  | "copilot"
  | "kimi";

export interface PlannerChatMessage {
  role: "user" | "agent";
  text: string;
}

export interface ChatRequestBody {
  messages: PlannerChatMessage[];
}

// One named agent in the proposed roster. Each entry maps to one Q5 pain
// the user surfaced during the interview.
export interface AgentRosterEntry {
  name: string;
  suggested_cli: SuggestedCli;
  job_one_liner: string;
  starter_skills: string[]; // 2–3 .md filenames
}

export interface StarterSkill {
  filename: string; // kebab-case, .md
  purpose: string;
}

export interface AutopilotRoutine {
  schedule: string; // human-readable, not raw cron
  job: string;
}

export interface PlanMilestones {
  week_1: string;
  month_1: string;
  quarter_1: string;
}

export type TeamSizeBand = "solo" | "small" | "mid" | "large";
export type StackMaturity = "early" | "production" | "scaling";
export type DelegationSpecificity = "vague" | "moderate" | "high";

export interface LeadScoreSignals {
  team_size_band: TeamSizeBand;
  stack_maturity: StackMaturity;
  delegation_specificity: DelegationSpecificity;
  compliance_signal: boolean;
}

export interface GeneratedPlan {
  // Tier + summary fields drive the page hero, gist card, and email preview.
  recommended_tier: RecommendedTier;
  tier_why: string;
  plan_summary: string;
  gist_bullets: string[];
  plan_markdown: string;

  // v2 structured payload — rendered as cards on the plan page and used
  // by the server to compute the lead score.
  what_i_heard: string;
  agent_roster: AgentRosterEntry[];
  starter_skills: StarterSkill[];
  autopilot_routines: AutopilotRoutine[];
  milestones: PlanMilestones;
  wont_fix: string[];
  lead_score_signals: LeadScoreSignals;
}

// NDJSON stream events. One JSON object per line.
export type StreamEvent =
  | { type: "delta"; text: string }
  | { type: "tool_call_started"; name: string }
  | { type: "plan_ready"; plan: GeneratedPlan }
  | { type: "capture_started" }
  | {
      type: "capture_completed";
      hash: string;
      plan_url: string;
      recipients_emailed: number;
    }
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
