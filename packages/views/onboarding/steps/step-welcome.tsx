"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { MulticaIcon } from "@multica/ui/components/common/multica-icon";
import { cn } from "@multica/ui/lib/utils";
import { DragStrip } from "@multica/views/platform";
import { STATUS_CONFIG } from "@multica/core/issues/config";
import type { IssueStatus } from "@multica/core/types";
import { StatusIcon } from "../../issues/components/status-icon";
import { ProviderLogo } from "../../runtimes/components/provider-logo";

/**
 * Step 0 — one-shot product intro shown on every onboarding entry.
 *
 * Layout collapses cleanly across breakpoints — the right-column live
 * preview moves BELOW the copy on <lg rather than disappearing, so every
 * viewport sees the product story:
 *
 *   <sm  single column, 3 cards, no rotation, full-width
 *   sm   single column, 4 cards, slight rotation reintroduced
 *   md   single column, 4 cards
 *   lg+  two-column editorial hero, 5 rotated cards in a stacked pile
 *
 * Animation is gated by IntersectionObserver (don't burn frames before
 * the user can see it on mobile), tab visibility, mouse hover (lg+ only),
 * and `prefers-reduced-motion` (skips straight to final state).
 *
 * `onSkip`, when provided, renders a demoted text-link CTA below the
 * primary that marks onboarding complete and lands the user in their
 * existing workspace. OnboardingFlow only passes it when the user has
 * ≥ 1 workspace — without that, skipping lands in limbo.
 */
