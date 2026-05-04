"use client";

import { useState } from "react";
import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";
import { OpsSection, OpsSectionHead } from "./ops-primitives";

const FRAME_LABELS = [
  "FRAME_01 · /eng/issues/new",
  "FRAME_02 · daemon.local · runtime claim",
  "FRAME_03 · ENG-242 · live thread",
  "FRAME_04 · review · @mei",
  "FRAME_05 · activity_log · ENG-242",
];

type FlowTone = "warn" | "accent2" | "accent" | "pop";

const FLOW_TONE_CLASSES: Record<FlowTone, { box: string; dot: string; text: string }> = {
  warn: {
    box: "border-[var(--warn)] bg-[color-mix(in_srgb,var(--warn)_8%,var(--bg2))]",
    dot: "bg-[var(--warn)]",
    text: "text-[var(--warn)]",
  },
  accent2: {
    box: "border-[var(--accent2)] bg-[color-mix(in_srgb,var(--accent2)_8%,var(--bg2))]",
    dot: "bg-[var(--accent2)]",
    text: "text-[var(--accent2)]",
  },
  accent: {
    box: "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg2))]",
    dot: "bg-[var(--accent)]",
    text: "text-[var(--accent)]",
  },
  pop: {
    box: "border-[var(--pop)] bg-[color-mix(in_srgb,var(--pop)_8%,var(--bg2))]",
    dot: "bg-[var(--pop)]",
    text: "text-[var(--pop)]",
  },
};

function FlowBox({
  tone,
  label,
  sub,
}: {
  tone: FlowTone;
  label: string;
  sub: string;
}) {
  const t = FLOW_TONE_CLASSES[tone];
  return (
    <div
      className={cn(
        "flex min-w-[110px] flex-1 flex-col items-center gap-1 border px-3 py-[10px]",
        t.box,
      )}
    >
      <span className="flex items-center gap-[6px] text-[length:var(--font-size-tag)] font-[number:var(--weight-bold)] tracking-[var(--tr-label)] text-[var(--txt)]">
        <span className={cn("inline-block h-[6px] w-[6px]", t.dot)} aria-hidden="true" />
        {label}
      </span>
      <span className={cn("text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)]", t.text)}>
        {sub}
      </span>
    </div>
  );
}

function FlowArrow() {
  return (
    <span
      aria-hidden="true"
      className="relative flex h-[2px] flex-1 items-center bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
    >
      <span className="absolute right-[-1px] top-1/2 -translate-y-1/2 text-[length:var(--font-size-tag)] font-[number:var(--weight-bold)] leading-none text-[var(--accent)]">
        ▶
      </span>
    </span>
  );
}

function FlowDiagram() {
  return (
    <div className="border border-[var(--line2)] bg-[var(--bg2)] px-[18px] py-[16px] max-[640px]:hidden">
      <div className="mb-3 flex items-center justify-between text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        <span>{"// FLOW_OF_OPERATIONS"}</span>
        <span className="text-[var(--accent)]">closed_loop · every iteration faster</span>
      </div>

      <div className="flex items-stretch gap-2">
        <FlowBox tone="warn" label="HUMAN" sub="files · reviews" />
        <FlowArrow />
        <FlowBox tone="accent2" label="DAEMON" sub="claims · injects skills" />
        <FlowArrow />
        <FlowBox tone="accent" label="AGENT" sub="codes · streams" />
        <FlowArrow />
        <FlowBox tone="accent" label="PR" sub="merged · closed" />
      </div>

      <div className="mt-[10px] grid grid-cols-[14px_1fr_14px] items-center text-[length:var(--font-size-nano)]">
        <span aria-hidden="true" className="text-[var(--accent)]">↰</span>
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="block h-px flex-1 border-t border-dashed border-[var(--accent)]" />
          <span className="whitespace-nowrap tracking-[var(--tr-tag)] text-[var(--accent)]">
            activity_log <span className="text-[var(--dim)]">·</span> skill_library
          </span>
          <span aria-hidden="true" className="block h-px flex-1 border-t border-dashed border-[var(--accent)]" />
        </div>
        <span aria-hidden="true" className="text-right text-[var(--accent)]">↱</span>
      </div>
      <div className="mt-1 text-center text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// every actor logged · every win replayable"}
      </div>
    </div>
  );
}

