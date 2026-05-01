"use client";

import { useLocale } from "../../i18n";

const GLYPHS = [
  // Claude Code
  <svg key="claude" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M7 0v14M0 7h14M2 2l10 10M12 2 2 12"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>,
  // Codex
  <svg key="codex" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.2" />
    <path
      d="M2 7c2-2 8-2 10 0M2 7c2 2 8 2 10 0M7 1.4c-2 2-2 9.2 0 11.2M7 1.4c2 2 2 9.2 0 11.2"
      stroke="currentColor"
      strokeWidth="1"
    />
  </svg>,
  // Gemini CLI
  <svg key="gemini" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M7 .5 8.4 5.6 13.5 7l-5.1 1.4L7 13.5l-1.4-5.1L.5 7l5.1-1.4L7 .5z"
      stroke="currentColor"
      strokeWidth="1.1"
      strokeLinejoin="round"
    />
  </svg>,
  // Cursor
  <svg key="cursor" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M2 1.5 12 7 2 12.5V1.5z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>,
  // Aider
  <svg key="aider" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <rect x="1.5" y="3" width="11" height="8" stroke="currentColor" strokeWidth="1.2" />
    <path d="M4 6h6M4 8h4" stroke="currentColor" strokeWidth="1.1" />
  </svg>,
  // OpenCode
  <svg key="opencode" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path
      d="M5 4 1.5 7 5 10M9 4l3.5 3L9 10"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinejoin="round"
    />
  </svg>,
];

export function OpsWorksWith() {
  const { t } = useLocale();
  const { worksWith } = t.ops.hero;

  return (
    <div
      aria-label="Supported coding agents"
      className="mb-9 flex flex-wrap items-center gap-0 border-b border-t border-dashed border-[var(--line2)] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)] max-sm:flex-col max-sm:items-start max-sm:gap-[10px]"
    >
      <span className="mr-[18px] whitespace-nowrap border-r border-[var(--line)] pr-[18px] text-[var(--dim)] max-sm:mr-0 max-sm:border-r-0 max-sm:pr-0">
        <span className="text-[var(--dim2)]">{"// "}</span>
        {worksWith.label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[22px] gap-y-[18px] max-sm:gap-x-[18px] max-sm:gap-y-[14px]">
        {worksWith.members.map((m, i) => (
          <span
            key={m.name}
            title={m.title}
            className="inline-flex items-center gap-[7px] font-[number:var(--weight-medium)] tracking-[0.08em] text-[var(--txt2)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--txt)]"
          >
            {GLYPHS[i]}
            {m.name}
          </span>
        ))}
        <span
          title={worksWith.more}
          className="inline-flex items-center gap-[7px] tracking-[var(--tr-tag)] text-[var(--accent)]"
        >
          <span className="text-[var(--accent)]">+</span>
          {worksWith.more}
        </span>
      </div>
      <span className="ml-auto whitespace-nowrap border-l border-[var(--line)] pl-[18px] text-[length:var(--font-size-micro)] tracking-[var(--tr-tag)] text-[var(--accent2)] max-sm:ml-0 max-sm:border-l-0 max-sm:pl-0">
        <span className="text-[var(--accent2)] opacity-60">→ </span>
        {worksWith.enterprise}
      </span>
    </div>
  );
}
