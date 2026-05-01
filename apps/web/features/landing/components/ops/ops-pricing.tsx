"use client";

import Link from "next/link";
import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";
import { OpsSection, OpsSectionHead, opsButtonClassName } from "./ops-primitives";

export function OpsPricing() {
  const { t } = useLocale();
  const { pricing } = t.ops;

  return (
    <OpsSection id="pricing">
      <OpsSectionHead
        num={pricing.num}
        label={pricing.label}
        headlineParts={pricing.headlineParts}
        sub={pricing.sub}
        toneMap={{ 1: "accent" }}
      />
      <div className="grid grid-cols-3 border border-[var(--line2)] max-[880px]:grid-cols-1">
        {pricing.tiers.map((tier, i) => {
          const isFree = tier.amount === "FREE";
          return (
            <div
              key={i}
              className={cn(
                "relative flex flex-col gap-[18px] border-r border-[var(--line2)] p-7 last:border-r-0",
                tier.isFeatured ? "bg-[var(--bg3)]" : "bg-[var(--bg2)]",
                "max-[880px]:!border-r-0 max-[880px]:border-b max-[880px]:last:!border-b-0",
              )}
            >
              {tier.featuredBadge ? (
                <div className="absolute right-6 top-[18px] text-[9.5px] tracking-[var(--tr-label)] text-[var(--accent)] max-[880px]:static max-[880px]:right-auto max-[880px]:top-auto max-[880px]:-mb-[10px] max-[880px]:text-[10px]">
                  {tier.featuredBadge}
                </div>
              ) : null}
              <div
                className={cn(
                  "text-[length:var(--font-size-label)] tracking-[var(--tr-label)]",
                  tier.isFeatured ? "text-[var(--accent)]" : "text-[var(--dim)]",
                )}
              >
                {tier.name}
              </div>
              <div className="text-[length:var(--font-size-price)] font-[number:var(--weight-bold)] leading-none tracking-[-0.025em] text-[var(--txt)]">
                <span className={isFree ? "text-[var(--accent)]" : undefined}>
                  {tier.amount}
                </span>
                <small className="ml-[6px] text-[13px] font-[number:var(--weight-regular)] tracking-normal text-[var(--dim)]">
                  {tier.amountSuffix}
                </small>
              </div>
              <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                {tier.desc}
              </div>
              <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-0 text-[length:var(--font-size-tag)] text-[var(--txt2)]">
                {tier.features.map((feat, j) => (
                  <li key={j} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-px flex-none text-[11px] text-[var(--accent)]"
                    >
                      ▸
                    </span>
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto">
                <Link
                  href={tier.href}
                  className={opsButtonClassName(
                    tier.isFeatured ? "solid" : "ghost",
                  )}
                >
                  {tier.cta}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </OpsSection>
  );
}
