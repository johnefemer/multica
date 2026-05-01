"use client";

import { useLocale } from "../../i18n";
import { OpsSection, OpsSectionHead } from "./ops-primitives";

export function OpsStats() {
  const { t } = useLocale();
  const { stats } = t.ops;

  return (
    <OpsSection>
      <OpsSectionHead
        num={stats.num}
        label={stats.label}
        headlineParts={stats.headlineParts}
        sub={stats.sub}
        toneMap={{ 1: "accent" }}
      />
      <div className="grid grid-cols-4 border border-[var(--line2)] bg-[var(--bg2)] max-[760px]:grid-cols-2">
        {stats.cells.map((cell, i) => (
          <div
            key={i}
            className="relative border-r border-[var(--line2)] px-7 py-8 last:border-r-0 max-[760px]:border-b max-[760px]:[&:nth-child(2n)]:border-r-0 max-[760px]:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <div className="mb-[14px] text-[length:var(--font-size-nano)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              <span className="text-[var(--dim2)]">{"// "}</span>
              {cell.k}
            </div>
            <div className="text-[length:var(--font-size-stat)] font-[number:var(--weight-bold)] leading-none tracking-[-0.03em] text-[var(--txt)]">
              {cell.v}
              {cell.vSuffix ? (
                <small className="ml-1 text-[14px] font-[number:var(--weight-medium)] text-[var(--accent)]">
                  {cell.vSuffix}
                </small>
              ) : null}
            </div>
            <div className="mt-2 text-[length:var(--font-size-micro)] tracking-[0.06em] text-[var(--dim)]">
              {cell.n}
            </div>
          </div>
        ))}
      </div>
    </OpsSection>
  );
}
