// Server component — no "use client". Renders the canonical full plan
// page at /plan/<hash>. react-markdown runs server-side; the produced
// HTML ships to the browser as static markup so the page stays fast and
// requires no JS for reading.

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PlanPageShell } from "./plan-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";
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

  return (
    <PlanPageShell>
      {/* §00 — HERO ----------------------------------------------------- */}
      <OpsSection id="hero">
        <OpsSectionHead
          num="§00"
          label="// AI_DEVELOPMENT_PLAN"
          headlineParts={[
            "YOUR ",
            "AI TEAM",
            " PLAN.",
          ]}
          toneMap={{ 1: "accent" }}
          sub={lead.project_summary}
        />
        <div className="grid grid-cols-[1.4fr_1fr] gap-10 max-[880px]:grid-cols-1">
          <div className="border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-7">
            <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// RECOMMENDED_TIER"}
            </div>
            <div className="mb-2 text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
              {TIER_LABEL[lead.recommended_tier]}
            </div>
            <p className="m-0 mb-6 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {TIER_TAGLINE[lead.recommended_tier]}
            </p>
            <Link
              href={`/pricing#${lead.recommended_tier}`}
              className={opsButtonClassName("ghost")}
            >
              SEE_PRICING_DETAIL
            </Link>
          </div>
          <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
            {[
              { k: "// CREATED", v: formatLongDate(lead.created_at) },
              {
                k: "// EDITED",
                v: lead.edited_at
                  ? formatLongDate(lead.edited_at)
                  : "—",
              },
              {
                k: "// VERSION",
                v: `v${lead.edit_version}`,
              },
              {
                k: "// RECIPIENTS",
                v: `${recipients.length} ${recipients.length === 1 ? "person" : "people"}`,
              },
              { k: "// PLAN_ID", v: lead.hash },
            ].map((row) => (
              <div
                key={row.k}
                className="flex justify-between gap-3 border-b border-[var(--line)] px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] last:border-b-0"
              >
                <span className="flex-none">{row.k}</span>
                <b className="truncate font-[number:var(--weight-medium)] text-[var(--txt)]">
                  {row.v}
                </b>
              </div>
            ))}
          </div>
        </div>
      </OpsSection>

      {/* §01 — PLAN BODY (markdown) ------------------------------------- */}
      <OpsSection id="plan">
        <OpsSectionHead
          num="§01"
          label="// THE_PLAN"
          headlineParts={["READ ", "THROUGH.", " SHARE WITH YOUR TEAM."]}
          toneMap={{ 1: "accent" }}
        />
        <div className="border border-[var(--line2)] bg-[var(--bg2)] px-7 py-9 max-[760px]:px-5 max-[760px]:py-6">
          <article className="plan-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => (
                  <h1 className="mb-4 mt-8 text-[length:var(--font-size-h2)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)] first:mt-0">
                    {children}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="mb-3 mt-10 border-l-2 border-[var(--accent)] pl-4 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)] first:mt-0">
                    {children}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="mb-2 mt-6 text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                    {children}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="my-4 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                    {children}
                  </p>
                ),
                ul: ({ children }) => (
                  <ul className="my-4 list-none p-0">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-4 list-decimal pl-6 marker:text-[var(--accent)]">
                    {children}
                  </ol>
                ),
                li: ({ children }) => (
                  <li className="flex items-start gap-3 py-1 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)] [li>&]:list-item [li>&]:pl-0">
                    <span
                      aria-hidden="true"
                      className="mt-[8px] flex-none text-[11px] text-[var(--accent)]"
                    >
                      ▸
                    </span>
                    <span className="min-w-0 flex-1">{children}</span>
                  </li>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-5 border-l-2 border-[var(--dim2)] bg-[var(--bg)] px-4 py-3 italic text-[var(--txt2)]">
                    {children}
                  </blockquote>
                ),
                code: ({ children }) => (
                  <code className="border border-[var(--line)] bg-[var(--bg)] px-[5px] py-[1px] text-[0.92em] text-[var(--txt)]">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="my-5 overflow-x-auto border border-[var(--line2)] bg-[var(--bg)] p-4 text-[length:var(--font-size-tag)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                    {children}
                  </pre>
                ),
                a: ({ children, href }) => (
                  <a
                    href={href}
                    className="text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    {children}
                  </a>
                ),
                strong: ({ children }) => (
                  <strong className="font-[number:var(--weight-bold)] text-[var(--txt)]">
                    {children}
                  </strong>
                ),
                hr: () => (
                  <hr className="my-8 border-0 border-t border-[var(--line)]" />
                ),
              }}
            >
              {lead.plan_markdown}
            </ReactMarkdown>
          </article>
        </div>
      </OpsSection>

      {/* CTA — bottom: questions / talk to a founder -------------------- */}
      <section
        id="questions"
        className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y)] max-[1020px]:py-[var(--cta-pad-y-lg)] max-[760px]:py-[var(--cta-pad-y-md)]"
        style={{ background: "var(--bg-cta-glow), var(--bg)" }}
      >
        <OpsContainer>
          <div className="grid grid-cols-[1.4fr_1fr] items-end gap-16 max-[880px]:grid-cols-1 max-[880px]:gap-9">
            <div>
              <div className="mb-5 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// QUESTIONS"}
              </div>
              <h2 className="m-0 mb-7 max-w-[20ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                READY TO{" "}
                <span className="text-[var(--accent)]">DEPLOY</span>?
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                Reply to the email this plan came from and the Agenthost team
                will help you stand it up — pricing, infrastructure, agent
                setup, the works. Or use the link below to start a fresh
                thread with us.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`mailto:${CONTACT_EMAIL}?subject=${replySubject}`}
                  className={opsButtonClassName("solid")}
                >
                  EMAIL_AGENTHOST →
                </a>
                <Link
                  href="/pricing"
                  className={opsButtonClassName("ghost")}
                >
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// PRIVATE", v: "unlisted page · noindex" },
                { k: "// SHARABLE", v: "link, not credentials" },
                { k: "// EDITABLE", v: "phase 2 · coming soon" },
                { k: "// CONTACT", v: CONTACT_EMAIL },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex justify-between gap-3 border-b border-[var(--line)] px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] last:border-b-0"
                >
                  <span className="flex-none">{row.k}</span>
                  <b className="truncate font-[number:var(--weight-medium)] text-[var(--txt)]">
                    {row.v}
                  </b>
                </div>
              ))}
            </div>
          </div>
        </OpsContainer>
      </section>
    </PlanPageShell>
  );
}
