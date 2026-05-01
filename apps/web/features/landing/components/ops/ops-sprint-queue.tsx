"use client";

import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";
import type { OpsAvatarTone, OpsBoardStatus } from "../../i18n/types";

const AVATAR_TONE: Record<OpsAvatarTone, string> = {
  bot1: "bg-[var(--avatar-bot1-bg)] text-[var(--bg)]",
  bot2: "bg-[var(--avatar-bot2-bg)] text-[var(--bg)]",
  bot3: "bg-[var(--avatar-bot3-bg)] text-[var(--bg)]",
  human: "bg-transparent text-[var(--txt2)] border border-[var(--line3)]",
};

const STATUS_TONE: Record<OpsBoardStatus, string> = {
  RUN: "text-[var(--accent)]",
  REV: "text-[var(--dim)]",
  DONE: "text-[var(--accent2)]",
  OPEN: "text-[var(--dim)]",
};

function StatusGlyph({ status }: { status: OpsBoardStatus }) {
  if (status === "RUN") {
    return (
      <span
        aria-hidden="true"
        className="mr-1 inline-block [animation:ops-pulse_1.4s_ease-in-out_infinite]"
      >
        ●
      </span>
    );
  }
  if (status === "DONE") {
    return (
      <span aria-hidden="true" className="mr-1 inline-block">
        ✓
      </span>
    );
  }
  return null;
}

export function OpsSprintQueue() {
  const { t } = useLocale();
  const { hero } = t.ops;

  return (
    <div className="flex flex-col bg-[rgba(15,19,24,0.85)] border border-[var(--line2)]">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-[14px] py-[10px] text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        <span>{hero.sprintHeader}</span>
        <span>{hero.sprintCount}</span>
      </div>
      <div className="px-[14px] py-3">
        {hero.sprintRows.map((row, i) => (
          <div
            key={row.id}
            className={cn(
              "grid grid-cols-[64px_1fr_26px_60px] items-center gap-[10px] border-b border-dashed border-[var(--line)] py-2 text-[12.5px] last:border-b-0",
              "max-[480px]:grid-cols-[60px_1fr_50px] max-[480px]:gap-2",
            )}
          >
            <span className="text-[11px] tracking-[0.04em] text-[var(--dim)]">
              {row.id}
            </span>
            <span className="overflow-hidden truncate whitespace-nowrap text-[var(--txt)] max-[480px]:whitespace-normal max-[480px]:leading-[1.35]">
              {row.title}
            </span>
            <span
              className={cn(
                "flex h-[22px] w-[22px] flex-none items-center justify-center text-[9px] font-[number:var(--weight-bold)] tracking-[0.04em] max-[480px]:hidden",
                AVATAR_TONE[row.avatarTone],
              )}
              aria-hidden={i === 4}
            >
              {row.avatar}
            </span>
            <span
              className={cn(
                "text-right text-[length:var(--font-size-nano)] tracking-[var(--tr-caps)]",
                STATUS_TONE[row.status],
              )}
            >
              <StatusGlyph status={row.status} />
              {row.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
