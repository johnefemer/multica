"use client";

import { OpsPageShell } from "./ops-page-shell";
import { OpsHero } from "./ops-hero";
import { OpsProposition } from "./ops-proposition";
import { OpsPillars } from "./ops-pillars";
import { OpsWorkflow } from "./ops-workflow";
import { OpsStats } from "./ops-stats";
import { OpsCompare } from "./ops-compare";
import { OpsQuote } from "./ops-quote";
import { OpsCallToAction } from "./ops-cta";

export function OpsLanding() {
  return (
    <OpsPageShell>
      <OpsHero />
      <OpsProposition />
      <OpsPillars />
      <OpsWorkflow />
      <OpsStats />
      <OpsCompare />
      <OpsQuote />
      <OpsCallToAction />
    </OpsPageShell>
  );
}
