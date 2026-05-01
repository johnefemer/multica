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
      <div className="grid grid-cols-1 border border-[var(--line2)] bg-[var(--bg2)] sm:grid-cols-2 lg:grid-cols-4">
        {stats.cells.map((cell, i) => (
          <div
            key={i}
            className="relative border-b border-r border-[var(--line2)] px-7 py-8 last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 lg:!border-r lg:last:!border-r-0 lg:!border-b-0 lg:[&:nth-child(2n)]:!border-r"
          >
            <div className="mb-[14px] text-[var(--font-size-nano)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              <span className="text-[var(--dim2)]">{"// "}</span>
              {cell.k}
            </div>
            <div className="text-[var(--font-size-stat)] font-[var(--weight-bold)] leading-none tracking-[-0.03em] text-[var(--txt)]">
              {cell.v}
              {cell.vSuffix ? (
                <small className="ml-1 text-[14px] font-[var(--weight-medium)] text-[var(--accent)]">
                  {cell.vSuffix}
                </small>
              ) : null}
            </div>
            <div className="mt-2 text-[var(--font-size-micro)] tracking-[0.06em] text-[var(--dim)]">
              {cell.n}
            </div>
          </div>
        ))}
      </div>
    </OpsSection>
  );
}
