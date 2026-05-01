"use client";

import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";
import { OpsSection, OpsSectionHead } from "./ops-primitives";

export function OpsProposition() {
  const { t } = useLocale();
  const { proposition: p } = t.ops;

  return (
    <OpsSection id="product">
      <OpsSectionHead
        num={p.num}
        label={p.label}
        headlineParts={p.headlineParts}
        sub={p.sub}
        toneMap={{ 2: "accent", 4: "dim2" }}
      />
      <div className="grid grid-cols-1 gap-6 max-[880px]:grid-cols-1 md:grid-cols-2">
        <PropositionCard
          ptitle={p.without.ptitle}
          h={p.without.h}
          items={p.without.items}
        />
        <PropositionCard
          ptitle={p.with.ptitle}
          h={p.with.h}
          items={p.with.items}
          highlighted
        />
      </div>
    </OpsSection>
  );
}

function PropositionCard({
  ptitle,
  h,
  items,
  highlighted = false,
}: {
  ptitle: string;
  h: string;
  items: { b: string; s: string }[];
  highlighted?: boolean;
}) {
  return (
    <div
      className={cn(
        "border bg-[var(--bg2)] px-7 pb-3 pt-7 sm:px-7 sm:pb-3 sm:pt-7",
        "max-sm:px-5 max-sm:pb-2 max-sm:pt-[22px]",
        highlighted
          ? "border-[var(--accent)] [background:var(--card-after-bg)]"
          : "border-[var(--line2)]",
      )}
    >
      <div
        className={cn(
          "mb-3 flex items-center gap-[10px] text-[10px] tracking-[var(--tr-label)]",
          highlighted ? "text-[var(--accent)]" : "text-[var(--dim)]",
        )}
      >
        <span className={highlighted ? "text-[var(--accent)] opacity-50" : "text-[var(--dim2)]"}>
          {"//"}
        </span>
        {ptitle}
      </div>
      <h3 className="mb-[22px] text-[var(--font-size-h3)] font-[var(--weight-bold)] uppercase leading-[1.15] tracking-[-0.012em] text-[var(--txt)]">
        {h}
      </h3>
      <div>
        {items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[32px_1fr] items-start gap-[14px] border-t border-[var(--line)] py-[14px]"
          >
            <span
              className={cn(
                "pt-px text-[11px] tracking-[0.08em]",
                highlighted ? "text-[var(--accent)]" : "text-[var(--dim)]",
              )}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <b className="mb-[3px] block text-[13.5px] font-[var(--weight-medium)] text-[var(--txt)]">
                {item.b}
              </b>
              <span className="text-[var(--font-size-dense)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                {item.s}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
