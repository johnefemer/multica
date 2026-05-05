"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  PenLine,
  Sparkles,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { cn } from "@multica/ui/lib/utils";
import type {
  QuestionnaireAnswers,
  Role,
  TeamSize,
  UseCase,
} from "@multica/core/onboarding";
import { DragStrip } from "@multica/views/platform";
import { StepHeader } from "../components/step-header";
import { OptionCard, OtherOptionCard } from "../components/option-card";

/**
 * Step 1 — three-question user profile, wizard-style.
 *
 * One question at a time. Picking a concrete option auto-advances after
 * a short delay so the user sees their selection lock in. Picking
 * "Other" reveals an input + manual Continue button — auto-advance
 * would discard the typed text. Q3's concrete pick auto-submits the
 * full payload; Q3 + Other submits via the Finish button.
 *
 * Back walks Q3 → Q2 → Q1 and finally calls the parent's `onBack` if
 * provided. Selections persist across back/forward so the user can
 * edit prior answers without losing them.
 *
 * Right-column "Why we ask" panel is identical content across all
 * sub-steps and hidden on <lg.
 */

const ADVANCE_DELAY_MS = 320;
type SubStep = 1 | 2 | 3;

export function StepQuestionnaire({
  initial,
  onSubmit,
  onBack,
}: {
  initial: QuestionnaireAnswers;
  onSubmit: (answers: QuestionnaireAnswers) => void | Promise<void>;
  onBack?: () => void;
}) {
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(initial);
  const [step, setStep] = useState<SubStep>(1);
  const [submitting, setSubmitting] = useState(false);
  // Brief lock-out window during the auto-advance fade so the user
  // can't double-click into a stale state mid-transition.
  const [transitioning, setTransitioning] = useState(false);
  const advanceTimerRef = useRef<number | null>(null);

  const clearAdvance = () => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  // Cancel any pending advance on unmount so we don't fire setStep /
  // doSubmit on a torn-down component (e.g. user hits Back during
  // the 320ms window).
  useEffect(() => () => clearAdvance(), []);

  const isLocked = transitioning || submitting;

  const isOtherTeamSizeValid =
    answers.team_size === "other" &&
    (answers.team_size_other ?? "").trim() !== "";
  const isOtherRoleValid =
    answers.role === "other" && (answers.role_other ?? "").trim() !== "";
  const isOtherUseCaseValid =
    answers.use_case === "other" &&
    (answers.use_case_other ?? "").trim() !== "";

  const doSubmit = async (payload: QuestionnaireAnswers) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  const advanceTo = (next: SubStep) => {
    setTransitioning(true);
    advanceTimerRef.current = window.setTimeout(() => {
      setStep(next);
      setTransitioning(false);
      advanceTimerRef.current = null;
    }, ADVANCE_DELAY_MS);
  };

  const advanceToSubmit = (payload: QuestionnaireAnswers) => {
    setTransitioning(true);
    advanceTimerRef.current = window.setTimeout(() => {
      void doSubmit(payload);
      // Stay locked while submit awaits; submitting flag keeps isLocked true.
    }, ADVANCE_DELAY_MS);
  };

  const handleSelectTeamSize = (v: TeamSize) => {
    if (isLocked) return;
    clearAdvance();
    setAnswers((a) => ({
      ...a,
      team_size: v,
      team_size_other: v === "other" ? a.team_size_other : null,
    }));
    if (v !== "other") advanceTo(2);
  };

  const handleSelectRole = (v: Role) => {
    if (isLocked) return;
    clearAdvance();
    setAnswers((a) => ({
      ...a,
      role: v,
      role_other: v === "other" ? a.role_other : null,
    }));
    if (v !== "other") advanceTo(3);
  };

  const handleSelectUseCase = (v: UseCase) => {
    if (isLocked) return;
    clearAdvance();
    // Build the submitted payload at click time so doSubmit doesn't
    // race the setState commit.
    const nextAnswers: QuestionnaireAnswers = {
      ...answers,
      use_case: v,
      use_case_other: v === "other" ? answers.use_case_other : null,
    };
    setAnswers(nextAnswers);
    if (v !== "other") advanceToSubmit(nextAnswers);
  };

  const handleOtherTeamSizeContinue = () => {
    if (isLocked || !isOtherTeamSizeValid) return;
    setStep(2);
  };

  const handleOtherRoleContinue = () => {
    if (isLocked || !isOtherRoleValid) return;
    setStep(3);
  };

  const handleOtherUseCaseContinue = () => {
    if (isLocked || !isOtherUseCaseValid) return;
    void doSubmit(answers);
  };

  const handleBack = () => {
    clearAdvance();
    setTransitioning(false);
    if (step === 1) {
      onBack?.();
      return;
    }
    setStep((s) => (s === 3 ? 2 : 1));
  };

  return (
    <div className="animate-onboarding-enter grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_480px]">
      {/* Left — wizard column */}
      <div className="flex min-h-0 flex-col">
        <DragStrip />
        <header className="flex shrink-0 items-center gap-3 bg-background px-5 py-3 sm:gap-4 sm:px-10 md:px-14 lg:px-16">
          <button
            type="button"
            onClick={handleBack}
            disabled={isLocked}
            aria-label={
              step === 1
                ? "Back to previous step"
                : `Back to question ${step - 1}`
            }
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </button>
          <div className="flex-1">
            <StepHeader currentStep="questionnaire" />
          </div>
        </header>

        <main
          className="min-h-0 flex-1 overflow-y-auto"
          aria-busy={isLocked}
        >
          {/* `key={step}` remounts the card per sub-step so the
              `animate-onboarding-enter` keyframe replays — the same
              fade/rise idiom used at the top-level step boundary. */}
          <div
            key={step}
            className={cn(
              "mx-auto w-full max-w-[620px] animate-onboarding-enter px-5 py-8 sm:px-10 sm:py-10 md:px-14 lg:px-0 lg:py-12",
              isLocked && "pointer-events-none",
            )}
          >
            <SubStepIndicator step={step} />

            {step === 1 && (
              <Q1
                answers={answers}
                onSelect={handleSelectTeamSize}
                onOtherChange={(v) =>
                  setAnswers((a) => ({ ...a, team_size_other: v }))
                }
                onOtherContinue={handleOtherTeamSizeContinue}
                otherValid={isOtherTeamSizeValid}
              />
            )}
            {step === 2 && (
              <Q2
                answers={answers}
                onSelect={handleSelectRole}
                onOtherChange={(v) =>
                  setAnswers((a) => ({ ...a, role_other: v }))
                }
                onOtherContinue={handleOtherRoleContinue}
                otherValid={isOtherRoleValid}
              />
            )}
            {step === 3 && (
              <Q3
                answers={answers}
                onSelect={handleSelectUseCase}
                onOtherChange={(v) =>
                  setAnswers((a) => ({ ...a, use_case_other: v }))
                }
                onOtherContinue={handleOtherUseCaseContinue}
                otherValid={isOtherUseCaseValid}
                submitting={submitting}
              />
            )}
          </div>
        </main>
      </div>

      {/* Right — "Why we ask" side panel, static across sub-steps */}
      <aside className="hidden min-h-0 border-l bg-muted/40 lg:flex lg:flex-col">
        <DragStrip />
        <div className="min-h-0 flex-1 overflow-y-auto px-12 py-12">
          <WhyWeAsk />
        </div>
      </aside>
    </div>
  );
}

