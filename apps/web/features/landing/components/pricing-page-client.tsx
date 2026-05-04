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

const CONTACT_EMAIL = "agenthost@kensink.com";

function bookingHref(subject: string) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

type Tier = {
  id: "solo" | "team" | "frontier";
  name: string;
  amount: string;
  amountSuffix: string;
  tagline: string;
  forWho: string;
  desc: string;
  valueChain: string[];
  features: string[];
  cta: string;
  href: string;
  isFeatured?: boolean;
  featuredBadge?: string;
};

const tiers: Tier[] = [
  {
    id: "solo",
    name: "// SOLO_FOUNDER",
    amount: "ONE-TIME",
    amountSuffix: "setup fee · pay-as-you-go",
    tagline: "Build the product in your head.",
    forWho: "Non-technical founders shipping a real product.",
    desc: "Stand up your workspace once. Open unlimited issues, scope unlimited projects. Pay only for the model tokens you actually burn — no monthly lock-in, no platform tax.",
    valueChain: [
      "Stay in the founder zone — agents handle the bash + YAML soup",
      "Hit zero technical-cliff days; ship v0 while it's still your idea",
      "Decide what users want, not where the semicolons go",
    ],
    features: [
      "One-time workspace setup & onboarding",
      "Unlimited issues, projects, agents",
      "Pay-as-you-go usage — your keys, your bill",
      "Cancel anytime · no monthly contract",
      "Founder-mode templates: PRDs, specs, sprint queue",
    ],
    cta: "FORGE_v0 →",
    href: bookingHref("Forge v0 with Agenthost"),
  },
  {
    id: "team",
    name: "// TEAM_OPERATOR",
    amount: "FLAT",
    amountSuffix: "/ workspace / mo",
    isFeatured: true,
    featuredBadge: "// 10x DEV FOR EVERYONE",
    tagline: "Constant velocity. Zero burnout.",
    forWho: "CEOs / managers running a software team like a machine.",
    desc: "One-time setup, then a fixed monthly fee per workspace. Unlimited AI tokens with BYOK so usage never throttles momentum. Pay for the lane, not the seat.",
    valueChain: [
      "Team moves at constant pace without exhausting human capacity",
      "Delivery becomes the rhythm — not a micro-managed Jira list",
      "Build a culture where shipping is the default, not the exception",
    ],
    features: [
      "One-time workspace setup & team enablement",
      "Fixed monthly fee per workspace — predictable forever",
      "Unlimited AI tokens (BYOK — your provider keys)",
      "Unlimited humans + agents on the workspace",
      "Sprint queue, agent runtimes, full audit trail",
      "Priority support · onboarding for the whole team",
    ],
    cta: "DEPLOY_TEAM_OS →",
    href: bookingHref("Deploy Team OS"),
  },
  {
    id: "frontier",
    name: "// FRONTIER_FIRM",
    amount: "CALL",
    amountSuffix: "for price",
    tagline: "Humans command. Minions execute.",
    forWho: "Software firms running with an AI workforce at scale.",
    desc: "End-to-end AI-driven pipeline: agents own the work, AI supervisors orchestrate the queue, humans step in only on escalation. Custom runtimes, custom guardrails, custom SLAs.",
    valueChain: [
      "Enforce one-team standards across thousands of agents",
      "Humans become overlords; the AI fleet handles upkeep",
      "Stripe-scale ops without Stripe-scale headcount",
    ],
    features: [
      "End-to-end AI pipeline · ideation → ship",
      "AI supervisors with human-in-the-loop escalation",
      "Custom agent runtimes & private models",
      "Dedicated success engineer · co-design sessions",
      "VPC / on-prem · SSO · audit & compliance",
      "Procurement, redlines, MSAs",
    ],
    cta: "COMMAND_THE_FLEET →",
    href: bookingHref("Command the Fleet — Frontier Firm"),
  },
];

const foundations = [
  {
    tag: "// BYOK",
    name: "YOUR KEYS · YOUR BILL",
    body: "Pay vendors directly. Zero markup on tokens, no per-agent tax, no surprise invoice at the bottom of the funnel.",
    tone: "accent" as const,
  },
  {
    tag: "// MIT",
    name: "OWN THE STACK",
    body: "Open source on every tier. Self-host the entire control plane the day you decide we've lost the plot. The exit is in the license.",
    tone: "accent2" as const,
  },
  {
    tag: "// SKILLS",
    name: "WINS COMPOUND",
    body: "Every solved issue lands as a re-runnable skill in the workspace. Day 30, the new agent ships at week-1 senior pace.",
    tone: "warn" as const,
  },
  {
    tag: "// AUDIT",
    name: "PROVE WHAT SHIPPED",
    body: "Every actor — human or agent — logged with timestamps, sessions, diffs. Procurement-ready, compliance-ready, manager-ready.",
    tone: "accent" as const,
  },
];