export function StepWelcome({
  onNext,
  onSkip,
}: {
  onNext: () => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
}) {
  const [pending, setPending] = useState<"next" | "skip" | null>(null);

  const handleNext = async () => {
    if (pending) return;
    setPending("next");
    try {
      await onNext();
    } finally {
      setPending(null);
    }
  };

  const handleSkip = async () => {
    if (pending || !onSkip) return;
    setPending("skip");
    try {
      await onSkip();
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="animate-onboarding-enter grid min-h-screen grid-cols-1 lg:h-full lg:min-h-0 lg:grid-cols-2">
      {/* Left — wordmark, headline, lede, roadmap, CTA */}
      <div className="flex flex-col">
        <DragStrip />
        <div className="flex flex-1 flex-col justify-center px-5 pb-10 pt-8 sm:px-8 sm:pb-12 sm:pt-10 md:px-12 lg:px-16 xl:px-20 2xl:px-24">
          <div className="flex w-full max-w-[560px] flex-col gap-6 sm:gap-8">
            <div className="flex items-center gap-2.5">
              <MulticaIcon className="size-5 text-foreground" noSpin />
              <span className="font-serif text-lg font-medium tracking-tight sm:text-xl">
                Welcome to Agenthost
              </span>
            </div>

            <h1 className="text-balance font-serif text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
              Your AI teammates,
              <br className="hidden lg:block" />
              {" "}in <em className="italic text-brand">one workspace.</em>
            </h1>

            <div className="flex flex-col gap-3.5">
              <p className="text-base leading-relaxed text-foreground/85 sm:text-lg">
                Assign them work like you&apos;d assign a colleague — they
                pick it up, update status, and comment when done.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                By the end, a real agent will be replying to your first issue.
              </p>
            </div>

            <Roadmap />

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                size="lg"
                onClick={handleNext}
                disabled={pending !== null}
                className="w-full sm:w-auto"
              >
                {pending === "next" && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Start exploring
                <ArrowRight className="h-4 w-4" />
              </Button>
              {onSkip && (
                // Demoted to a text-link CTA so the visual hierarchy reads
                // primary→secondary. py-3 keeps a 44px touch target for
                // mobile despite the smaller visual footprint.
                <button
                  type="button"
                  onClick={handleSkip}
                  disabled={pending !== null}
                  className="inline-flex items-center justify-center gap-1.5 self-center px-2 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50 sm:self-auto"
                >
                  {pending === "skip" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  I&apos;ve done this before
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right (lg+) / Below (<lg) — animated activity preview.
          On <lg the column flows below the left as part of the page
          scroll; the muted background keeps it visually distinct. */}
      <div className="border-t bg-muted/40 lg:border-l lg:border-t-0">
        <div className="hidden lg:block">
          <DragStrip />
        </div>
        <div className="flex flex-col items-center justify-center gap-5 px-5 py-10 sm:gap-6 sm:px-8 sm:py-14 lg:h-full lg:gap-7 lg:py-8">
          <p className="hidden max-w-[440px] text-balance text-center font-serif text-[15px] italic leading-snug text-muted-foreground lg:block">
            Every issue, every thread, every decision — shared by your team and
            agents.
          </p>
          <p className="text-center font-serif text-[13px] italic uppercase tracking-wide text-muted-foreground lg:hidden">
            See it in action
          </p>
          <ActivityPreview />
        </div>
      </div>
    </div>
  );
}

const ROADMAP = [
  "Tell us about your team",
  "Name your workspace",
  "Connect a runtime",
  "Create your first agent",
  "Assign your first issue",
] as const;

function Roadmap() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Takes ~2 minutes · 5 quick steps
      </p>
      <ol className="flex flex-col gap-2.5">
        {ROADMAP.map((label, i) => (
          <li key={label} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border bg-background text-[11px] font-semibold text-foreground/70"
            >
              {i + 1}
            </span>
            <span className="text-foreground/85">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Discrete visual states of the preview stack. Advancing through them
// tells the "human assigns → agent works → agents collaborate" arc.
//   0  cleared (initial / between loop iterations)
//   1  user card visible
//   2  content-agent card visible, in_progress + pulsing
//   3  content-agent flips to done
//   4  research card joins
//   5  review card joins
//   6  coding card joins — full state, held before reset
const PHASE_DELAYS = [600, 900, 1600, 700, 700, 700, 3500] as const;
const TOTAL_PHASES = PHASE_DELAYS.length - 1;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const update = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

function ActivityPreview() {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [phase, setPhase] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);

  // On <lg the preview is below-the-fold; we only want the loop to run
  // when it's actually on screen so the first beats aren't missed.
  // On lg+ the preview is in the hero — it intersects on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? false),
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hidden-tab pause prevents background frame burn and keeps the loop
  // from desyncing — when the user returns, advance from the current
  // phase rather than catching up.
  useEffect(() => {
    const onVis = () => setPaused(document.visibilityState !== "visible");
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Phase advancer — single timeout chain so each beat owns its duration.
  // Wraps from TOTAL_PHASES → 0 to restart, with phase 0's delay covering
  // the cross-fade gap so cards visibly clear before re-appearing.
  useEffect(() => {
    if (reducedMotion) {
      setPhase(TOTAL_PHASES);
      return;
    }
    if (paused || !inView) return;
    const delay = PHASE_DELAYS[phase] ?? 1000;
    const id = window.setTimeout(() => {
      setPhase((p) => (p >= TOTAL_PHASES ? 0 : p + 1));
    }, delay);
    return () => window.clearTimeout(id);
  }, [phase, paused, inView, reducedMotion]);

  // Mouse-only pause-on-hover (touch never fires onMouseEnter, which is
  // the desired behavior — mobile users have no other hint that the
  // animation can be paused, so we just let it loop).
  const hoverHandlers = !reducedMotion
    ? {
        onMouseEnter: () => setPaused(true),
        onMouseLeave: () => setPaused(false),
      }
    : undefined;

  return (
    <div
      ref={containerRef}
      className="flex w-full max-w-[460px] flex-col gap-2.5 sm:gap-3"
      role="img"
      aria-label="Preview of human and agent activity in a shared workspace"
      {...hoverHandlers}
    >
      <PreviewCard
        show={phase >= 1}
        actor={{ kind: "user", name: "You", initial: "N" }}
        issueId="MCA-42"
        content={
          <>
            <Mention>@Content Agent</Mention> can you draft a short launch
            post? Pull from <Mention>@Research Agent</Mention>&apos;s interview
            findings.
          </>
        }
      />
      <PreviewCard
        show={phase >= 2}
        offsetClassName="lg:-translate-x-5 lg:-rotate-[1.2deg]"
        actor={{ kind: "agent", name: "Content Agent", provider: "codex" }}
        issueId="MCA-42"
        content={
          <>
            On it. Pulling Research&apos;s quotes, drafting around the
            &ldquo;time saved&rdquo; angle…
          </>
        }
        status={phase >= 3 ? "done" : "in_progress"}
        timestamp={phase >= 3 ? "just now" : undefined}
      />
      <PreviewCard
        show={phase >= 4}
        offsetClassName="lg:translate-x-8 lg:rotate-[1.6deg]"
        actor={{ kind: "agent", name: "Research Agent", provider: "hermes" }}
        issueId="MCA-38"
        content="This week's user interviews summarized — 12 calls, 4 recurring themes, 3 pull-quotes."
        status="done"
        timestamp="15 min ago"
      />
      <PreviewCard
        show={phase >= 5}
        // Hidden < sm to keep the mobile preview short (3 cards) — these
        // breakpoints are the responsive density tiers from the design.
        hideBelow="sm"
        offsetClassName="lg:-translate-x-6 lg:-rotate-[0.8deg]"
        actor={{ kind: "agent", name: "Review Agent", provider: "openclaw" }}
        issueId="MCA-42"
        content="Reviewed Monday's draft — left 4 notes on tone. Standing by for the new one."
        status="in_review"
      />
      <PreviewCard
        show={phase >= 6}
        // Card 5 only renders on lg+; mobile/tablet stop at 4 cards.
        hideBelow="lg"
        offsetClassName="lg:translate-x-6 lg:rotate-[1deg]"
        actor={{ kind: "agent", name: "Coding Agent", provider: "claude" }}
        issueId="MCA-35"
        content={
          <>
            Shipped the export feature <Mention>@you</Mention> flagged.
            Preview link in the PR.
          </>
        }
        status="done"
        timestamp="just now"
      />
    </div>
  );
}

type ProviderName =
  | "claude"
  | "codex"
  | "opencode"
  | "openclaw"
  | "hermes"
  | "pi"
  | "copilot"
  | "cursor";

type ActivityActor =
  | { kind: "user"; name: string; initial: string }
  | { kind: "agent"; name: string; provider: ProviderName };

function PreviewCard({
  show,
  actor,
  issueId,
  content,
  status,
  timestamp,
  offsetClassName,
  hideBelow,
}: {
  show: boolean;
  actor: ActivityActor;
  issueId: string;
  content: React.ReactNode;
  status?: Extract<IssueStatus, "in_progress" | "done" | "in_review">;
  timestamp?: string;
  offsetClassName?: string;
  hideBelow?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3.5 shadow-sm",
        "transition-all duration-500 ease-out will-change-[opacity,transform]",
        show
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-1 opacity-0",
        // Decorative hover (lg+ only). Cards aren't clickable — ambient polish.
        "lg:hover:-translate-y-0.5 lg:hover:rotate-0 lg:hover:shadow-md",
        offsetClassName,
        hideBelow === "sm" && "hidden sm:block",
        hideBelow === "md" && "hidden md:block",
        hideBelow === "lg" && "hidden lg:block",
      )}
      aria-hidden={!show}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <PreviewAvatar actor={actor} />
          <span className="truncate text-sm font-medium text-foreground">
            {actor.name}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
          {issueId}
        </span>
      </div>

      <p className="mt-2.5 break-words text-sm leading-snug text-foreground/85">
        {content}
      </p>

      {status && <StatusFooter status={status} timestamp={timestamp} />}
    </div>
  );
}

function PreviewAvatar({ actor }: { actor: ActivityActor }) {
  if (actor.kind === "user") {
    return (
      <div
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold text-background"
      >
        {actor.initial}
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-muted/40 text-foreground"
    >
      <ProviderLogo provider={actor.provider} className="h-3.5 w-3.5" />
    </div>
  );
}

function StatusFooter({
  status,
  timestamp,
}: {
  status: IssueStatus;
  timestamp?: string;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span
        className={cn(
          "flex items-center gap-1.5 font-medium transition-colors",
          cfg.iconColor,
        )}
      >
        <StatusIcon
          status={status}
          className={cn(
            "h-3.5 w-3.5",
            status === "in_progress" && "animate-pulse",
          )}
        />
        {cfg.label}
      </span>
      {timestamp && (
        <>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{timestamp}</span>
        </>
      )}
    </div>
  );
}

function Mention({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-brand">{children}</span>;
}
