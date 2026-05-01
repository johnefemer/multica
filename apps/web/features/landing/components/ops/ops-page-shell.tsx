"use client";

import type { ReactNode } from "react";
import { JetBrains_Mono } from "next/font/google";
import "./tokens.css";

import { OpsHeader } from "./ops-header";
import { OpsFooter } from "./ops-footer";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-display",
  display: "swap",
});

/**
 * Shared dark/mono chrome for every public landing-tree page.
 * Loads JetBrains Mono once, scopes the Ops design tokens via the
 * `.ops-landing` wrapper, paints the fixed grid backdrop, and renders
 * the shared header + footer around `children`.
 *
 * `overflow-x-clip` is intentionally placed on the inner content
 * wrapper (not on `.ops-landing` itself) so the sticky `<nav>` inside
 * `OpsHeader` is not trapped in a non-scrolling ancestor box.
 */
export function OpsPageShell({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${jetbrainsMono.variable} ops-landing relative min-h-screen bg-[var(--bg)] text-[var(--txt)] [font-family:var(--font-mono)] text-[length:var(--font-size-base)] max-[760px]:text-[length:var(--font-size-base-mobile)] leading-[var(--lh-normal)] [-webkit-font-smoothing:antialiased]`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage: "var(--bg-grid)",
          backgroundSize: "var(--grid-cell) var(--grid-cell)",
          backgroundPosition: "-1px -1px",
        }}
      />
      <OpsHeader />
      <div className="overflow-x-clip">
        {children}
        <OpsFooter />
      </div>
    </div>
  );
}
