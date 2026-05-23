import type { GeneratedPlan, RecommendedTier } from "./types";

// Email is rendered as inline-styled HTML — no <style> tags, no class
// selectors. Most email clients (Gmail, Outlook, Apple Mail) strip <style>
// blocks or ignore unknown classes, so every visual rule has to live on
// the element it applies to.
//
// Recipients also receive a plain-text fallback (`text` field on Resend's
// SendEmail params) — generated from the markdown summary via
// buildPlainText below.

const TIER_COPY: Record<RecommendedTier, { name: string; oneLiner: string }> = {
  solo: {
    name: "SOLO_FOUNDER",
    oneLiner: "One-time setup, pay-as-you-go usage, your provider keys.",
  },
  team: {
    name: "TEAM_OPERATOR",
    oneLiner: "Flat per-workspace monthly, BYOK with unlimited tokens.",
  },
  frontier: {
    name: "FRONTIER_FIRM",
    oneLiner: "Custom pricing, dedicated infra, compliance support.",
  },
};

const CORE_VITALS = [
  {
    h: "AI agents as first-class teammates",
    p: "Assign issues to agents the same way you assign to humans. They claim work, post replies, change status — all on the audit trail.",
  },
  {
    h: "Local runtimes — your code stays on your machine",
    p: "Connect Claude Code, Codex, Cursor, or Gemini through a small daemon you run yourself. Agenthost orchestrates; your machine executes.",
  },
  {
    h: "Workspace Context + Inbox + Autopilot",
    p: "Shared context every agent reads. Inbox for @mentions and assignments. Autopilot turns prompts + schedules into auto-created issues.",
  },
];

export interface EmailRenderInput {
  recipientName: string;
  // The "you" — the planner who submitted. CC'd teammates get an
  // adjusted greeting in their copy.
  isPrimary: boolean;
  primaryName: string;
  hotlinkUrl: string;
  plan: GeneratedPlan;
}

interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

// Lightweight HTML escape — the strings going through here are user-supplied
// (recipient name, project summary, gist bullets) so we don't trust any of
// them to be HTML-safe.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderPlanEmail(input: EmailRenderInput): RenderedEmail {
  const { recipientName, isPrimary, primaryName, hotlinkUrl, plan } = input;
  const tier = TIER_COPY[plan.recommended_tier];
  const greetingName = recipientName.trim() || "there";
  const greeting = isPrimary
    ? `Hi ${esc(greetingName)},`
    : `Hi ${esc(greetingName)} — ${esc(primaryName)} put together an AI development plan with the Agenthost Planner and added you to the thread.`;

  // ── Subject ────────────────────────────────────────────────────────────
  const projectFirstLine = plan.plan_summary.split(".")[0]?.slice(0, 80) ?? "";
  const subject = isPrimary
    ? `Your Agenthost plan — ${tier.name.replace(/_/g, " ")}`
    : `${primaryName}'s Agenthost plan${projectFirstLine ? ` — ${projectFirstLine}` : ""}`;

  // ── HTML body ──────────────────────────────────────────────────────────
  const gistItems = plan.gist_bullets
    .map(
      (b) =>
        `<li style="margin: 0 0 8px 0; line-height: 1.55;">${esc(b)}</li>`,
    )
    .join("");

  const vitalsBlocks = CORE_VITALS.map(
    (v) => `
      <div style="margin: 0 0 16px 0;">
        <div style="font-weight: 600; color: #111; margin-bottom: 4px;">${esc(v.h)}</div>
        <div style="color: #555; line-height: 1.5;">${esc(v.p)}</div>
      </div>
    `,
  ).join("");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin: 0; padding: 0; background: #f4f4f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f4f4f4; padding: 32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background: #ffffff; border-radius: 4px; overflow: hidden;">

            <!-- Brand band -->
            <tr>
              <td style="background: #111; color: #fff; padding: 14px 24px; font-size: 12px; letter-spacing: 2px; font-weight: 600;">
                AGENTHOST
              </td>
            </tr>

            <!-- Greeting + summary -->
            <tr>
              <td style="padding: 28px 24px 12px 24px;">
                <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.55; color: #111;">${greeting}</p>
                <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 1.55; color: #333;">
                  Here's the AI development plan we put together.
                </p>
                <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.55; color: #333;">
                  ${esc(plan.plan_summary)}
                </p>
                <div style="background: #f6f6f3; border-left: 3px solid #c2410c; padding: 12px 16px; margin: 0 0 24px 0; font-size: 14px; color: #333;">
                  <strong>Recommended tier:</strong> ${esc(tier.name)} — ${esc(plan.tier_why)}
                </div>
              </td>
            </tr>

            <!-- Plan highlights -->
            <tr>
              <td style="padding: 0 24px 8px 24px;">
                <div style="font-size: 11px; letter-spacing: 1.5px; color: #c2410c; font-weight: 600; margin-bottom: 12px;">
                  // PLAN HIGHLIGHTS
                </div>
                <ul style="margin: 0 0 24px 0; padding: 0 0 0 20px; font-size: 14px; color: #222;">
                  ${gistItems}
                </ul>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td align="center" style="padding: 0 24px 32px 24px;">
                <a href="${esc(hotlinkUrl)}"
                   style="display: inline-block; background: #c2410c; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 14px 28px; border-radius: 4px; letter-spacing: 0.5px;">
                  Open your full plan →
                </a>
                <div style="margin-top: 10px; font-size: 12px; color: #888;">
                  Private link · do not share publicly
                </div>
              </td>
            </tr>

            <!-- Divider -->
            <tr>
              <td style="border-top: 1px solid #e5e5e5; padding: 24px 24px 8px 24px;">
                <div style="font-size: 11px; letter-spacing: 1.5px; color: #888; font-weight: 600; margin-bottom: 16px;">
                  // ABOUT AGENTHOST
                </div>
                ${vitalsBlocks}
              </td>
            </tr>

            <!-- Reply CTA -->
            <tr>
              <td style="padding: 16px 24px 28px 24px; background: #f6f6f3;">
                <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #333;">
                  <strong>Reply to this email</strong> and the Agenthost team will help you deploy your AI Team —
                  pricing questions, infrastructure setup, agent configuration. We read every reply.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 16px 24px; font-size: 11px; color: #999; text-align: center;">
                Agenthost · agenthost.pro
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  // ── Plain-text fallback ────────────────────────────────────────────────
  const textGreeting = isPrimary
    ? `Hi ${greetingName},`
    : `Hi ${greetingName} — ${primaryName} put together an AI development plan with the Agenthost Planner and added you to the thread.`;
  const text = [
    textGreeting,
    "",
    "Here's the AI development plan we put together.",
    "",
    plan.plan_summary,
    "",
    `Recommended tier: ${tier.name} — ${plan.tier_why}`,
    "",
    "PLAN HIGHLIGHTS",
    ...plan.gist_bullets.map((b) => `  - ${b}`),
    "",
    `Open your full plan: ${hotlinkUrl}`,
    "(Private link · do not share publicly)",
    "",
    "ABOUT AGENTHOST",
    ...CORE_VITALS.map((v) => `  • ${v.h}\n    ${v.p}`),
    "",
    "Reply to this email and the Agenthost team will help you deploy your AI Team — pricing questions, infrastructure setup, agent configuration.",
    "",
    "— Agenthost · agenthost.pro",
  ].join("\n");

  return { subject, html, text };
}
