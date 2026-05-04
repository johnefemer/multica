"use client";

import Link from "next/link";
import { cn } from "@multica/ui/lib/utils";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";

const BOOKING_HREF =
  "mailto:team@agenthost.kensink.com?subject=Book%20a%20session%20%E2%80%94%20explore%20my%20next%2010x%20dev";

type Tier = {
  name: string;
  amount: string;
  amountSuffix: string;
  isFeatured?: boolean;
  featuredBadge?: string;
  tagline: string;
  desc: string;
  features: string[];
  cta: string;
  href: string;
};

const tiers: Tier[] = [
  {
    name: "// SOLO_FOUNDER",
    amount: "ONE-TIME",
    amountSuffix: "setup fee",
    tagline: "Non-technical founders shipping a real product.",
    desc: "Stand up your workspace once. Open unlimited issues, scope unlimited projects. Pay only for the model tokens you actually burn — no monthly lock-in.",
    features: [
      "One-time workspace setup & onboarding",
      "Unlimited issues, projects, agents",
      "Pay-as-you-go usage — your keys, your bill",
      "Cancel anytime · no monthly contract",
      "Founder-mode templates: PRDs, specs, sprints",
    ],
    cta: "BOOK_SETUP →",
    href: BOOKING_HREF,
  },
  {
    name: "// TEAM_OPERATOR",
    amount: "FLAT",
    amountSuffix: "/ workspace / mo",
    isFeatured: true,
    featuredBadge: "// 10x DEV FOR EVERYONE",
    tagline: "CEO / Manager running a software team like a machine.",
    desc: "Empower every operator on your team with a 10x developer at their elbow. One-time setup, then a fixed monthly fee per workspace — unlimited AI tokens with BYOK so usage never throttles momentum.",
    features: [
      "One-time workspace setup & enablement",
      "Fixed monthly fee per workspace — predictable",
      "Unlimited AI tokens (BYOK — your provider keys)",
      "Unlimited humans + agents on the workspace",
      "Sprint queue, agent runtimes, audit trail",
      "Priority support · onboarding for the team",
    ],
    cta: "BOOK_A_SESSION →",
    href: BOOKING_HREF,
  },
  {
    name: "// FRONTIER_FIRM",
    amount: "CALL",
    amountSuffix: "for price",
    tagline: "Run the company with AI supervisors. Humans for escalation.",
    desc: "End-to-end AI-driven pipeline: agents own the work, AI supervisors orchestrate the queue, and humans step in only on escalation. Custom runtimes, custom guardrails, custom SLAs.",
    features: [
      "End-to-end AI pipeline · ideation → ship",
      "AI supervisors with human-in-the-loop escalation",
      "Custom agent runtimes & private models",
      "Dedicated success engineer · co-design sessions",
      "VPC / on-prem · SSO · audit & compliance",
      "Procurement, redlines, MSAs",
    ],
    cta: "TALK_TO_FOUNDERS →",
    href: BOOKING_HREF,
  },
];

export function PricingPageClient() {
  return (
    <OpsPageShell>
      <OpsSection id="pricing">
        <OpsSectionHead
          num="§01"
          label="PRICING"
          headlineParts={[
            "PICK THE LANE. ",
            "WE MATCH YOU TO A 10x DEV.",
          ]}
          toneMap={{ 1: "accent" }}
          sub="Three ways to run with Agenthost — built around how your team actually ships. Bring your own model keys. No per-agent tax. No surprise invoices."
        />

        <div className="grid grid-cols-3 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative flex flex-col gap-[18px] border-r border-[var(--line2)] p-7 last:border-r-0",
                tier.isFeatured ? "bg-[var(--bg3)]" : "bg-[var(--bg2)]",
                "max-[880px]:!border-r-0 max-[880px]:border-b max-[880px]:last:!border-b-0",
              )}
            >
              {tier.featuredBadge ? (
                <div className="absolute right-6 top-[18px] text-[9.5px] tracking-[var(--tr-label)] text-[var(--accent)] max-[880px]:static max-[880px]:right-auto max-[880px]:top-auto max-[880px]:-mb-[10px] max-[880px]:text-[10px]">
                  {tier.featuredBadge}
                </div>
              ) : null}

              <div
                className={cn(
                  "text-[length:var(--font-size-label)] tracking-[var(--tr-label)]",
                  tier.isFeatured ? "text-[var(--accent)]" : "text-[var(--dim)]",
                )}
              >
                {tier.name}
              </div>

              <div className="text-[length:var(--font-size-price)] font-[number:var(--weight-bold)] leading-none tracking-[-0.025em] text-[var(--txt)]">
                <span className={tier.isFeatured ? "text-[var(--accent)]" : undefined}>
                  {tier.amount}
                </span>
                <small className="ml-[6px] text-[13px] font-[number:var(--weight-regular)] tracking-normal text-[var(--dim)]">
                  {tier.amountSuffix}
                </small>
              </div>

              <div className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] uppercase tracking-[var(--tr-label)] text-[var(--txt)]">
                {tier.tagline}
              </div>

              <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {tier.desc}
              </div>

              <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
                {tier.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-px flex-none text-[11px] text-[var(--accent)]"
                    >
                      ▸
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto">
                <Link
                  href={tier.href}
                  className={opsButtonClassName(tier.isFeatured ? "solid" : "ghost")}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </OpsSection>

      <section
        id="book-a-session"
        className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y)] max-[1020px]:py-[var(--cta-pad-y-lg)] max-[760px]:py-[var(--cta-pad-y-md)]"
        style={{ background: "var(--bg-cta-glow), var(--bg)" }}
      >
        <OpsContainer>
          <div className="grid grid-cols-[1.4fr_1fr] items-end gap-16 max-[880px]:grid-cols-1 max-[880px]:gap-9">
            <div>
              <div className="mb-5 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// BOOK_A_SESSION"}
              </div>
              <h2 className="m-0 mb-7 max-w-[18ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                EXPLORE YOUR NEXT{" "}
                <span className="text-[var(--accent)]">10x DEV.</span>
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                30 minutes with a founder. We map your workflow to the right
                lane — solo, team, or frontier — and walk you through a live
                workspace with agents already on the queue.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={BOOKING_HREF} className={opsButtonClassName("solid")}>
                  BOOK_A_SESSION →
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// FORMAT", v: "30 min · video call" },
                { k: "// AUDIENCE", v: "founders, ops, eng leads" },
                { k: "// OUTCOME", v: "matched lane + live demo" },
                { k: "// COST", v: "free · no card" },
                { k: "// CONTACT", v: "team@agenthost.kensink.com" },
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
    </OpsPageShell>
  );
}
