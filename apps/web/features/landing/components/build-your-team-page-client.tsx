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

// =============================================================================
// /build-your-team — chat planner with conversational email capture
//
// Single chat conversation drives the whole flow:
//   1. Agent runs the 6-question interview.
//   2. Agent calls `generate_plan` (server emits `plan_ready` → page shows
//      the gist + recommended-tier card).
//   3. Agent continues IN THE CHAT: asks for name → email → teammates.
//   4. Agent calls `submit_capture` (server emits `capture_started`,
//      executes the capture, emits `capture_completed` with the hotlink).
//   5. Agent's final turn confirms delivery with the inline plan URL.
//
// There is no separate email-capture form section — the chat is the form.
//
// UI states:
//   - Pre-conversation (only the seeded greeting): chat is inline in
//     the page, hero + CTA visible.
//   - Conversation active: chat enters "focus mode" — fixed full-viewport
//     overlay with backdrop, body scroll locked, mobile-edge-to-edge.
//     Stays in focus mode through plan generation AND email collection.
//   - After capture_completed: focus mode auto-dismisses; the gist + tier
//     card section becomes visible inline; user can keep reading.
// =============================================================================

type Phase =
  | "interview"        // user can type, awaiting their next message
  | "streaming"        // request in flight, agent text streaming
  | "generating_plan"  // generate_plan tool call in progress
  | "plan_drafted"     // plan returned; chat continues for email collection
  | "capture_pending"  // submit_capture tool call in progress
  | "delivered"        // capture done, hotlink known; chat input locked
  | "error";

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

interface CaptureSuccess {
  hash: string;
  plan_url: string;
  recipients_emailed: number;
}

