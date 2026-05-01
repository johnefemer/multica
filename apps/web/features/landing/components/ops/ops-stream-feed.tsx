"use client";

import { useEffect, useState } from "react";
import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";

type StreamWho = { kind: "agent" | "human"; name: string };

type StreamSegment =
  | { kind: "text"; value: string }
  | { kind: "who"; who: StreamWho }
  | { kind: "num"; value: string };

type StreamLine = {
  ts: string;
  tag: string;
  tagTone: "neutral" | "dispatch" | "complete" | "fail";
  segments: StreamSegment[];
};

const FEED: StreamLine[] = [
  {
    ts: "09:14:02",
    tag: "DISPATCH",
    tagTone: "dispatch",
    segments: [
      { kind: "who", who: { kind: "agent", name: "claude-eng" } },
      { kind: "text", value: " claimed " },
      { kind: "num", value: "ENG-241" },
    ],
  },
  {
    ts: "09:14:03",
    tag: "WORKDIR",
    tagTone: "neutral",
    segments: [{ kind: "text", value: "prepared ~/agenthost/eng-241/workdir" }],
  },
  {
    ts: "09:14:09",
    tag: "TOOL",
    tagTone: "neutral",
    segments: [{ kind: "text", value: "read_file: server/internal/service/task.go" }],
  },
  {
    ts: "09:14:18",
    tag: "EDIT",
    tagTone: "dispatch",
    segments: [
      { kind: "text", value: "patched 3 files · " },
      { kind: "num", value: "+84/-12" },
    ],
  },
  {
    ts: "09:14:31",
    tag: "TEST",
    tagTone: "neutral",
    segments: [
      { kind: "text", value: "go test ./internal/service/... → " },
      { kind: "num", value: "27 passed" },
    ],
  },
  {
    ts: "09:14:42",
    tag: "COMMENT",
    tagTone: "neutral",
    segments: [
      { kind: "who", who: { kind: "agent", name: "claude-eng" } },
      { kind: "text", value: ": queue is durable now, draft PR up" },
    ],
  },
  {
    ts: "09:14:47",
    tag: "COMPLETE",
    tagTone: "complete",
    segments: [
      { kind: "num", value: "ENG-241" },
      { kind: "text", value: " → in_review · " },
      { kind: "num", value: "49.2k tok" },
    ],
  },
  {
    ts: "09:15:01",
    tag: "DISPATCH",
    tagTone: "dispatch",
    segments: [
      { kind: "who", who: { kind: "agent", name: "codex-eng" } },
      { kind: "text", value: " claimed " },
      { kind: "num", value: "ENG-238" },
    ],
  },
  {
    ts: "09:15:08",
    tag: "TOOL",
    tagTone: "neutral",
    segments: [{ kind: "text", value: "grep_files: cron pattern in scheduler" }],
  },
  {
    ts: "09:15:14",
    tag: "EDIT",
    tagTone: "dispatch",
    segments: [
      { kind: "text", value: "patched 1 file · " },
      { kind: "num", value: "+6/-3" },
    ],
  },
  {
    ts: "09:15:22",
    tag: "COMMENT",
    tagTone: "neutral",
    segments: [
      { kind: "who", who: { kind: "human", name: "@mei" } },
      { kind: "text", value: " mentioned " },
      { kind: "who", who: { kind: "agent", name: "claude-eng" } },
      { kind: "text", value: ": cap @ 30s" },
    ],
  },
  {
    ts: "09:15:24",
    tag: "DISPATCH",
    tagTone: "dispatch",
    segments: [
      { kind: "who", who: { kind: "agent", name: "claude-eng" } },
      { kind: "text", value: " re-claimed " },
      { kind: "num", value: "ENG-242" },
    ],
  },
];

const TAG_TONE: Record<StreamLine["tagTone"], string> = {
  neutral: "text-[var(--dim)]",
  dispatch: "text-[var(--accent)]",
  complete: "text-[var(--accent2)]",
  fail: "text-[var(--pop)]",
};

const VISIBLE = 7;
const SEED = 5;
const TICK_MS = 1700;

function StreamMessage({ segments }: { segments: StreamSegment[] }) {
  return (
    <span className="overflow-hidden truncate whitespace-nowrap text-[var(--txt2)] max-[480px]:whitespace-normal max-[480px]:leading-[1.4]">
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <span key={i}>{seg.value}</span>;
        if (seg.kind === "num")
          return (
            <span key={i} className="text-[var(--accent2)]">
              {seg.value}
            </span>
          );
        return (
          <span
            key={i}
            className={
              seg.who.kind === "human" ? "text-[var(--warn)]" : "text-[var(--accent)]"
            }
          >
            {seg.who.name}
          </span>
        );
      })}
    </span>
  );
}

export function OpsStreamFeed() {
  const { t } = useLocale();
  const { streamHeader } = t.ops.hero;

  // Initial deterministic snapshot — must match server render to avoid
  // hydration mismatches. Keep the first 5 lines visible as the source does.
  const [lines, setLines] = useState<StreamLine[]>(() => FEED.slice(0, SEED));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mql.matches);
    const update = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setLines(FEED.slice(0, VISIBLE));
      return;
    }
    let idx = SEED;
    const id = window.setInterval(() => {
      setLines((prev) => {
        const item = FEED[idx % FEED.length];
        idx += 1;
        if (!item) return prev;
        const next = [...prev, item];
        return next.slice(-VISIBLE);
      });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  return (
    <div className="flex flex-col border border-[var(--line2)] bg-[rgba(15,19,24,0.85)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-[14px] py-[10px] text-[var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        <span>{streamHeader}</span>
        <span aria-hidden="true" className="flex gap-[5px]">
          <span className="block h-2 w-2 rounded-full border border-[var(--line2)]" />
          <span className="block h-2 w-2 rounded-full border border-[var(--line2)]" />
          <span className="block h-2 w-2 rounded-full border border-[var(--line2)]" />
        </span>
      </div>
      <div
        className="min-h-[160px] px-[14px] py-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {lines.map((line, i) => (
          <div
            key={`${line.ts}-${line.tag}-${i}`}
            className="grid grid-cols-[54px_70px_1fr] gap-[10px] py-1 text-[var(--font-size-tag)] max-[480px]:grid-cols-[62px_1fr] max-[480px]:gap-2"
          >
            <span className="text-[var(--dim2)] max-[480px]:hidden">{line.ts}</span>
            <span
              className={cn(
                "text-[var(--font-size-nano)] tracking-[var(--tr-caps)]",
                TAG_TONE[line.tagTone],
              )}
            >
              {line.tag}
            </span>
            <StreamMessage segments={line.segments} />
          </div>
        ))}
      </div>
    </div>
  );
}
