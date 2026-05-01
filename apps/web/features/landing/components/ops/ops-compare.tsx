"use client";

import { cn } from "@multica/ui/lib/utils";
import { useLocale } from "../../i18n";
import type { OpsCompareKind } from "../../i18n/types";
import { OpsSection, OpsSectionHead } from "./ops-primitives";

const GLYPHS: Record<OpsCompareKind, string> = {
  yes: "● ",
  no: "○ ",
  partial: "◐ ",
};

const TONES: Record<OpsCompareKind, string> = {
  yes: "text-[var(--accent)]",
  no: "text-[var(--dim2)]",
  partial: "text-[var(--txt2)]",
};

const GLYPH_TONES: Record<OpsCompareKind, string> = {
  yes: "text-[var(--accent)]",
  no: "text-[var(--dim2)]",
  partial: "text-[var(--warn)]",
};

function Cell({ kind, label }: { kind: OpsCompareKind; label: string }) {
  return (
    <span className={TONES[kind]}>
      <span className={GLYPH_TONES[kind]}>{GLYPHS[kind]}</span>
      {label}
    </span>
  );
}

export function OpsCompare() {
  const { t } = useLocale();
  const { compare } = t.ops;

  return (
    <OpsSection id="compare">
      <OpsSectionHead
        num={compare.num}
        label={compare.label}
        headlineParts={compare.headlineParts}
        sub={compare.sub}
        toneMap={{ 2: "accent" }}
      />
      <div
        className="overflow-hidden border border-[var(--line2)] bg-[var(--bg2)] max-[540px]:overflow-x-auto"
        aria-label="Feature comparison vs issue trackers and agent IDEs"
      >
        <table
          className="w-full border-collapse max-[540px]:min-w-[510px]"
          role="table"
        >
          <thead>
            <tr className="bg-[var(--bg3)]">
              <th className="px-5 py-4 text-left text-[10px] font-[var(--weight-regular)] tracking-[var(--tr-eyebrow)] text-[var(--dim)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]" />
              <th className="border-l border-[var(--line)] px-5 py-4 text-left text-[10px] font-[var(--weight-regular)] tracking-[var(--tr-eyebrow)] text-[var(--dim)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                {compare.head.trackers}
              </th>
              <th className="border-l border-[var(--line)] px-5 py-4 text-left text-[10px] font-[var(--weight-regular)] tracking-[var(--tr-eyebrow)] text-[var(--dim)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                {compare.head.ides}
              </th>
              <th className="border-l border-[var(--line)] px-5 py-4 text-left text-[10px] font-[var(--weight-regular)] tracking-[var(--tr-eyebrow)] text-[var(--accent)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                {compare.head.us}
              </th>
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row, i) => (
              <tr key={i} className="border-t border-[var(--line)]">
                <td
                  className={cn(
                    "px-5 py-4 text-left align-top text-[var(--font-size-detail)] font-[var(--weight-medium)] text-[var(--txt)]",
                    "max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]",
                  )}
                >
                  {row.feature}
                </td>
                <td className="border-l border-[var(--line)] px-5 py-4 text-left align-top text-[var(--font-size-detail)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                  <Cell kind={row.trackers.kind} label={row.trackers.label} />
                </td>
                <td className="border-l border-[var(--line)] px-5 py-4 text-left align-top text-[var(--font-size-detail)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                  <Cell kind={row.ides.kind} label={row.ides.label} />
                </td>
                <td className="border-l border-[var(--line)] px-5 py-4 text-left align-top text-[var(--font-size-detail)] max-sm:px-[10px] max-sm:py-3 max-sm:text-[11.5px]">
                  <Cell kind={row.us.kind} label={row.us.label} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OpsSection>
  );
}