export function BuildYourTeamPageClient() {
  const [messages, setMessages] = useState<ChatMessage[]>(SEEDED_MESSAGES);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("interview");
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [capture, setCapture] = useState<CaptureSuccess | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const gistRef = useRef<HTMLDivElement | null>(null);

  // Focus mode kicks in once the user has sent any message and stays on
  // through the entire interview + email-collection flow. Auto-dismisses
  // when the agent confirms delivery (or on terminal error).
  const isFocused =
    messages.length > 1 && phase !== "delivered" && phase !== "error";

  const isStreaming =
    phase === "streaming" ||
    phase === "generating_plan" ||
    phase === "capture_pending";

  const inputLocked = isStreaming || phase === "delivered";

  // Lock body scroll when focus mode is on so the page underneath
  // doesn't move while the user is in the chat.
  useEffect(() => {
    if (!isFocused) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isFocused]);

  // Scroll the messages container ONLY — never the page. The earlier
  // scrollIntoView call would walk up to the nearest scrollable
  // ancestor (the window) and jump the whole page on every send.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  // After delivered (focus mode dismisses), bring the gist into view.
  useEffect(() => {
    if (phase === "delivered") {
      const id = window.setTimeout(() => {
        gistRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 200);
      return () => window.clearTimeout(id);
    }
  }, [phase]);

  async function streamChat(history: ChatMessage[]) {
    setPhase("streaming");
    setErrorMessage(null);

    // Skip the seeded greeting — Anthropic requires the first API
    // message to be `user`, and the greeting is purely UI.
    const apiMessages: PlannerChatMessage[] = history.slice(1).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    const lastMsg = apiMessages.at(-1);
    if (!lastMsg || lastMsg.role !== "user") {
      setPhase("interview");
      return;
    }

    const agentId = `a-${Date.now()}`;
    let accumulated = "";
    let agentMessageAppended = false;
    let sawError = false;
    let nextPhase: Phase | null = null;

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
            if (event.name === "generate_plan") {
              setPhase("generating_plan");
            } else if (event.name === "submit_capture") {
              setPhase("capture_pending");
            }
          } else if (event.type === "plan_ready") {
            setPlan(event.plan);
            nextPhase = "plan_drafted";
          } else if (event.type === "capture_completed") {
            setCapture({
              hash: event.hash,
              plan_url: event.plan_url,
              recipients_emailed: event.recipients_emailed,
            });
            nextPhase = "delivered";
          } else if (event.type === "capture_started") {
            setPhase("capture_pending");
          } else if (event.type === "error") {
            sawError = true;
            setErrorMessage(event.message);
          }
        }
      }
    } catch (err) {
      sawError = true;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Network error talking to the planner.",
      );
    }

    if (sawError) {
      setPhase("error");
    } else if (nextPhase === "delivered") {
      setPhase("delivered");
    } else if (nextPhase === "plan_drafted") {
      // Plan was drafted earlier in the same response, but the response
      // ended without a capture_completed (capture not yet collected).
      // Open the chat for the next user reply.
      setPhase("plan_drafted");
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      // Plain interview turn ended; back to waiting for user input.
      setPhase("interview");
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
    setErrorMessage(null);
    // Drop back to whichever phase we were in before the error so the user
    // can resend. If a plan was drafted, return to plan_drafted; else
    // interview.
    setPhase(plan ? "plan_drafted" : "interview");
    window.setTimeout(() => inputRef.current?.focus(), 50);
  }

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const tier = plan ? TIER_DISPLAY[plan.recommended_tier] : null;
  const inlineChatVisible = !isFocused;

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
              roadmap, and the matching Agenthost tier. Drop your email
              (and up to 3 teammates&apos;) right in the chat and a private
              link to the full plan lands in your inbox.
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

      {/* §01 — INLINE CHAT (initial state, before the user sends anything) */}
      {inlineChatVisible && phase !== "delivered" ? (
        <OpsSection id="planner">
          <OpsSectionHead
            num="§01"
            label="// PLANNER"
            headlineParts={["TELL THE ", "PLANNER", " ABOUT YOUR PROJECT."]}
            toneMap={{ 1: "accent" }}
            sub="Type below. The planner asks one question at a time — it adapts based on your answers and won't waste your time on what you've already covered."
          />
          <ChatPanel
            mode="inline"
            messages={messages}
            input={input}
            setInput={setInput}
            phase={phase}
            isStreaming={isStreaming}
            inputLocked={inputLocked}
            errorMessage={errorMessage}
            userTurnCount={userTurnCount}
            messagesContainerRef={messagesContainerRef}
            inputRef={inputRef}
            onSubmit={handleSendMessage}
            onRetry={handleRetryAfterError}
          />
        </OpsSection>
      ) : null}

      {/* §02 — GIST + RECOMMENDED TIER (visible once delivered) --------- */}
      {phase === "delivered" && plan && tier ? (
        <OpsSection id="gist">
          <div ref={gistRef} className="contents">
            <OpsSectionHead
              num="§02"
              label="// PLAN_PREVIEW"
              headlineParts={[
                "YOUR PLAN ",
                "IN BRIEF.",
                " EMAIL IS ON ITS WAY.",
              ]}
              toneMap={{ 1: "accent" }}
              sub={plan.plan_summary}
            />
            <div className="grid grid-cols-[1.4fr_1fr] gap-10 max-[880px]:grid-cols-1">
              <div className="border border-[var(--line2)] bg-[var(--bg2)] p-7">
                <div className="mb-4 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {"// PLAN_HIGHLIGHTS"}
                </div>
                <ul className="m-0 list-none p-0 text-[length:var(--font-size-base)] text-[var(--txt2)]">
                  {plan.gist_bullets.map((b, i) => (
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
                {capture ? (
                  <div className="mt-6 border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg))] p-5">
                    <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                      {`// SENT · ${capture.recipients_emailed} ${capture.recipients_emailed === 1 ? "RECIPIENT" : "RECIPIENTS"}`}
                    </div>
                    <p className="m-0 mb-2 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt)]">
                      Your private plan link — bookmark it if you want it
                      handy:
                    </p>
                    <a
                      href={capture.plan_url}
                      className="break-all text-[length:var(--font-size-tag)] text-[var(--accent)] underline-offset-2 hover:underline"
                    >
                      {capture.plan_url}
                    </a>
                  </div>
                ) : null}
              </div>

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

      {/* FOCUS-MODE OVERLAY ------------------------------------------------ */}
      {/* Rendered last so it stacks above the page. Fixed positioned, so   */}
      {/* doesn't disturb document flow.                                     */}
      {isFocused ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] p-6 backdrop-blur-md max-[760px]:p-0"
          role="dialog"
          aria-label="Agenthost planner conversation"
        >
          <div className="flex h-full max-h-[100dvh] w-full max-w-[860px] flex-col border border-[var(--line2)] bg-[var(--bg2)] max-[760px]:border-0">
            <ChatPanel
              mode="focused"
              messages={messages}
              input={input}
              setInput={setInput}
              phase={phase}
              isStreaming={isStreaming}
              inputLocked={inputLocked}
              errorMessage={errorMessage}
              userTurnCount={userTurnCount}
              messagesContainerRef={messagesContainerRef}
              inputRef={inputRef}
              onSubmit={handleSendMessage}
              onRetry={handleRetryAfterError}
            />
          </div>
        </div>
      ) : null}
    </OpsPageShell>
  );
}

// =============================================================================
// Subcomponents
// =============================================================================

interface ChatPanelProps {
  mode: "inline" | "focused";
  messages: ChatMessage[];
  input: string;
  setInput: (v: string) => void;
  phase: Phase;
  isStreaming: boolean;
  inputLocked: boolean;
  errorMessage: string | null;
  userTurnCount: number;
  messagesContainerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit: (e: FormEvent) => void;
  onRetry: () => void;
}

function ChatPanel(props: ChatPanelProps) {
  const {
    mode,
    messages,
    input,
    setInput,
    phase,
    isStreaming,
    inputLocked,
    errorMessage,
    userTurnCount,
    messagesContainerRef,
    inputRef,
    onSubmit,
    onRetry,
  } = props;

  const indicatorLabel =
    phase === "generating_plan"
      ? "BUILDING YOUR PLAN"
      : phase === "capture_pending"
        ? "SENDING THE EMAIL"
        : "PLANNER";

  const placeholder =
    phase === "delivered"
      ? "Plan delivered — check your inbox"
      : phase === "plan_drafted"
        ? "Reply to keep going (name, email, teammates)…"
        : "Describe what you're building…";

  const wrapperClasses =
    mode === "focused"
      ? "flex h-full flex-col"
      : "flex flex-col border border-[var(--line2)] bg-[var(--bg2)]";

  // Heights differ between modes: focused fills the viewport; inline caps
  // at a comfortable reading height with internal scroll.
  const messagesAreaClasses =
    mode === "focused"
      ? "flex flex-1 flex-col gap-4 overflow-y-auto px-[18px] py-6 max-[760px]:px-4"
      : "flex max-h-[480px] min-h-[360px] flex-col gap-4 overflow-y-auto px-[18px] py-6";

  return (
    <div className={wrapperClasses}>
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line2)] px-[18px] py-[12px]">
        <div className="flex min-w-0 items-center gap-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
          <span className="truncate text-[var(--accent)]">
            {"// AGENTHOST_PLANNER"}
          </span>
          <span aria-hidden="true">·</span>
          <span className="flex flex-none items-center gap-2">
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
        <div className="flex flex-none items-center gap-3 text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
          {phase === "delivered" ? "DELIVERED" : `${userTurnCount} / ~6+`}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        aria-live="polite"
        className={messagesAreaClasses}
      >
        {messages.map((m) => (
          <ChatBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {isStreaming ? <TypingIndicator label={indicatorLabel} /> : null}
        {phase === "error" && errorMessage ? (
          <ErrorBubble message={errorMessage} onRetry={onRetry} />
        ) : null}
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
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
                onSubmit(e);
              }
            }}
            rows={2}
            placeholder={placeholder}
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
  );
}

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
