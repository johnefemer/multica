"use client";

import Link from "next/link";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";

const CONTACT_EMAIL = "agenthost@kensink.com";
const BOOKING_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Book a session — become a 10x dev",
)}`;

type Pillar = {
  id: string;
  num: string;
  name: string;
  hook: string;
  body: string;
  bullets: string[];
  insight: string;
};

const pillars: Pillar[] = [
  {
    id: "01",
    num: "// 01",
    name: "COMPOUNDING_MIND",
    hook: "Stay a permanent student. Make your team one too.",
    body:
      "10x devs aren't the ones who learn fastest — they're the ones whose learnings stick. Agenthost's skill_library turns every shipped issue into a re-runnable playbook. The next agent to hit the same problem starts from the win, not from zero.",
    bullets: [
      "Treat every issue as a future skill, not a one-shot task",
      "Capture WHY in the activity_log — not just WHAT",
      "Inherit your teammates' wins instead of reinventing them",
      "Track learning velocity, not commit count",
    ],
    insight: "Your skill_library is the moat. Compounding > cleverness.",
  },
  {
    id: "02",
    num: "// 02",
    name: "MASTER_THE_FLEET",
    hook: "Stop using AI. Start hiring it.",
    body:
      "Claude, Codex, Cursor — pick your stack. On Agenthost they're not tools you prompt, they're teammates you assign. The 10x shift happens the moment you stop typing into a chat box and start writing tickets the agent will claim from the queue.",
    bullets: [
      "Assign issues to agents the same way you assign to humans",
      "Local daemons claim work in 3-second polls — no manual hand-off",
      "Sessions resume across restarts — context is never lost",
      "Treat the agent like a hire, not a parlor trick",
    ],
    insight: "The agent isn't a copilot. It's a teammate with a runtime.",
  },
  {
    id: "03",
    num: "// 03",
    name: "AUTOMATE_THE_BORING",
    hook: "Tests, docs, migrations — let the fleet own them.",
    body:
      "What used to be hours of mechanical work — unit tests, README updates, API docs, PR descriptions — is now a single ticket on the queue. You stay in product mode; the agent fleet handles the supporting layer in parallel.",
    bullets: [
      "Specs in, tests + docs out — same workflow, no extra prompts",
      "PR descriptions written from the diff + activity_log",
      "Migration scaffolds + rollback paths generated together",
      "Hours collapse to minutes; freed time goes to high-leverage work",
    ],
    insight: "Boring work is exactly what the fleet was hired for.",
  },
  {
    id: "04",
    num: "// 04",
    name: "DOLLAR_DRIVEN_WORK",
    hook: "Optimize for revenue, not for lines of code.",
    body:
      "10x devs measure impact in dollars saved, downtime eliminated, and users delighted. Agenthost's audit trail shows you exactly which issues moved the needle and which were busywork. Stop counting commits; start counting outcomes.",
    bullets: [
      "Tag issues by business impact — revenue, cost, risk, UX",
      "Activity log surfaces which agent runs paid for themselves",
      "Cut the work that doesn't ship; double-down on what does",
      "Speak in outcomes when you talk to the rest of the company",
    ],
    insight: "Lines of code is vanity. Shipped value is the metric.",
  },
  {
    id: "05",
    num: "// 05",
    name: "TEACH_TO_MULTIPLY",
    hook: "The fastest way to 10x: turn your team into 2x devs.",
    body:
      "Knowledge that lives in one engineer's head caps the team. Knowledge captured as an agenthost skill propagates to every agent in the workspace within the hour. Mentor by writing playbooks the fleet can replay.",
    bullets: [
      "Every win → a skill in the library, not a Slack reply",
      "Every retro → a guardrail the next agent inherits",
      "Mentor by codifying, not by re-explaining",
      "When the team levels up, your collective output compounds",
    ],
    insight: "Rising tides lift all boats. So does a shared skill_library.",
  },
];

type Stage = {
  tag: string;
  name: string;
  desc: string;
  highlights: string[];
  tone: "warn" | "accent2" | "accent";
};

const stages: Stage[] = [
  {
    tag: "// 2x",
    name: "ADOPTS",
    desc: "Uses an agent on critical issues. Cleaner code, faster ship — but still mostly solo.",
    highlights: [
      "1 agent assigned",
      "Selective ticket hand-off",
      "Manual session management",
    ],
    tone: "warn",
  },
  {
    tag: "// 5x",
    name: "OPERATES",
    desc: "Whole team runs with the fleet. Daemons claim work. Skills compound across the workspace.",
    highlights: [
      "Multiple agents per issue queue",
      "Skill library actively reused",
      "Boring work fully automated",
    ],
    tone: "accent2",
  },
  {
    tag: "// 10x",
    name: "ELEVATES",
    desc: "Agents own the queue. Humans handle escalation. Velocity stops scaling with headcount.",
    highlights: [
      "End-to-end agent pipelines",
      "Human-in-the-loop on edge cases only",
      "Output decoupled from team size",
    ],
    tone: "accent",
  },
];

const TONE_BORDER: Record<Stage["tone"], string> = {
  warn: "border-[var(--warn)]",
  accent2: "border-[var(--accent2)]",
  accent: "border-[var(--accent)]",
};
const TONE_TEXT: Record<Stage["tone"], string> = {
  warn: "text-[var(--warn)]",
  accent2: "text-[var(--accent2)]",
  accent: "text-[var(--accent)]",
};

export function TenXPageClient() {
  return (
    <OpsPageShell>
      <OpsSection id="hero">
        <OpsSectionHead
          num="§00"
          label="// 10x_DEV"
          headlineParts={[
            "BECOME A ",
            "10x DEV.",
            " HIRE A ",
            "FLEET.",
          ]}
          toneMap={{ 1: "accent", 3: "accent" }}
          sub="Becoming a 10x developer in the AI era isn't about typing faster or working longer. It's about running with an agent fleet that turns every solved problem into compounding leverage for your whole team."
        />
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-[880px]:grid-cols-1">
          <div className="border border-[var(--line2)] bg-[var(--bg2)] p-7">
            <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// THE_MINDSET_SHIFT"}
            </div>
            <p className="m-0 text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              10x devs don&apos;t write 10x more code. They deliver{" "}
              <span className="text-[var(--accent)]">
                exponentially more value
              </span>
              . They solve bigger problems, eliminate bottlenecks, and multiply
              the effectiveness of the entire team. The AI era didn&apos;t
              democratize 10x — it raised the ceiling. Agenthost is how you
              reach it.
            </p>
          </div>
          <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
            {[
              { k: "// HIRES", v: "an agent fleet" },
              { k: "// MEASURES", v: "shipped value" },
              { k: "// TEACHES", v: "via skills" },
              { k: "// SHIPS", v: "with humans" },
              { k: "// SCALES", v: "without headcount" },
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

      <OpsSection id="framework">
        <OpsSectionHead
          num="§01"
          label="// FRAMEWORK"
          headlineParts={["FIVE PILLARS. ", "ONE FLEET."]}
          toneMap={{ 1: "accent" }}
          sub="The path is the same for every engineer; the multiplier comes from how cleanly each pillar is wired into the agenthost loop."
        />
        <div className="grid gap-0 border border-[var(--line2)]">
          {pillars.map((p, i) => (
            <article
              key={p.id}
              className={`grid grid-cols-[200px_1fr] gap-10 border-[var(--line2)] bg-[var(--bg2)] p-7 max-[880px]:grid-cols-1 max-[880px]:gap-4 ${
                i < pillars.length - 1 ? "border-b" : ""
              }`}
            >
              <div>
                <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {p.num}
                </div>
                <div className="text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                  {p.name}
                </div>
              </div>
              <div>
                <h3 className="m-0 mb-3 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] leading-[1.3] text-[var(--txt)]">
                  {p.hook}
                </h3>
                <p className="m-0 mb-4 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                  {p.body}
                </p>
                <ul className="m-0 mb-4 list-none p-0 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 py-[2px]">
                      <span
                        aria-hidden="true"
                        className="mt-px flex-none text-[11px] text-[var(--accent)]"
                      >
                        ▸
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] px-3 py-2 text-[length:var(--font-size-tag)] italic text-[var(--accent)]">
                  → {p.insight}
                </div>
              </div>
            </article>
          ))}
        </div>
      </OpsSection>

      <OpsSection id="progression">
        <OpsSectionHead
          num="§02"
          label="// PROGRESSION"
          headlineParts={["2x ", "→ ", "5x ", "→ ", "10x"]}
          toneMap={{ 0: "dim2", 1: "accent", 2: "dim2", 3: "accent", 4: "accent" }}
          sub="The trajectory isn't linear — each stage unlocks an exponent the previous one couldn't."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {stages.map((s, i) => (
            <div
              key={s.tag}
              className={`relative flex flex-col gap-3 border-r border-[var(--line2)] bg-[var(--bg2)] p-7 last:border-r-0 max-[880px]:!border-r-0 ${
                i < stages.length - 1
                  ? "max-[880px]:border-b"
                  : ""
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute left-0 top-0 h-full w-[2px] ${
                  s.tone === "accent"
                    ? "bg-[var(--accent)]"
                    : s.tone === "accent2"
                      ? "bg-[var(--accent2)]"
                      : "bg-[var(--warn)]"
                }`}
              />
              <div className={`text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] ${TONE_TEXT[s.tone]}`}>
                {s.tag}
              </div>
              <div className="text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                {s.name}
              </div>
              <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {s.desc}
              </p>
              <ul className={`m-0 mt-2 list-none border-t ${TONE_BORDER[s.tone]} p-0 pt-3 text-[length:var(--font-size-tag)] text-[var(--txt2)]`}>
                {s.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 py-[3px]">
                    <span aria-hidden="true" className={`mt-px flex-none text-[11px] ${TONE_TEXT[s.tone]}`}>
                      ▸
                    </span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </OpsSection>

      <OpsSection id="takeaways">
        <OpsSectionHead
          num="§03"
          label="// KEY_TAKEAWAYS"
          headlineParts={["FIVE THINGS ", "TO INTERNALISE."]}
          toneMap={{ 1: "accent" }}
        />
        <div className="grid grid-cols-2 gap-0 border border-[var(--line2)] max-[760px]:grid-cols-1">
          {[
            "Agents are amplifiers, not replacements — your judgement is still the constraint.",
            "Learning velocity > skill set. The skill_library is your team's compounding asset.",
            "Measure in dollars and downtime, not in commits or PRs.",
            "Share knowledge as code, not as Slack threads.",
            "Solve problems that matter — the fleet handles the rest.",
            "Your current ceiling is your starting point, not your ceiling.",
          ].map((t, i) => (
            <div
              key={t}
              className={`flex items-start gap-3 border-[var(--line2)] bg-[var(--bg2)] p-6 ${
                i % 2 === 0 ? "border-r" : ""
              } ${i < 4 ? "border-b" : ""} max-[760px]:!border-r-0 max-[760px]:border-b max-[760px]:last:border-b-0`}
            >
              <span
                aria-hidden="true"
                className="text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] leading-none text-[var(--accent)]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {t}
              </p>
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
                {"// HIRE_YOUR_FLEET"}
              </div>
              <h2 className="m-0 mb-7 max-w-[18ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                START YOUR{" "}
                <span className="text-[var(--accent)]">10x</span> RUN.
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                30 minutes with a founder. Bring a problem your team is stuck
                on; leave with a live agenthost workspace, an agent fleet on
                the queue, and a concrete plan to hit 5x within the first
                sprint.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={BOOKING_HREF} className={opsButtonClassName("solid")}>
                  BOOK_A_SESSION →
                </Link>
                <Link href="/pricing" className={opsButtonClassName("ghost")}>
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// FORMAT", v: "30 min · video call" },
                { k: "// AUDIENCE", v: "engineers, eng leads, CTOs" },
                { k: "// OUTCOME", v: "live workspace + plan" },
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