const TONE_TEXT: Record<"accent" | "accent2" | "warn", string> = {
  accent: "text-[var(--accent)]",
  accent2: "text-[var(--accent2)]",
  warn: "text-[var(--warn)]",
};
const TONE_BORDER: Record<"accent" | "accent2" | "warn", string> = {
  accent: "border-[var(--accent)]",
  accent2: "border-[var(--accent2)]",
  warn: "border-[var(--warn)]",
};

export function PricingPageClient() {
  return (
    <OpsPageShell>
      <OpsSection id="pricing">
        <OpsSectionHead
          num="§01"
          label="// PRICING"
          headlineParts={["PICK YOUR ORBIT. ", "WE DO THE LIFT."]}
          toneMap={{ 1: "accent" }}
          sub="Same primitives, different scale. A small team shouldn't feel small — two engineers and a fleet of agents can move like twenty. Pick how big you want to feel."
        />

        <div className="mb-10 grid grid-cols-3 gap-0 border border-[var(--line2)] max-[760px]:grid-cols-1">
          {[
            { k: "// BYOK", v: "your keys · zero markup" },
            { k: "// MIT", v: "self-host any tier" },
            { k: "// FAIR", v: "no per-agent tax" },
          ].map((row, i, arr) => (
            <div
              key={row.k}
              className={cn(
                "flex items-baseline gap-3 bg-[var(--bg2)] px-5 py-4",
                i < arr.length - 1 && "border-r border-[var(--line2)]",
                "max-[760px]:!border-r-0 max-[760px]:border-b max-[760px]:last:border-b-0",
              )}
            >
              <span className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {row.k}
              </span>
              <span className="text-[length:var(--font-size-tag)] text-[var(--txt2)]">
                {row.v}
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {tiers.map((tier) => (
            <article
              key={tier.id}
              className={cn(
                "relative flex flex-col gap-5 border-r border-[var(--line2)] p-7 last:border-r-0",
                tier.isFeatured ? "bg-[var(--bg3)]" : "bg-[var(--bg2)]",
                "max-[880px]:!border-r-0 max-[880px]:border-b max-[880px]:last:border-b-0",
              )}
            >
              {tier.isFeatured ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] bg-[var(--accent)] [box-shadow:var(--glow-accent)]"
                />
              ) : null}

              {tier.featuredBadge ? (
                <div className="absolute right-6 top-[18px] text-[9.5px] tracking-[var(--tr-label)] text-[var(--accent)] max-[880px]:static max-[880px]:right-auto max-[880px]:top-auto max-[880px]:-mb-[6px] max-[880px]:text-[10px]">
                  {tier.featuredBadge}
                </div>
              ) : null}

              <header className="flex flex-col gap-4">
                <div
                  className={cn(
                    "text-[length:var(--font-size-label)] tracking-[var(--tr-label)]",
                    tier.isFeatured ? "text-[var(--accent)]" : "text-[var(--dim)]",
                  )}
                >
                  {tier.name}
                </div>

                <div className="flex flex-col gap-1">
                  <div
                    className={cn(
                      "font-[number:var(--weight-bold)] leading-none tracking-[-0.025em] text-[var(--txt)]",
                      tier.isFeatured
                        ? "text-[length:var(--font-size-stat)]"
                        : "text-[length:var(--font-size-price)]",
                    )}
                  >
                    <span
                      className={tier.isFeatured ? "text-[var(--accent)]" : undefined}
                    >
                      {tier.amount}
                    </span>
                  </div>
                  <small className="text-[length:var(--font-size-tag)] font-[number:var(--weight-regular)] tracking-normal text-[var(--dim)]">
                    {tier.amountSuffix}
                  </small>
                </div>

                <h3 className="m-0 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] uppercase leading-[1.2] tracking-[-0.005em] text-[var(--txt)]">
                  {tier.tagline}
                </h3>

                <p className="m-0 text-[length:var(--font-size-micro)] uppercase tracking-[var(--tr-label)] text-[var(--dim)]">
                  {tier.forWho}
                </p>
              </header>

              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {tier.desc}
              </p>

              <div
                className={cn(
                  "border-l-2 bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] px-3 py-3",
                  tier.isFeatured ? "border-[var(--accent)]" : "border-[var(--line3)]",
                )}
              >
                <div
                  className={cn(
                    "mb-2 text-[length:var(--font-size-nano)] tracking-[var(--tr-eyebrow)]",
                    tier.isFeatured ? "text-[var(--accent)]" : "text-[var(--dim)]",
                  )}
                >
                  {"// VALUE_CHAIN"}
                </div>
                <ul className="m-0 list-none p-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt)]">
                  {tier.valueChain.map((v) => (
                    <li key={v} className="flex items-start gap-2 py-[2px]">
                      <span
                        aria-hidden="true"
                        className="mt-px flex-none text-[11px] text-[var(--accent)]"
                      >
                        →
                      </span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <ul className="m-0 flex flex-1 list-none flex-col gap-2 border-t border-dashed border-[var(--line)] p-0 pt-5 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
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

              <div className="mt-auto pt-3">
                <Link
                  href={tier.href}
                  className={opsButtonClassName(tier.isFeatured ? "solid" : "outline")}
                >
                  {tier.cta}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </OpsSection>

      <OpsSection id="foundations">
        <OpsSectionHead
          num="§02"
          label="// FOUNDATIONS"
          headlineParts={["EVERY TIER ", "INHERITS THE STACK."]}
          toneMap={{ 1: "accent" }}
          sub="Pricing changes how big you can feel. The foundations don't change. The platform you run on day one is the same platform you'd self-host on day a thousand."
        />
        <div className="grid grid-cols-4 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-2 max-[480px]:grid-cols-1">
          {foundations.map((f, i, arr) => (
            <div
              key={f.tag}
              className={cn(
                "flex flex-col gap-3 bg-[var(--bg2)] p-6",
                i < arr.length - 1 && "border-r border-[var(--line2)]",
                "max-[880px]:[&:nth-child(2n)]:border-r-0",
                "max-[880px]:[&:nth-child(-n+2)]:border-b max-[880px]:border-[var(--line2)]",
                "max-[480px]:!border-r-0 max-[480px]:border-b max-[480px]:last:border-b-0",
              )}
            >
              <div
                className={cn(
                  "text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)]",
                  TONE_TEXT[f.tone],
                )}
              >
                {f.tag}
              </div>
              <div className="text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-label)] text-[var(--txt)]">
                {f.name}
              </div>
              <p
                className={cn(
                  "m-0 border-l-2 pl-3 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]",
                  TONE_BORDER[f.tone],
                )}
              >
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </OpsSection>

      <OpsSection id="hire-10x">
        <OpsSectionHead
          num="§03"
          label="// HIRE_A_10x_DEV"
          headlineParts={["PUT A ", "10x DEV", " ON THE TEAM."]}
          toneMap={{ 1: "accent" }}
          sub="Pricing buys you the platform. The lift comes from how you operate it. We pair you with a 10x dev who works alongside your humans — assigning agents, codifying skills, running the queue so velocity stops scaling with headcount."
        />
        <div className="grid grid-cols-[1.4fr_1fr] gap-10 border border-[var(--line2)] bg-[var(--bg2)] p-7 max-[880px]:grid-cols-1 max-[880px]:gap-6">
          <div>
            <div className="mb-4 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// PROGRAMME"}
            </div>
            <ul className="m-0 mb-6 list-none p-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {[
                "Dedicated 10x dev embedded in your workspace",
                "Owns the agent queue alongside your humans",
                "Codifies wins into your skill_library — knowledge stays",
                "Levels up your team so the role becomes self-sustaining",
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 py-1">
                  <span
                    aria-hidden="true"
                    className="mt-[6px] flex-none text-[11px] text-[var(--accent)]"
                  >
                    ▸
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/10x" className={opsButtonClassName("solid")}>
                EXPLORE_10x_PROGRAMME →
              </Link>
              <Link
                href={bookingHref("10x dev — match me to a sprint")}
                className={opsButtonClassName("ghost")}
              >
                BOOK_A_SESSION
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-0 self-start border border-[var(--line2)] max-[480px]:grid-cols-1">
            {[
              { tag: "// 2x", label: "ADOPTS", tone: "warn" as const },
              { tag: "// 5x", label: "OPERATES", tone: "accent2" as const },
              { tag: "// 10x", label: "ELEVATES", tone: "accent" as const },
            ].map((s) => (
              <div
                key={s.tag}
                className={cn(
                  "flex flex-col gap-1 border-r border-[var(--line2)] bg-[var(--bg)] p-4 last:border-r-0",
                  "max-[480px]:!border-r-0 max-[480px]:border-b max-[480px]:last:border-b-0",
                )}
              >
                <span
                  className={cn(
                    "text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)]",
                    TONE_TEXT[s.tone],
                  )}
                >
                  {s.tag}
                </span>
                <span className="text-[length:var(--font-size-tag)] font-[number:var(--weight-bold)] tracking-[var(--tr-label)] text-[var(--txt)]">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
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
                orbit — solo, team, or frontier — and walk you through a live
                workspace with agents already on the queue.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={bookingHref("Book a session — explore my next 10x dev")}
                  className={opsButtonClassName("solid")}
                >
                  BOOK_A_SESSION →
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// FORMAT", v: "30 min · video call" },
                { k: "// AUDIENCE", v: "founders, ops, eng leads" },
                { k: "// OUTCOME", v: "matched orbit + live demo" },
                { k: "// COST", v: "free · no card" },
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
    </OpsPageShell>
  );
}