function Pill({
  tone = "default",
  children,
}: {
  tone?: "default" | "green" | "gray";
  children: React.ReactNode;
}) {
  const dot =
    tone === "green"
      ? "bg-[var(--accent2)]"
      : tone === "gray"
        ? "bg-[var(--dim)]"
        : "bg-[var(--accent)]";
  return (
    <span className="inline-flex items-center gap-2 border border-[var(--line2)] bg-[var(--bg)] px-[10px] py-1 text-[length:var(--font-size-micro)] text-[var(--txt2)]">
      <span className={cn("inline-block h-[6px] w-[6px]", dot)} />
      {children}
    </span>
  );
}

function FrameNewIssue() {
  return (
    <>
      <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// NEW_ISSUE · ENG-242"}
      </div>
      <div className="mt-1 text-[18px] font-[number:var(--weight-bold)] uppercase leading-[1.3] tracking-[-0.005em] text-[var(--txt)]">
        Add backoff &amp; jitter to daemon heartbeat retries
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Pill>backend</Pill>
        <Pill>p1</Pill>
        <Pill tone="gray">good-first-issue</Pill>
      </div>
      <div className="mt-[14px] border-t border-[var(--line)] pt-[14px] text-[length:var(--font-size-detail)] leading-[var(--lh-log)]">
        <div>
          <span className="text-[var(--dim)]">assignee   →</span>{" "}
          <span className="text-[var(--accent)]">@claude-eng</span>
        </div>
        <div>
          <span className="text-[var(--dim)]">reviewer   →</span>{" "}
          <span className="text-[var(--warn)]">@mei</span>
        </div>
        <div>
          <span className="text-[var(--dim)]">runtime    →</span>{" "}
          <span className="text-[var(--accent2)]">maple-air.local</span>
        </div>
        <div>
          <span className="text-[var(--dim)]">skills     →</span>{" "}
          <span className="text-[var(--txt2)]">go-style, daemon-ops</span>
        </div>
      </div>
      <div className="mt-auto border-t border-dashed border-[var(--line)] pt-[14px] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--accent)]">
        ✓ ASSIGNED · TASK ENQUEUED · WAITING ON RUNTIME
      </div>
    </>
  );
}

function FrameDaemon() {
  return (
    <>
      <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// DAEMON · maple-air.local · poll loop"}
      </div>
      <div className="mt-2 text-[length:var(--font-size-tag)] leading-[1.85]">
        <div className="text-[var(--dim2)]">[09:14:00] heartbeat → ok</div>
        <div className="text-[var(--dim)]">
          [09:14:02] poll → 1 pending task for runtime{" "}
          <i className="text-[var(--txt2)]">maple-air</i>
        </div>
        <div className="text-[var(--accent)]">
          [09:14:02] claim ENG-242 · agent=claude-eng
        </div>
        <div className="text-[var(--dim)]">
          [09:14:02] mkdir ~/agenthost/eng-242/workdir
        </div>
        <div className="text-[var(--dim)]">
          [09:14:02] inject skills → .claude/skills/{"{go-style, daemon-ops}"}
        </div>
        <div className="text-[var(--dim)]">
          [09:14:03] env: ANTHROPIC_API_KEY=*** · CLAUDE_BASE_URL=***
        </div>
        <div className="text-[var(--dim)]">
          [09:14:03] spawn → claude --resume sess_a8f2...
        </div>
        <div className="text-[var(--accent)]">
          [09:14:03] status → running
          <span
            aria-hidden="true"
            className="ml-[2px] inline-block h-3 w-[6px] -translate-y-px bg-[var(--accent)] [animation:ops-caret_1s_steps(2)_infinite]"
          />
        </div>
      </div>
    </>
  );
}

