import type { ReactNode } from "react";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
// The Ops design tokens (var(--bg), var(--accent), etc.) are normally
// loaded by OpsPageShell. PlanPageShell is the standalone alternative
// for /plan/<hash> hotlinks, so we import the tokens directly here too.
import "./ops/tokens.css";

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains",
  display: "swap",
});

/**
 * Minimal layout for /plan/<hash> hotlink pages.
 *
 * Deliberately NOT OpsPageShell — that one renders OpsHeader/OpsFooter
 * which call useLocale() and require LocaleProvider, which is only
 * mounted under the (landing) route group. /plan/[hash] lives at the
 * top level so it would crash with "useLocale must be used within
 * LocaleProvider" if it tried to use OpsPageShell.
 *
 * The minimal shell also matches the UX intent: a private hotlink is
 * a focused reading experience, not the marketing site. Just a thin
 * brand band on top, content, and a tight footer. No nav, no full
 * marketing chrome.
 */
export function PlanPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${jetbrains.variable} flex min-h-screen flex-col bg-[var(--bg)] text-[var(--txt)]`}
      style={{ fontFamily: "var(--font-jetbrains), ui-monospace, monospace" }}
    >
      {/* Thin brand band */}
      <header className="border-b border-[var(--line2)] bg-[var(--bg)]">
        <div className="mx-auto flex w-full max-w-[var(--container-narrow,1100px)] items-center justify-between px-[var(--container-pad)] py-[14px] max-[1020px]:px-[var(--container-pad-lg)] max-[760px]:px-[var(--container-pad-md)]">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-[10px] text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] tracking-[var(--tr-label)] text-[var(--txt)]"
          >
            <span
              aria-hidden="true"
              className="block h-[10px] w-[10px] flex-none bg-[var(--accent)] [animation:ops-pulse_2.4s_ease-in-out_infinite] [box-shadow:var(--glow-accent)]"
            />
            <span className="truncate">AGENTHOST</span>
            <span className="ml-1 truncate text-[length:var(--font-size-micro)] font-[number:var(--weight-regular)] text-[var(--dim)] max-[480px]:hidden">
              {"// KENSINK_LABS"}
            </span>
          </Link>
          <span className="text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
            {"// PRIVATE_PLAN"}
          </span>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      {/* Tight footer */}
      <footer className="border-t border-[var(--line2)] bg-[var(--bg)] py-5">
        <div className="mx-auto flex w-full max-w-[var(--container-narrow,1100px)] flex-wrap items-center justify-between gap-3 px-[var(--container-pad)] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)] max-[1020px]:px-[var(--container-pad-lg)] max-[760px]:px-[var(--container-pad-md)]">
          <span>{"// AGENTHOST · KENSINK_LABS"}</span>
          <Link
            href="/build-your-team"
            className="text-[var(--accent)] hover:underline"
          >
            BUILD ANOTHER PLAN →
          </Link>
        </div>
      </footer>
    </div>
  );
}
