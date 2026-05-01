"use client";

import { JetBrains_Mono } from "next/font/google";
import "./tokens.css";

import { OpsHeader } from "./ops-header";
import { OpsHero } from "./ops-hero";
import { OpsProposition } from "./ops-proposition";
import { OpsPillars } from "./ops-pillars";
import { OpsWorkflow } from "./ops-workflow";
import { OpsStats } from "./ops-stats";
import { OpsCompare } from "./ops-compare";
import { OpsQuote } from "./ops-quote";
import { OpsPricing } from "./ops-pricing";
import { OpsCallToAction } from "./ops-cta";
import { OpsFooter } from "./ops-footer";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono-display",
  display: "swap",
});

export function OpsLanding() {
  return (
    <div
      className={`${jetbrainsMono.variable} ops-landing relative min-h-screen bg-[var(--bg)] text-[var(--txt)] [font-family:var(--font-mono)] text-[var(--font-size-base-mobile)] sm:text-[var(--font-size-base)] leading-[var(--lh-normal)] [-webkit-font-smoothing:antialiased] overflow-x-hidden`}
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
      <OpsHero />
      <OpsProposition />
      <OpsPillars />
      <OpsWorkflow />
      <OpsStats />
      <OpsCompare />
      <OpsQuote />
      <OpsPricing />
      <OpsCallToAction />
      <OpsFooter />
    </div>
  );
}