function SubStepIndicator({ step }: { step: SubStep }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Question ${step} of 3`}
      className="mb-5 flex items-center gap-3"
    >
      <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground tabular-nums">
        Question {step} of 3
      </span>
      <div className="flex gap-1.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-1.5 rounded-full transition-colors",
              i < step && "bg-foreground/40",
              i === step && "bg-foreground",
              i > step && "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionShell({
  num,
  question,
  ariaLabel,
  children,
  otherActive,
  otherValid,
  onOtherContinue,
  isLast,
  submitting,
}: {
  num: number;
  question: string;
  ariaLabel: string;
  children: ReactNode;
  otherActive: boolean;
  otherValid: boolean;
  onOtherContinue: () => void;
  isLast: boolean;
  submitting?: boolean;
}) {
  return (
    <div>
      <div className="mb-6 flex items-baseline gap-3">
        <span className="font-mono text-xs text-muted-foreground">
          {String(num).padStart(2, "0")}
        </span>
        <h1 className="text-balance font-serif text-[26px] font-medium leading-[1.15] tracking-tight text-foreground sm:text-[30px] md:text-[34px]">
          {question}
        </h1>
      </div>
      <fieldset role="radiogroup" aria-label={ariaLabel} className="m-0 p-0">
        <div className="flex flex-col gap-2">{children}</div>
        {otherActive && (
          <div className="mt-5 flex justify-end">
            <Button
              size="lg"
              onClick={onOtherContinue}
              disabled={!otherValid || submitting}
              className="w-full sm:w-auto"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLast ? "Finish" : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </fieldset>
    </div>
  );
}

function Q1({
  answers,
  onSelect,
  onOtherChange,
  onOtherContinue,
  otherValid,
}: {
  answers: QuestionnaireAnswers;
  onSelect: (v: TeamSize) => void;
  onOtherChange: (v: string) => void;
  onOtherContinue: () => void;
  otherValid: boolean;
}) {
  return (
    <QuestionShell
      num={1}
      question="Who will use this workspace?"
      ariaLabel="Who will use this workspace?"
      otherActive={answers.team_size === "other"}
      otherValid={otherValid}
      onOtherContinue={onOtherContinue}
      isLast={false}
    >
      <OptionCard
        selected={answers.team_size === "solo"}
        onSelect={() => onSelect("solo")}
        label="Just me"
      />
      <OptionCard
        selected={answers.team_size === "team"}
        onSelect={() => onSelect("team")}
        label="My team (2–10 people)"
      />
      <OtherOptionCard
        selected={answers.team_size === "other"}
        onSelect={() => onSelect("other")}
        otherValue={answers.team_size_other ?? ""}
        onOtherChange={onOtherChange}
        placeholder="e.g. a small community I help run"
      />
    </QuestionShell>
  );
}

function Q2({
  answers,
  onSelect,
  onOtherChange,
  onOtherContinue,
  otherValid,
}: {
  answers: QuestionnaireAnswers;
  onSelect: (v: Role) => void;
  onOtherChange: (v: string) => void;
  onOtherContinue: () => void;
  otherValid: boolean;
}) {
  return (
    <QuestionShell
      num={2}
      question="What best describes you?"
      ariaLabel="What best describes you?"
      otherActive={answers.role === "other"}
      otherValid={otherValid}
      onOtherContinue={onOtherContinue}
      isLast={false}
    >
      <OptionCard
        selected={answers.role === "developer"}
        onSelect={() => onSelect("developer")}
        label="Software developer"
      />
      <OptionCard
        selected={answers.role === "product_lead"}
        onSelect={() => onSelect("product_lead")}
        label="Product or project lead"
      />
      <OptionCard
        selected={answers.role === "writer"}
        onSelect={() => onSelect("writer")}
        label="Writer or content creator"
      />
      <OptionCard
        selected={answers.role === "founder"}
        onSelect={() => onSelect("founder")}
        label="Founder or operator"
      />
      <OtherOptionCard
        selected={answers.role === "other"}
        onSelect={() => onSelect("other")}
        otherValue={answers.role_other ?? ""}
        onOtherChange={onOtherChange}
        placeholder="e.g. researcher, designer, ops lead"
      />
    </QuestionShell>
  );
}

function Q3({
  answers,
  onSelect,
  onOtherChange,
  onOtherContinue,
  otherValid,
  submitting,
}: {
  answers: QuestionnaireAnswers;
  onSelect: (v: UseCase) => void;
  onOtherChange: (v: string) => void;
  onOtherContinue: () => void;
  otherValid: boolean;
  submitting: boolean;
}) {
  return (
    <QuestionShell
      num={3}
      question="What do you want to do with Agenthost?"
      ariaLabel="What do you want to do with Agenthost?"
      otherActive={answers.use_case === "other"}
      otherValid={otherValid}
      onOtherContinue={onOtherContinue}
      isLast={true}
      submitting={submitting}
    >
      <OptionCard
        selected={answers.use_case === "coding"}
        onSelect={() => onSelect("coding")}
        label="Write and ship code"
      />
      <OptionCard
        selected={answers.use_case === "planning"}
        onSelect={() => onSelect("planning")}
        label="Plan and manage projects"
      />
      <OptionCard
        selected={answers.use_case === "writing_research"}
        onSelect={() => onSelect("writing_research")}
        label="Research or write"
      />
      <OptionCard
        selected={answers.use_case === "explore"}
        onSelect={() => onSelect("explore")}
        label="I'm just exploring for now"
      />
      <OtherOptionCard
        selected={answers.use_case === "other"}
        onSelect={() => onSelect("other")}
        otherValue={answers.use_case_other ?? ""}
        onOtherChange={onOtherChange}
        placeholder="e.g. automate my weekly reports"
      />
    </QuestionShell>
  );
}

function WhyWeAsk() {
  return (
    <div className="flex max-w-[380px] flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Why three questions
        </div>
        <h2 className="font-serif text-[22px] font-medium leading-[1.25] tracking-tight text-foreground">
          So you land running.
        </h2>
      </section>

      <section className="flex flex-col gap-4">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
          What you get
        </div>
        <div className="flex flex-col gap-4">
          <UnlockItem
            icon={<PenLine className="h-4 w-4" />}
            title="A starter project, tailored"
            body="A Getting Started checklist shaped by your answers."
          />
          <UnlockItem
            icon={<Sparkles className="h-4 w-4" />}
            title="A head start with agents"
            body="Connect a runtime and we'll pick a template for your role — plus write its first task."
          />
        </div>
      </section>

      <a
        href="https://multica.ai/docs/agents"
        target="_blank"
        rel="noopener noreferrer"
        className="self-start text-[13px] text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
      >
        Learn how agents work →
      </a>
    </div>
  );
}

function UnlockItem({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[22px_1fr] gap-3">
      <div
        aria-hidden
        className="flex h-[20px] w-[20px] items-center justify-center text-muted-foreground"
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <div className="text-[13.5px] font-medium text-foreground">{title}</div>
        <div className="mt-1 text-[12.5px] leading-[1.55] text-muted-foreground">
          {body}
        </div>
      </div>
    </div>
  );
}
