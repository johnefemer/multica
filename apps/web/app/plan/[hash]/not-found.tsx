import Link from "next/link";
import {
  PlanPageShell,
  PLAN_ACCENT,
} from "@/features/landing/components/plan-page-shell";

const CONTACT_EMAIL = "agenthost@kensink.com";

export default function PlanNotFound() {
  return (
    <PlanPageShell>
      <section>
        <div
          className="mb-3 text-[11px] font-medium uppercase tracking-widest"
          style={{ color: PLAN_ACCENT }}
        >
          {"// PLAN_NOT_FOUND"}
        </div>
        <h1 className="mb-6 text-4xl font-bold uppercase leading-tight tracking-tight text-zinc-100 sm:text-5xl">
          NO PLAN <span style={{ color: PLAN_ACCENT }}>AT THIS LINK.</span>
        </h1>
        <p className="mb-8 max-w-[58ch] text-base leading-relaxed text-zinc-400 sm:text-lg">
          Either the URL was mistyped, the plan was deleted, or the link
          expired. Plan links are private — they don&apos;t appear in search
          engines and there&apos;s no public index to browse.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/build-your-team"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-950 transition-opacity hover:opacity-90"
            style={{ backgroundColor: PLAN_ACCENT }}
          >
            BUILD_A_NEW_PLAN →
          </Link>
          <a
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("My plan link is broken")}`}
            className="inline-flex items-center gap-2 border border-zinc-700 px-4 py-2 text-xs font-medium uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100"
          >
            EMAIL_FOR_HELP
          </a>
        </div>
      </section>
    </PlanPageShell>
  );
}
