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
    <span className="inline-flex items-center gap-2 border border-[var(--line2)] bg-[var(--bg)] px-[10px] py-1 text-[var(--font-size-micro)] text-[var(--txt2)]">
      <span className={cn("inline-block h-[6px] w-[6px]", dot)} />
      {children}
    </span>
  );
}

function FrameNewIssue() {
  return (
    <>
      <div className="text-[var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// NEW_ISSUE · ENG-242"}
      </div>
      <div className="mt-1 text-[18px] font-[var(--weight-bold)] uppercase leading-[1.3] tracking-[-0.005em] text-[var(--txt)]">
        Add backoff &amp; jitter to daemon heartbeat retries
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Pill>backend</Pill>
        <Pill>p1</Pill>
        <Pill tone="gray">good-first-issue</Pill>
      </div>
      <div className="mt-[14px] border-t border-[var(--line)] pt-[14px] text-[var(--font-size-detail)] leading-[var(--lh-log)]">
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
      <div className="mt-auto border-t border-dashed border-[var(--line)] pt-[14px] text-[var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--accent)]">
        ✓ ASSIGNED · TASK ENQUEUED · WAITING ON RUNTIME
      </div>
    </>
  );
}

function FrameDaemon() {
  return (
    <>
      <div className="text-[var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// DAEMON · maple-air.local · poll loop"}
      </div>
      <div className="mt-2 text-[var(--font-size-tag)] leading-[1.85]">
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
      <div className="text-[var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// ISSUE_THREAD · streaming"}
      </div>
      <div className="mt-2 flex items-start gap-[10px]">
        <div className="flex h-6 w-6 flex-none items-center justify-center bg-[var(--accent)] text-[9.5px] font-[var(--weight-bold)] text-[var(--bg)]">
          CL
        </div>
        <div className="text-[var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--accent)]">
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
        <div className="flex h-6 w-6 flex-none items-center justify-center bg-[var(--accent)] text-[9.5px] font-[var(--weight-bold)] text-[var(--bg)]">
          CL
        </div>
        <div className="text-[var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--accent)]">
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
      <div className="text-[var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
        {"// REVIEW · human-in-loop"}
      </div>
      <div className="mt-2 flex items-start gap-[10px]">
        <div className="flex h-6 w-6 flex-none items-center justify-center border border-[var(--line3)] text-[9.5px] font-[var(--weight-bold)] text-[var(--txt2)]">
          M
        </div>
        <div className="text-[var(--font-size-tag)] leading-[var(--lh-normal)]">
          <div className="text-[var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--warn)]">
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
      <div className="mt-[18px] border border-[var(--line)] bg-[var(--bg)] px-[14px] py-3 text-[var(--font-size-label)] leading-[1.6] tracking-[var(--tr-micro)] text-[var(--accent)]">
        → @claude-eng MENTION DETECTED
        <br />
        → TASK RE-DISPATCHED · session_id reused
        <br />
        → workdir restored from sess_a8f2... · context preserved
      </div>
      <div className="mt-auto pt-[14px] text-[var(--font-size-micro)] tracking-[var(--tr-micro)] text-[var(--dim)]">
        {"// human steered · agent continues"}
      </div>
    </>
  );
}

function FrameAudit() {
  return (
    <>
      <div className="text-[var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--dim)]">
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
        <div className="font-[var(--weight-medium)] text-[var(--accent)]">
          <span>09:16:14</span> claude-eng <i>merged · closed ENG-242</i>
        </div>
      </div>
      <div className="mt-auto border-t border-dashed border-[var(--line)] pt-[14px] text-[var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--accent)]">
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
      <div className="grid grid-cols-1 border border-[var(--line2)] bg-[var(--bg2)] max-[920px]:grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
        <div className="border-b border-[var(--line2)] py-[6px] lg:border-b-0 lg:border-r">
          {workflow.steps.map((step, i) => {
            const isActive = activeStep === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setActiveStep(i)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "relative grid w-full cursor-pointer grid-cols-[64px_1fr] items-start gap-3 border-b border-[var(--line)] px-[18px] py-4 text-left transition-colors duration-[var(--duration-fast)] last:border-b-0 hover:bg-[var(--bg3)]",
                  "sm:grid-cols-[80px_1fr] sm:gap-[18px] sm:px-[26px] sm:py-5",
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
                    "text-[var(--font-size-micro)] tracking-[var(--tr-tag)]",
                    isActive ? "text-[var(--accent)]" : "text-[var(--dim)]",
                  )}
                >
                  {step.stepnum}
                </span>
                <div>
                  <h5 className="m-0 mb-[6px] text-[var(--font-size-h5)] font-[var(--weight-bold)] uppercase leading-[1.25] tracking-[-0.005em] text-[var(--txt)]">
                    {step.h}
                  </h5>
                  <p className="m-0 text-[var(--font-size-dense)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                    {step.p}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="flex min-h-[380px] flex-col gap-[14px] bg-[var(--bg)] p-5 sm:min-h-[480px] sm:p-8">
          <div className="text-[var(--font-size-nano)] tracking-[var(--tr-tag)] text-[var(--dim)]">
            <span className="text-[var(--dim2)]">{"// "}</span>
            {FRAME_LABELS[activeStep]}
          </div>
          <div className="relative flex flex-1 flex-col gap-3 border border-[var(--line2)] bg-[var(--bg2)] p-5">
            {FRAMES[activeStep]}
          </div>
          <pre className="m-0 overflow-x-auto whitespace-pre border border-[var(--line2)] bg-[var(--bg2)] px-[18px] py-[14px] text-[var(--font-size-micro)] leading-[1.4] text-[var(--dim)] max-[640px]:hidden">
            {workflow.asciiDiagram}
          </pre>
        </div>
      </div>
    </OpsSection>
  );
}