function FrameThread() {
  return (
    <>
      <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// ISSUE_THREAD · streaming"}
      </div>
      <div className="mt-2 flex items-start gap-[10px]">
        <div className="flex h-6 w-6 flex-none items-center justify-center bg-[var(--accent)] text-[9.5px] font-[number:var(--weight-bold)] text-[var(--bg)]">
          CL
        </div>
        <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--accent)]">
            CLAUDE-ENG · 12s ago
          </div>
          <div className="mt-1 text-[var(--txt2)]">
            Reading{" "}
            <span className="text-[var(--accent2)]">
              internal/daemon/heartbeat.go
            </span>{" "}
            — current retry is fixed 5s. Switching to exponential with full jitter,
            capped at 60s.
          </div>
        </div>
      </div>
      <div className="mt-[14px] flex items-start gap-[10px]">
        <div className="flex h-6 w-6 flex-none items-center justify-center bg-[var(--accent)] text-[9.5px] font-[number:var(--weight-bold)] text-[var(--bg)]">
          CL
        </div>
        <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--accent)]">
            CLAUDE-ENG · 4s ago
          </div>
          <div className="mt-1 text-[var(--txt2)]">
            Diff up. 1 file, +18/-6. Tests added in{" "}
            <span className="text-[var(--accent2)]">heartbeat_test.go</span>. Want
            me to open the PR?
          </div>
        </div>
      </div>
      <div className="mt-auto flex gap-2 border-t border-dashed border-[var(--line)] pt-[14px]">
        <Pill>+18 / -6</Pill>
        <Pill tone="green">tests passing</Pill>
        <Pill tone="green">lint clean</Pill>
      </div>
    </>
  );
}

function FrameReview() {
  return (
    <>
      <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// REVIEW · human-in-loop"}
      </div>
      <div className="mt-2 flex items-start gap-[10px]">
        <div className="flex h-6 w-6 flex-none items-center justify-center border border-[var(--line3)] text-[9.5px] font-[number:var(--weight-bold)] text-[var(--txt2)]">
          M
        </div>
        <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--warn)]">
            MEI · just now
          </div>
          <div className="mt-1 text-[var(--txt2)]">
            Looks good — but cap should be{" "}
            <span className="text-[var(--accent2)]">30s</span> not 60s.{" "}
            <span className="text-[var(--accent)]">@claude-eng</span> please update
            and merge.
          </div>
        </div>
      </div>
      <div className="mt-[18px] border border-[var(--line)] bg-[var(--bg)] px-[14px] py-3 text-[length:var(--font-size-label)] leading-[1.6] tracking-[var(--tr-micro)] text-[var(--accent)]">
        → @claude-eng MENTION DETECTED
        <br />
        → TASK RE-DISPATCHED · session_id reused
        <br />
        → workdir restored from sess_a8f2... · context preserved
      </div>
      <div className="mt-auto pt-[14px] text-[length:var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
        {"// human steered · agent continues"}
      </div>
    </>
  );
}

