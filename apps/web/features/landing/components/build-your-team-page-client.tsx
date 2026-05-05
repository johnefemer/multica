"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";

const CONTACT_EMAIL = "agenthost@kensink.com";
const HELP_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Help me plan my AI team",
)}`;

const MAX_TEAMMATE_EMAILS = 3;

// =============================================================================
// PR 1 SCAFFOLD
//
// This is the visual structure only. The chat is wired to a local stub that
// echoes a canned agent reply so the UX is reviewable. The gist + tier card +
// email capture sections are always visible (they will be gated behind
// chat completion in PR 2). The email form is a no-op submit for now.
//
// Wiring lands in:
//   PR 2 — POST /api/landing/team-planner/chat (streaming Anthropic response)
//   PR 3 — POST /api/landing/team-planner/capture (Resend + planning_lead row)
//   PR 4 — /plan/<hash> hotlink page
// =============================================================================

type ChatRole = "agent" | "user";
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

const SEEDED_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "agent",
    text:
      "Hey 👋 I'm the Agenthost planner. In ~5 minutes I'll map an AI dev team for your project — architecture, CI/CD, roadmap, and the right tier. To start: what are you building? One paragraph in your own words is enough.",
  },
];

// Stubbed agent reply for PR 1 only. PR 2 replaces this with a streaming
// fetch to /api/landing/team-planner/chat.
function stubAgentReply(userText: string): string {
  const lower = userText.toLowerCase();
  if (lower.length < 12) {
    return "Got it. Can you flesh that out a bit? Even one or two sentences about the product, who it's for, and where you are today helps me ask the right next question.";
  }
  return "Thanks — that gives me a starting picture. (PR 2 wires the real planner; in this preview I won't drill in further.) Scroll down to see the gist + email capture below.";
}

const GIST_BULLETS = [
  "Architecture sketch tailored to your stack and deploy target",
  "CI/CD posture — what to set up first, what can wait",
  "Concrete human ↔ agent balance (e.g. 1 senior eng + 2 coding agents)",
  "Phase 0 setup checklist — your first week of work",
  "6-week roadmap broken into 3 shippable phases",
];

type RecommendedTier = {
  id: "solo_founder" | "team_operator" | "frontier_firm";
  badge: string;
  name: string;
  why: string;
  highlights: string[];
};

// PR 1 stub: hard-coded TEAM_OPERATOR. PR 2 replaces this with the tier
// the agent picks at end-of-interview.
const STUB_TIER: RecommendedTier = {
  id: "team_operator",
  badge: "// FEATURED_FIT",
  name: "TEAM_OPERATOR",
  why: "Small founding team, ongoing product, multi-repo — flat monthly per workspace fits cleanly.",
  highlights: [
    "Shared agents across the team",
    "Multi-repo registration",
    "Workspace Context + Instructions",
    "Inbox + Autopilot included",
  ],
};

interface TeammateEmail {
  id: string;
  value: string;
}
function newRow(): TeammateEmail {
  return { id: Math.random().toString(36).slice(2, 9), value: "" };
}

export function BuildYourTeamPageClient() {
  // --- Chat state -----------------------------------------------------------
  const [messages, setMessages] = useState<ChatMessage[]>(SEEDED_MESSAGES);
  const [input, setInput] = useState("");
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentTyping]);

  function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isAgentTyping) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsAgentTyping(true);
    // Local stub — PR 2 swaps this out for a streaming server call.
    const replyAfter = 700 + Math.min(trimmed.length * 12, 1200);
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "agent",
          text: stubAgentReply(trimmed),
        },
      ]);
      setIsAgentTyping(false);
      inputRef.current?.focus();
    }, replyAfter);
  }

  // --- Email capture state --------------------------------------------------
  const [primaryEmail, setPrimaryEmail] = useState("");
  const [primaryName, setPrimaryName] = useState("");
  const [teammates, setTeammates] = useState<TeammateEmail[]>([]);
  const [submitState, setSubmitState] = useState<
    "idle" | "submitting" | "submitted"
  >("idle");

  function handleAddTeammate() {
    if (teammates.length >= MAX_TEAMMATE_EMAILS) return;
    setTeammates((prev) => [...prev, newRow()]);
  }
  function handleRemoveTeammate(id: string) {
    setTeammates((prev) => prev.filter((t) => t.id !== id));
  }
  function handleTeammateChange(id: string, value: string) {
    setTeammates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, value } : t)),
    );
  }
  function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitState !== "idle") return;
    setSubmitState("submitting");
    // PR 3 wires this to POST /api/landing/team-planner/capture.
    setTimeout(() => setSubmitState("submitted"), 900);
  }

  return (
    <OpsPageShell>
      {/* §00 — HERO ----------------------------------------------------- */}
      <OpsSection id="hero">
        <OpsSectionHead
          num="§00"
          label="// BUILD_YOUR_TEAM"
          headlineParts={["PLAN YOUR ", "AI TEAM.", " IN 5 MINUTES."]}
          toneMap={{ 1: "accent" }}
          sub="Chat with the Agenthost planner. Tell us about your project — we map the architecture, the right human-agent balance, and the tier that fits, then email you the full plan."
        />
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-[880px]:grid-cols-1">
          <div className="border border-[var(--line2)] bg-[var(--bg2)] p-7">
            <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// HOW_IT_WORKS"}
            </div>
            <p className="m-0 text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              Six short questions about what you&apos;re building, your team
              shape, and your stack. The planner drafts an{" "}
              <span className="text-[var(--accent)]">
                AI development plan
              </span>{" "}
              specific to your project — architecture, CI/CD, Phase 0 setup,
              roadmap, and the matching Agenthost tier. You drop your email
              (and up to 3 teammates&apos;) and a private link to the full plan
              lands in your inbox.
            </p>
          </div>
          <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
            {[
              { k: "// INTERVIEW", v: "~6 questions" },
              { k: "// OUTPUT", v: "architecture + roadmap" },
              { k: "// PRICING", v: "solo / team / frontier" },
              { k: "// DELIVERY", v: "email + private link" },
              { k: "// TIME", v: "~5 minutes" },
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

      {/* §01 — PLANNER (chat) ------------------------------------------- */}
      <OpsSection id="planner">
        <OpsSectionHead
          num="§01"
          label="// PLANNER"
          headlineParts={["TELL THE ", "PLANNER", " ABOUT YOUR PROJECT."]}
          toneMap={{ 1: "accent" }}
          sub="Type below. The planner asks one question at a time — it adapts based on your answers and won't waste your time on what you've already covered."
        />
        <div className="border border-[var(--line2)] bg-[var(--bg2)]">
          {/* Chat header strip */}
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-[18px] py-[12px]">
            <div className="flex items-center gap-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              <span className="text-[var(--accent)]">
                {"// AGENTHOST_PLANNER"}
              </span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
                />
                ONLINE
              </span>
            </div>
            <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
              {messages.filter((m) => m.role === "user").length} / ~6
            </div>
          </div>

          {/* Messages */}
          <div
            aria-live="polite"
            className="flex max-h-[480px] min-h-[360px] flex-col gap-4 overflow-y-auto px-[18px] py-6"
          >
            {messages.map((m) => (
              <ChatBubble key={m.id} role={m.role} text={m.text} />
            ))}
            {isAgentTyping ? <TypingIndicator /> : null}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t border-[var(--line2)] px-[18px] py-3"
          >
            <div className="flex items-end gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                rows={2}
                placeholder="Describe what you're building…"
                className="block min-h-[64px] w-full resize-none border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-[length:var(--font-size-base)] leading-[var(--lh-normal)] text-[var(--txt)] placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:outline-none"
                disabled={isAgentTyping}
              />
              <button
                type="submit"
                disabled={!input.trim() || isAgentTyping}
                className={`${opsButtonClassName("solid")} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                SEND →
              </button>
            </div>
            <div className="mt-2 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
              Enter to send · Shift+Enter for newline · The planner will not
              answer unrelated questions.
            </div>
          </form>
        </div>
      </OpsSection>

      {/* §02 — GIST + RECOMMENDED TIER ---------------------------------- */}
      {/* TODO PR2: gate this section behind chat-complete state. */}
      <OpsSection id="gist">
        <OpsSectionHead
          num="§02"
          label="// PLAN_PREVIEW"
          headlineParts={[
            "YOUR PLAN ",
            "IN BRIEF.",
            " FULL VERSION BY EMAIL.",
          ]}
          toneMap={{ 1: "accent" }}
          sub="Once the interview wraps, this section shows a short preview and the matching Agenthost tier. The full plan — architecture, roadmap, Phase 0, the works — gets emailed to you and your teammates as a private link."
        />
        <div className="grid grid-cols-[1.4fr_1fr] gap-10 max-[880px]:grid-cols-1">
          {/* Left: gist bullets */}
          <div className="border border-[var(--line2)] bg-[var(--bg2)] p-7">
            <div className="mb-4 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// PLAN_COVERAGE"}
            </div>
            <ul className="m-0 list-none p-0 text-[length:var(--font-size-base)] text-[var(--txt2)]">
              {GIST_BULLETS.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 border-b border-[var(--line)] py-3 leading-[var(--lh-loose)] last:border-b-0"
                >
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
          </div>

          {/* Right: recommended tier card */}
          <article className="flex flex-col border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-7">
            <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {STUB_TIER.badge}
            </div>
            <div className="mb-3 text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
              {STUB_TIER.name}
            </div>
            <p className="m-0 mb-5 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {STUB_TIER.why}
            </p>
            <ul className="m-0 mb-6 list-none border-t border-[var(--line)] p-0 pt-4 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
              {STUB_TIER.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2 py-1">
                  <span
                    aria-hidden="true"
                    className="mt-[3px] flex-none text-[11px] text-[var(--accent)]"
                  >
                    ▸
                  </span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className={opsButtonClassName("ghost")}>
              SEE_ALL_TIERS
            </Link>
          </article>
        </div>
      </OpsSection>

      {/* §03 — EMAIL CAPTURE ------------------------------------------- */}
      {/* TODO PR2: only render once chat is marked complete. */}
      <OpsSection id="email-capture">
        <OpsSectionHead
          num="§03"
          label="// EMAIL_THE_PLAN"
          headlineParts={["GET YOUR ", "FULL PLAN.", " BRING TEAMMATES."]}
          toneMap={{ 1: "accent" }}
          sub="Drop your email and we'll send a private link to the full plan. Add up to 3 teammates and they'll get the same link in the same thread."
        />
        <form
          onSubmit={handleEmailSubmit}
          className="border border-[var(--line2)] bg-[var(--bg2)] p-7"
        >
          <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
            <FormField
              label="// YOUR_NAME"
              type="text"
              required
              placeholder="Mei"
              value={primaryName}
              onChange={setPrimaryName}
              autoComplete="given-name"
            />
            <FormField
              label="// YOUR_EMAIL"
              type="email"
              required
              placeholder="mei@studio.com"
              value={primaryEmail}
              onChange={setPrimaryEmail}
              autoComplete="email"
            />
          </div>

          <div className="mt-6 border-t border-[var(--line)] pt-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {`// TEAMMATES_OPTIONAL · ${teammates.length} / ${MAX_TEAMMATE_EMAILS}`}
              </span>
              <button
                type="button"
                onClick={handleAddTeammate}
                disabled={teammates.length >= MAX_TEAMMATE_EMAILS}
                className={`${opsButtonClassName("ghost")} disabled:cursor-not-allowed disabled:opacity-40`}
              >
                + ADD
              </button>
            </div>
            {teammates.length === 0 ? (
              <p className="m-0 text-[length:var(--font-size-tag)] text-[var(--dim)]">
                Solo for now. Add up to {MAX_TEAMMATE_EMAILS} teammates to share
                the plan with co-founders or technical leads.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {teammates.map((t, i) => (
                  <div key={t.id} className="flex items-end gap-2">
                    <div className="flex-1">
                      <FormField
                        label={`// TEAMMATE_${String(i + 1).padStart(2, "0")}`}
                        type="email"
                        placeholder={`teammate-${i + 1}@studio.com`}
                        value={t.value}
                        onChange={(v) => handleTeammateChange(t.id, v)}
                        autoComplete="off"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTeammate(t.id)}
                      className={opsButtonClassName("ghost")}
                      aria-label={`Remove teammate ${i + 1}`}
                    >
                      REMOVE
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--line)] pt-5">
            <p className="m-0 max-w-[42ch] text-[length:var(--font-size-tag)] text-[var(--dim)]">
              We send one email per recipient with the same private link. No
              marketing list. No signup required.
            </p>
            <button
              type="submit"
              disabled={
                submitState !== "idle" ||
                !primaryEmail.trim() ||
                !primaryName.trim()
              }
              className={`${opsButtonClassName("solid")} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {submitState === "idle" ? "EMAIL ME THE PLAN →" : null}
              {submitState === "submitting" ? "SENDING…" : null}
              {submitState === "submitted" ? "SENT — CHECK YOUR INBOX" : null}
            </button>
          </div>
        </form>
      </OpsSection>

      {/* CTA — bottom: talk to a founder ------------------------------- */}
      <section
        id="talk-to-a-founder"
        className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y)] max-[1020px]:py-[var(--cta-pad-y-lg)] max-[760px]:py-[var(--cta-pad-y-md)]"
        style={{ background: "var(--bg-cta-glow), var(--bg)" }}
      >
        <OpsContainer>
          <div className="grid grid-cols-[1.4fr_1fr] items-end gap-16 max-[880px]:grid-cols-1 max-[880px]:gap-9">
            <div>
              <div className="mb-5 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// HUMAN_HANDOFF"}
              </div>
              <h2 className="m-0 mb-7 max-w-[20ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                PREFER A{" "}
                <span className="text-[var(--accent)]">FOUNDER</span> ON THE
                LINE?
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                The planner is fast for an outline, but if you&apos;d rather
                walk a real human through the project, we&apos;re happy to do
                that instead. 30 minutes, video call, no pitch — bring the
                problem and we&apos;ll co-draft the plan live.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={HELP_HREF} className={opsButtonClassName("solid")}>
                  EMAIL_A_FOUNDER →
                </Link>
                <Link href="/pricing" className={opsButtonClassName("ghost")}>
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// FORMAT", v: "30 min · video" },
                { k: "// AUDIENCE", v: "founders, PMs, eng leads" },
                { k: "// OUTCOME", v: "live plan + tier fit" },
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

// =============================================================================
// Subcomponents
// =============================================================================

function ChatBubble({ role, text }: { role: ChatRole; text: string }) {
  const isAgent = role === "agent";
  return (
    <div
      className={`flex w-full ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[80ch] border px-4 py-3 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] ${
          isAgent
            ? "border-[var(--line2)] bg-[var(--bg)] text-[var(--txt2)]"
            : "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))] text-[var(--txt)]"
        }`}
      >
        <div
          className={`mb-1 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] ${
            isAgent ? "text-[var(--accent)]" : "text-[var(--dim)]"
          }`}
        >
          {isAgent ? "// PLANNER" : "// YOU"}
        </div>
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="border border-[var(--line2)] bg-[var(--bg)] px-4 py-3">
        <div className="mb-1 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--accent)]">
          {"// PLANNER"}
        </div>
        <div className="flex items-center gap-[4px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--accent)] [animation:planner-blink_1.1s_ease-in-out_infinite]"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
          <style>
            {`@keyframes planner-blink { 0%, 80%, 100% { opacity: 0.25 } 40% { opacity: 1 } }`}
          </style>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  type,
  required,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: "text" | "email";
  required?: boolean;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[var(--accent)]">
            *
          </span>
        ) : null}
      </span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="block w-full border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-[length:var(--font-size-base)] leading-[var(--lh-normal)] text-[var(--txt)] placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:outline-none"
      />
    </label>
  );
}
