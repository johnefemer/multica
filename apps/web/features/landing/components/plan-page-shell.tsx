import type { ReactNode } from "react";
import Link from "next/link";

// =============================================================================
// PlanPageShell — clean, self-contained layout for /plan/<hash> hotlinks.
//
// Deliberately has NO external CSS bindings: no tokens.css, no Google
// font import, no OpsPageShell wrapping. Just standard Tailwind classes
// with explicit colour values so a glance at this file tells you exactly
// what the page looks like.
//
// Palette: black + zinc grays + ONE neon mint accent (#39ff88) used
// sparingly for headlines, bullets, and key affordances.
//
// Scroll behaviour: standard block layout — `<body>` scrolls naturally.
// No `position: fixed`, no `overflow: hidden`, no body-scroll-lock side
// effects bleeding in from other components.
// =============================================================================

export const PLAN_ACCENT = "#39ff88";

export function PlanPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-mono antialiased">
      {/* Thin brand band */}
      <header className="border-b border-zinc-800 bg-zinc-950">
        <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-2 text-xs font-medium tracking-wider uppercase text-zinc-100"
          >
            <span
              aria-hidden="true"
              className="block h-[10px] w-[10px] flex-none"
              style={{ backgroundColor: PLAN_ACCENT, boxShadow: `0 0 12px ${PLAN_ACCENT}` }}
            />
            <span className="truncate">AGENTHOST</span>
            <span className="ml-1 truncate text-[10px] font-normal text-zinc-500 hidden sm:inline">
              {"// KENSINK_LABS"}
            </span>
          </Link>
          <span
            className="text-[10px] font-medium uppercase tracking-widest"
            style={{ color: PLAN_ACCENT }}
          >
            {"// PRIVATE_PLAN"}
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-[1100px] px-6 py-12 sm:px-8 sm:py-16">
        {children}
      </main>

      {/* Tight footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-6">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 text-[10px] uppercase tracking-widest text-zinc-500 sm:px-8">
          <span>{"// AGENTHOST · KENSINK_LABS"}</span>
          <Link
            href="/build-your-team"
            className="hover:underline"
            style={{ color: PLAN_ACCENT }}
          >
            BUILD ANOTHER PLAN →
          </Link>
        </div>
      </footer>
    </div>
  );
}