function FrameAudit() {
  return (
    <>
      <div className="text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// AUDIT_TRAIL · every actor"}
      </div>
      <div className="mt-2 text-[11.5px] leading-[var(--lh-audit)] text-[var(--txt2)]">
        <div>
          <span className="text-[var(--dim2)]">09:13:58</span>{" "}
          <span className="text-[var(--warn)]">mei</span>{" "}
          <i className="text-[var(--dim)]">created issue</i>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:13:59</span>{" "}
          <span className="text-[var(--warn)]">mei</span>{" "}
          <i className="text-[var(--dim)]">assigned →</i>{" "}
          <span className="text-[var(--accent)]">claude-eng</span>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:14:02</span>{" "}
          <span className="text-[var(--accent)]">claude-eng</span>{" "}
          <i className="text-[var(--dim)]">started task · sess_a8f2</i>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:14:18</span>{" "}
          <span className="text-[var(--accent)]">claude-eng</span>{" "}
          <i className="text-[var(--dim)]">commented · diff +18/-6</i>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:14:47</span>{" "}
          <span className="text-[var(--accent)]">claude-eng</span>{" "}
          <i className="text-[var(--dim)]">opened PR #883</i>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:15:31</span>{" "}
          <span className="text-[var(--warn)]">mei</span>{" "}
          <i className="text-[var(--dim)]">requested changes · cap=30s</i>
        </div>
        <div>
          <span className="text-[var(--dim2)]">09:16:02</span>{" "}
          <span className="text-[var(--accent)]">claude-eng</span>{" "}
          <i className="text-[var(--dim)]">updated PR · cap=30s · resumed sess</i>
        </div>
        <div className="font-[number:var(--weight-medium)] text-[var(--accent)]">
          <span>09:16:14</span> claude-eng <i>merged · closed ENG-242</i>
        </div>
      </div>
      <div className="mt-auto border-t border-dashed border-[var(--line)] pt-[14px] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--accent)]">
        ✓ TICKET CLOSED · 16M14S · 67.4K TOKENS · $0.08
      </div>
    </>
  );
}

const FRAMES = [
  <FrameNewIssue key="0" />,
  <FrameDaemon key="1" />,
  <FrameThread key="2" />,
  <FrameReview key="3" />,
  <FrameAudit key="4" />,
];

export function OpsWorkflow() {
  const { t } = useLocale();
  const { workflow } = t.ops;
  const [activeStep, setActiveStep] = useState(0);

  return (
    <OpsSection id="workflow">
      <OpsSectionHead
        num={workflow.num}
        label={workflow.label}
        headlineParts={workflow.headlineParts}
        sub={workflow.sub}
        toneMap={{ 2: "accent" }}
      />
      <div className="grid grid-cols-[1fr_1.1fr] border border-[var(--line2)] bg-[var(--bg2)] max-[920px]:grid-cols-1">
        <div className="border-r border-[var(--line2)] py-[6px] max-[920px]:border-r-0 max-[920px]:border-b">
          {workflow.steps.map((step, i) => {
            const isActive = activeStep === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveStep(i)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative grid w-full cursor-pointer grid-cols-[80px_1fr] items-start gap-[18px] border-b border-[var(--line)] px-[26px] py-5 text-left transition-colors duration-[var(--duration-fast)] last:border-b-0 hover:bg-[var(--bg3)]",
                  "max-[760px]:grid-cols-[64px_1fr] max-[760px]:gap-3 max-[760px]:px-[18px] max-[760px]:py-4",
                  isActive && "bg-[var(--bg3)]",
                )}
              >
                {isActive ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-0 bottom-0 w-[2px] bg-[var(--accent)]"
                  />
                ) : null}
                <span
                  className={cn(
                    "text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)]",
                    isActive ? "text-[var(--accent)]" : "text-[var(--dim)]",
                  )}
                >
                  {step.stepnum}
                </span>
                <div>
                  <h5 className="m-0 mb-[6px] text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase leading-[1.25] tracking-[-0.005em] text-[var(--txt)]">
                    {step.h}
                  </h5>
                  <p className="m-0 text-[length:var(--font-size-dense)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                    {step.p}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex min-h-[480px] flex-col gap-[14px] bg-[var(--bg)] p-8 max-[760px]:min-h-[380px] max-[760px]:p-5">
          <div className="text-[length:var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--dim)]">
            <span className="text-[var(--dim2)]">{"// "}</span>
            {FRAME_LABELS[activeStep]}
          </div>
          <div className="relative flex flex-1 flex-col gap-3 border border-[var(--line2)] bg-[var(--bg2)] p-5">
            {FRAMES[activeStep]}
          </div>
          <FlowDiagram />
        </div>
      </div>
    </OpsSection>
  );
}
