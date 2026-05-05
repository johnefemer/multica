import Link from "next/link";
import { PlanPageShell } from "@/features/landing/components/plan-page-shell";
import {
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "@/features/landing/components/ops/ops-primitives";

const CONTACT_EMAIL = "agenthost@kensink.com";

export default function PlanNotFound() {
  return (
    <PlanPageShell>
      <OpsSection id="not-found">
        <OpsSectionHead
          num="§00"
          label="// PLAN_NOT_FOUND"
          headlineParts={["NO PLAN ", "AT THIS LINK."]}
          toneMap={{ 1: "accent" }}
          sub="Either the URL was mistyped, the plan was deleted, or the link expired. Plan links are private — they don't appear in search engines and there's no public index to browse."
        />
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/build-your-team"
            className={opsButtonClassName("solid")}
          >
            BUILD_A_NEW_PLAN →
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("My plan link is broken")}`}
            className={opsButtonClassName("ghost")}
          >
            EMAIL_FOR_HELP
          </a>
        </div>
      </OpsSection>
    </PlanPageShell>
  );
}
