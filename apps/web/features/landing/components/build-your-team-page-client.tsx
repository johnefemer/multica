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
import type {
  GeneratedPlan,
  PlannerChatMessage,
  RecommendedTier,
  StreamEvent,
} from "@/lib/landing/team-planner/types";

const CONTACT_EMAIL = "agenthost@kensink.com";
const HELP_HREF = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  "Help me plan my AI team",
)}`;

const MAX_TEAMMATE_EMAILS = 3;

// =============================================================================
// PR 2 — chat backend wired
//
// Chat now streams from /api/landing/team-planner/chat. When the planner
// emits a `plan_ready` event (its `generate_plan` tool call completed),
// the gist + tier card + email-capture form unhide and the chat input
// locks. Email capture itself is still a no-op submit; PR 3 wires it.
// =============================================================================

type Phase =
  | "interview"          // chat active, accepting user input
  | "streaming"          // request in flight, agent text streaming
  | "generating_plan"    // tool call started, plan being assembled
  | "plan_ready"         // plan delivered, chat locked, gist visible
  | "error";             // transport / API error

type ChatRole = "agent" | "user";
interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
}

// The seeded greeting is UI-only — Anthropic requires the first API
// message to be `user`, so we slice this off when posting to the route.
const SEEDED_MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    role: "agent",
    text:
      "Hey 👋 I'm the Agenthost planner. In ~5 minutes I'll map an AI dev team for your project — architecture, CI/CD, roadmap, and the right tier. To start: what are you building? One paragraph in your own words is enough.",
  },
];

const TIER_DISPLAY: Record<
  RecommendedTier,
  { badge: string; name: string; highlights: string[] }
> = {
  solo: {
    badge: "// SOLO_FIT",
    name: "SOLO_FOUNDER",
    highlights: [
      "One-time setup, pay-as-you-go",
      "Unlimited issues, projects, agents",
      "BYOK — your provider keys, your bill",
      "Cancel anytime · no monthly contract",
    ],
  },
  team: {
    badge: "// FEATURED_FIT",
    name: "TEAM_OPERATOR",
    highlights: [
      "Flat monthly per workspace",
      "Unlimited AI tokens (BYOK)",
      "Unlimited humans + agents",
      "Sprint queue, runtimes, audit trail",
    ],
  },
  frontier: {
    badge: "// FRONTIER_FIT",
    name: "FRONTIER_FIRM",
    highlights: [
      "Custom pricing, dedicated infra",
      "AI supervisors + human escalation",
      "Custom runtimes & private models",
      "VPC / on-prem · SSO · audit",
    ],
  },
};

const PLAN_COVERAGE: string[] = [
  "Architecture sketch tailored to your stack and deploy target",
  "CI/CD posture — what to set up first, what can wait",
  "Concrete human ↔ agent balance (e.g. 1 senior eng + 2 coding agents)",
  "Phase 0 setup checklist — your first week of work",
  "6-week roadmap broken into 3 shippable phases",
];

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
  const [phase, setPhase] = useState<Phase>("interview");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const gistRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const isStreaming = phase === "streaming" || phase === "generating_plan";
  const inputLocked = isStreaming || phase === "plan_ready";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => {
    if (phase === "plan_ready") {
      // Give the gist section a beat to render, then bring it into view.
      const id = window.setTimeout(() => {
        gistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 150);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  async function streamChat(history: ChatMessage[]) {
    setPhase("streaming");
    setErrorMessage(null);

    // Skip the seeded greeting (it's UI-only; the API needs the first
    // message to be `user`).
    const apiMessages: PlannerChatMessage[] = history.slice(1).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const lastMsg = apiMessages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") {
      // Defensive: should never happen, but don't kick off a request that
      // the server will reject.
      setPhase("interview");
      return;
    }

    const agentId = `a-${Date.now()}`;
    let accumulated = "";
    let agentMessageAppended = false;
    let sawPlanReady = false;
    let sawError = false;

    try {
      const res = await fetch("/api/landing/team-planner/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok || !res.body) {
        let serverMsg = "The planner is offline right now.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) serverMsg = data.error;
        } catch {
          /* leave default */
        }
        throw new Error(serverMsg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx = buffer.indexOf("\n");
        while (newlineIdx >= 0) {
          const line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);
          newlineIdx = buffer.indexOf("\n");
          if (!line) continue;

          let event: StreamEvent;
          try {
            event = JSON.parse(line) as StreamEvent;
          } catch {
            continue;
          }

          if (event.type === "delta") {
            accumulated += event.text;
            if (!agentMessageAppended) {
              agentMessageAppended = true;
              setMessages((prev) => [
                ...prev,
                { id: agentId, role: "agent", text: accumulated },
              ]);
            } else {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentId ? { ...m, text: accumulated } : m,
                ),
              );
            }
          } else if (event.type === "tool_call_started") {
            setPhase("generating_plan");
          } else if (event.type === "plan_ready") {
            sawPlanReady = true;
            setPlan(event.plan);
            // If the agent never produced a text turn before the tool call,
            // append a brief closing line so the chat doesn't end on the
            // user's message.
            if (!agentMessageAppended) {
              setMessages((prev) => [
                ...prev,
                {
                  id: `a-${Date.now()}-closing`,
                  role: "agent",
                  text:
                    "Plan ready — drop your email below to receive the full version.",
                },
              ]);
            }
          } else if (event.type === "error") {
            sawError = true;
            setErrorMessage(event.message);
          }
        }
      }
    } catch (err) {
      sawError = true;
      setErrorMessage(
        err instanceof Error ? err.message : "Network error talking to the planner.",
      );
    }

    if (sawPlanReady) {
      setPhase("plan_ready");
    } else if (sawError) {
      setPhase("error");
    } else {
      setPhase("interview");
      // Bring focus back so the user can continue answering.
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    if (inputLocked) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    void streamChat(next);
  }

  function handleRetryAfterError() {
    if (phase !== "error") return;
    // Drop the failing user turn so the next attempt can be made cleanly.
    setMessages((prev) => {
      // If the last message is from the user, leave it; the user might
      // want to edit and resend. We just clear the error state so they
      // can press send again.
      return prev;
    });
    setErrorMessage(null);
    setPhase("interview");
    window.setTimeout(() => inputRef.current?.focus(), 50);
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
    window.setTimeout(() => setSubmitState("submitted"), 900);
  }

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const tier = plan ? TIER_DISPLAY[plan.recommended_tier] : null;
  const gistBullets = plan?.gist_bullets ?? PLAN_COVERAGE;

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
                  className={
                    phase === "error"
                      ? "h-[7px] w-[7px] rounded-full bg-[var(--warn)]"
                      : "h-[7px] w-[7px] rounded-full bg-[var(--accent)]"
                  }
                />
                {phase === "error" ? "OFFLINE" : "ONLINE"}
              </span>
            </div>
            <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
              {userTurnCount} / ~6
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
            {isStreaming ? (
              <TypingIndicator
                label={
                  phase === "generating_plan"
                    ? "BUILDING YOUR PLAN"
                    : "PLANNER"
                }
              />
            ) : null}
            {phase === "error" && errorMessage ? (
              <ErrorBubble
                message={errorMessage}
                onRetry={handleRetryAfterError}
              />
            ) : null}
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
                placeholder={
                  phase === "plan_ready"
                    ? "Plan delivered — scroll down to email it"
                    : "Describe what you're building…"
                }
                className="block min-h-[64px] w-full resize-none border border-[var(--line2)] bg-[var(--bg)] px-3 py-2 text-[length:var(--font-size-base)] leading-[var(--lh-normal)] text-[var(--txt)] placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                disabled={inputLocked}
              />
              <button
                type="submit"
                disabled={!input.trim() || inputLocked}
                className={`${opsButtonClassName("solid")} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {isStreaming ? "…" : "SEND →"}
              </button>
            </div>
            <div className="mt-2 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
              Enter to send · Shift+Enter for newline · The planner will not
              answer unrelated questions.
            </div>
          </form>
        </div>
      </OpsSection>

      {/* §02 — GIST + RECOMMENDED TIER (visible after plan_ready) ------- */}
      {phase === "plan_ready" && plan && tier ? (
        <OpsSection id="gist" containerClassName="" >
          <div ref={gistRef} className="contents">
            <OpsSectionHead
              num="§02"
              label="// PLAN_PREVIEW"
              headlineParts={[
                "YOUR PLAN ",
                "IN BRIEF.",
                " FULL VERSION BY EMAIL.",
              ]}
              toneMap={{ 1: "accent" }}
              sub={plan.plan_summary}
            />
            <div className="grid grid-cols-[1.4fr_1fr] gap-10 max-[880px]:grid-cols-1">
              {/* Left: gist bullets */}
              <div className="border border-[var(--line2)] bg-[var(--bg2)] p-7">
                <div className="mb-4 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {"// PLAN_HIGHLIGHTS"}
                </div>
                <ul className="m-0 list-none p-0 text-[length:var(--font-size-base)] text-[var(--txt2)]">
                  {gistBullets.map((b, i) => (
                    <li
                      key={`${i}-${b.slice(0, 16)}`}
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
                <div className="mt-5 text-[length:var(--font-size-tag)] text-[var(--dim)]">
                  Full plan covers: {PLAN_COVERAGE.length} sections including
                  architecture, CI/CD, phase 0, and a 6-week roadmap.
                </div>
              </div>

              {/* Right: recommended tier card */}
              <article className="flex flex-col border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-7">
                <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {tier.badge}
                </div>
                <div className="mb-3 text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                  {tier.name}
                </div>
                <p className="m-0 mb-5 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                  {plan.tier_why}
                </p>
                <ul className="m-0 mb-6 list-none border-t border-[var(--line)] p-0 pt-4 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
                  {tier.highlights.map((h) => (
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
                <Link
                  href={`/pricing#${plan.recommended_tier}`}
                  className={opsButtonClassName("ghost")}
                >
                  SEE_ALL_TIERS
                </Link>
              </article>
            </div>
          </div>
        </OpsSection>
      ) : null}

      {/* §03 — EMAIL CAPTURE (visible after plan_ready) ----------------- */}
      {phase === "plan_ready" && plan ? (
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
      ) : null}

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

function TypingIndicator({ label }: { label: string }) {
  return (
    <div className="flex w-full justify-start">
      <div className="border border-[var(--line2)] bg-[var(--bg)] px-4 py-3">
        <div className="mb-1 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--accent)]">
          {`// ${label}`}
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

function ErrorBubble({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[80ch] border border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--bg))] px-4 py-3 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt)]">
        <div className="mb-1 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--warn)]">
          {"// PLANNER_ERROR"}
        </div>
        <div className="whitespace-pre-wrap">{message}</div>
        <button
          type="button"
          onClick={onRetry}
          className={`${opsButtonClassName("ghost")} mt-3`}
        >
          TRY_AGAIN
        </button>
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
