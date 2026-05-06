// Server component — no "use client". Renders the canonical full plan
// page at /plan/<hash>. Self-contained: no OpsSection / OpsContainer /
// OpsSectionHead wrappers, no tokens.css, no Google font. Just standard
// Tailwind with explicit colours and the neon accent.

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlanPageShell, PLAN_ACCENT } from "./plan-page-shell";
import type { PlanningLead } from "@/lib/landing/team-planner/storage";

const CONTACT_EMAIL = "agenthost@kensink.com";

const TIER_LABEL: Record<PlanningLead["recommended_tier"], string> = {
  solo: "SOLO_FOUNDER",
  team: "TEAM_OPERATOR",
  frontier: "FRONTIER_FIRM",
};

const TIER_TAGLINE: Record<PlanningLead["recommended_tier"], string> = {
  solo: "One-time setup, pay-as-you-go.",
  team: "Flat per-workspace, BYOK with unlimited tokens.",
  frontier: "Custom pricing, dedicated infra, compliance.",
};

function formatLongDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function PlanPageContent({ lead }: { lead: PlanningLead }) {
  const recipients = [lead.primary_name, ...lead.cc_emails];
  const replySubject = encodeURIComponent(
    `Plan ${lead.hash} · ${lead.primary_name}`,
  );
  const ownerSlug = lead.primary_name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  // ── Metadata strip rows ────────────────────────────────────────────────
  const metaRows: Array<{ k: string; v: string; accent?: boolean }> = [
    { k: "// PLAN_FOR", v: lead.primary_name, accent: true },
    { k: "// CREATED", v: formatLongDate(lead.created_at) },
    {
      k: "// EDITED",
      v: lead.edited_at ? formatLongDate(lead.edited_at) : "—",
    },
    { k: "// VERSION", v: `v${lead.edit_version}` },
    {
      k: "// RECIPIENTS",
      v: `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`,
    },
    { k: "// PLAN_ID", v: lead.hash },
  ];

  return (
    <PlanPageShell>
      {/* §00 — HERO ----------------------------------------------------- */}
      <section className="mb-14">
        <div
          className="mb-3 text-[11px] font-medium uppercase tracking-widest"
          style={{ color: PLAN_ACCENT }}
        >
          {`// PLAN_FOR_${ownerSlug}`}
        </div>
        <h1 className="mb-6 text-4xl font-bold uppercase leading-tight tracking-tight text-zinc-100 sm:text-5xl">
          YOUR{" "}
          <span style={{ color: PLAN_ACCENT }}>AI TEAM</span>{" "}
          PLAN.
        </h1>
        <p className="max-w-[58ch] text-base leading-relaxed text-zinc-300 sm:text-lg">
          {lead.project_summary}
        </p>
      </section>

      {/* §01 — TIER CARD + METADATA STRIP ------------------------------- */}
      <section className="mb-16 grid grid-cols-1 gap-6 md:grid-cols-[1.4fr_1fr]">
        {/* Tier card */}
        <div
          className="border bg-zinc-900/40 p-6 sm:p-8"
          style={{
            borderColor: PLAN_ACCENT,
            boxShadow: `inset 0 0 0 1px ${PLAN_ACCENT}10`,
          }}
        >
          <div
            className="mb-3 text-[11px] font-medium uppercase tracking-widest"
            style={{ color: PLAN_ACCENT }}
          >
            {"// RECOMMENDED_TIER"}
          </div>
          <div className="mb-3 text-2xl font-bold uppercase tracking-tight text-zinc-100 sm:text-3xl">
            {TIER_LABEL[lead.recommended_tier]}
          </div>
          <p className="mb-6 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {TIER_TAGLINE[lead.recommended_tier]}
          </p>
          <Link
            href={`/pricing#${lead.recommended_tier}`}
            className="inline-flex items-center gap-2 border px-4 py-2 text-xs font-medium uppercase tracking-widest transition-colors hover:bg-zinc-100/5"
            style={{ borderColor: PLAN_ACCENT, color: PLAN_ACCENT }}
          >
            SEE_PRICING_DETAIL →
          </Link>
        </div>

        {/* Metadata strip */}
        <div className="flex flex-col border border-zinc-800 bg-zinc-900/40">
          {metaRows.map((row, i) => (
            <div
              key={row.k}
              className={`flex items-center justify-between gap-3 px-4 py-3 text-[11px] uppercase tracking-widest ${
                i < metaRows.length - 1 ? "border-b border-zinc-800" : ""
              }`}
            >
              <span className="flex-none text-zinc-500">{row.k}</span>
              <b
                className="truncate font-medium"
                style={{
                  color: row.accent ? PLAN_ACCENT : "#f4f4f5", // zinc-100
                }}
              >
                {row.v}
              </b>
            </div>
          ))}
        </div>
      </section>

      {/* §02 — PLAN BODY (markdown) ------------------------------------- */}
      <section className="mb-16">
        <div className="mb-6 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="block h-[1px] w-12"
            style={{ backgroundColor: PLAN_ACCENT }}
          />
          <span
            className="text-[11px] font-medium uppercase tracking-widest"
            style={{ color: PLAN_ACCENT }}
          >
            {"// THE_PLAN"}
          </span>
        </div>
        <h2 className="mb-10 text-2xl font-bold uppercase tracking-tight text-zinc-100 sm:text-3xl">
          READ THROUGH.{" "}
          <span style={{ color: PLAN_ACCENT }}>SHARE</span> WITH YOUR TEAM.
        </h2>

        <article className="mx-auto max-w-[800px] border border-zinc-800 bg-zinc-900/40 p-6 sm:p-10">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="mb-4 mt-8 text-2xl font-bold uppercase tracking-tight text-zinc-100 first:mt-0 sm:text-3xl">
                  {children}
                </h1>
              ),
              h2: ({ children }) => (
                <h2
                  className="mb-3 mt-10 border-l-2 pl-4 text-xl font-bold uppercase tracking-tight text-zinc-100 first:mt-0 sm:text-2xl"
                  style={{ borderColor: PLAN_ACCENT }}
                >
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3
                  className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest"
                  style={{ color: PLAN_ACCENT }}
                >
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="my-4 text-base leading-relaxed text-zinc-300">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="my-4 list-none space-y-2 p-0">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-4 list-decimal space-y-2 pl-6">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-3 text-base leading-relaxed text-zinc-300">
                  <span
                    aria-hidden="true"
                    className="mt-[10px] h-[6px] w-[6px] flex-none rounded-full"
                    style={{ backgroundColor: PLAN_ACCENT }}
                  />
                  <span className="min-w-0 flex-1">{children}</span>
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-5 border-l-2 border-zinc-700 bg-zinc-950 px-4 py-3 italic text-zinc-400">
                  {children}
                </blockquote>
              ),
              code: ({ children }) => (
                <code className="border border-zinc-800 bg-zinc-950 px-[5px] py-[1px] text-[0.92em] text-zinc-100">
                  {children}
                </code>
              ),
              pre: ({ children }) => (
                <pre className="my-5 overflow-x-auto border border-zinc-800 bg-zinc-950 p-4 text-xs leading-normal text-zinc-300">
                  {children}
                </pre>
              ),
              a: ({ children, href }) => (
                <a
                  href={href}
                  className="underline-offset-2 hover:underline"
                  style={{ color: PLAN_ACCENT }}
                >
                  {children}
                </a>
              ),
              strong: ({ children }) => (
                <strong className="font-bold text-zinc-100">{children}</strong>
              ),
              hr: () => <hr className="my-8 border-0 border-t border-zinc-800" />,
            }}
          >
            {lead.plan_markdown}
          </ReactMarkdown>
        </article>
      </section>

      {/* §03 — REPLY CTA ------------------------------------------------ */}
      <section className="border border-zinc-800 bg-zinc-900/40 p-6 sm:p-8">
        <div
          className="mb-3 text-[11px] font-medium uppercase tracking-widest"
          style={{ color: PLAN_ACCENT }}
        >
          {"// QUESTIONS"}
        </div>
        <h3 className="mb-4 text-xl font-bold uppercase tracking-tight text-zinc-100 sm:text-2xl">
          READY TO <span style={{ color: PLAN_ACCENT }}>DEPLOY</span>?
        </h3>
        <p className="mb-6 max-w-[58ch] text-sm leading-relaxed text-zinc-400 sm:text-base">
          Reply to the email this plan came from and the Agenthost team will
          help you stand it up — pricing, infra, agent setup. Or use the link
          below to start a fresh thread.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${replySubject}`}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-950 transition-opacity hover:opacity-90"
            style={{ backgroundColor: PLAN_ACCENT }}
          >
            EMAIL_AGENTHOST →
          </a>
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            SEE_PRICING
          </Link>
        </div>
      </section>
    </PlanPageShell>
  );
}
