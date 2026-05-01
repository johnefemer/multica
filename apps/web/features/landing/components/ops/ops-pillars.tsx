"use client";

import { useLocale } from "../../i18n";
import { OpsSection, OpsSectionHead } from "./ops-primitives";

const GLYPHS = [
  // 01 / IDENTITY
  <svg key="0" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="6" r="2.6" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 14c.7-2.5 2.7-3.8 5-3.8s4.3 1.3 5 3.8" stroke="currentColor" strokeWidth="1.3" />
  </svg>,
  // 02 / RUNTIME
  <svg key="1" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <rect x="2" y="3" width="12" height="10" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 7h6M5 10h4" stroke="currentColor" strokeWidth="1.3" />
  </svg>,
  // 03 / SKILLS
  <svg key="2" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5.5 6.5h5M5.5 9.5h3.5" stroke="currentColor" strokeWidth="1.3" />
  </svg>,
  // 04 / AUTOPILOT
  <svg key="3" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M8 5v3l2 1.6" stroke="currentColor" strokeWidth="1.3" />
  </svg>,
  // 05 / MEMORY
  <svg key="4" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M3 8c0-2.5 2.2-4.6 5-4.6S13 5.5 13 8s-2.2 4.6-5 4.6H3l1.6-2"
      stroke="currentColor"
      strokeWidth="1.3"
    />
  </svg>,
  // 06 / INBOX
  <svg key="5" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M2 4h12v8H2z" stroke="currentColor" strokeWidth="1.3" />
    <path d="M2 8h3.5l1 1.4h3L10.5 8H14" stroke="currentColor" strokeWidth="1.3" />
  </svg>,
];

const PILLAR_KEYS = ["IDENTITY", "RUNTIME", "SKILLS", "AUTOPILOT", "MEMORY", "INBOX"];

export function OpsPillars() {
  const { t } = useLocale();
  const { pillars } = t.ops;

  return (
    <OpsSection>
      <OpsSectionHead
        num={pillars.num}
        label={pillars.label}
        headlineParts={pillars.headlineParts}
        sub={pillars.sub}
        toneMap={{ 1: "accent" }}
      />
      <div
        className="grid grid-cols-1 border border-[var(--line2)] max-[640px]:grid-cols-1 max-[980px]:grid-cols-2 md:grid-cols-3"
      >
        {pillars.cards.map((card, i) => (
          <article
            key={i}
            className="group relative flex min-h-[280px] flex-col justify-between border-b border-r border-[var(--line2)] bg-[var(--bg2)] px-[26px] py-7 transition-colors duration-[var(--duration-base)] hover:bg-[var(--bg3)] [&:nth-child(2n)]:border-r-[var(--line2)] [&:nth-last-child(-n+2)]:border-b-0 max-[980px]:[&:nth-child(2n)]:border-r-0 max-[980px]:[&:nth-last-child(-n+2)]:border-b-0 max-[640px]:!border-r-0 max-[640px]:[&:not(:last-child)]:border-b max-[640px]:last:border-b-0 md:[&:nth-child(2n)]:border-r md:[&:nth-child(3n)]:border-r-0 md:[&:nth-last-child(-n+3)]:border-b-0"
          >
            <div>
              <div className="mb-8 flex items-start justify-between">
                <span className="text-[length:var(--font-size-micro)] tracking-[var(--tr-label)] text-[var(--dim)]">
                  <b className="font-[number:var(--weight-medium)] text-[var(--accent)]">{card.num}</b>{" "}
                  / {PILLAR_KEYS[i]}
                </span>
                <span className="flex h-8 w-8 items-center justify-center border border-[var(--line3)] text-[var(--txt2)] transition-[color,border-color] duration-[var(--duration-base)] group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]">
                  {GLYPHS[i]}
                </span>
              </div>
              <h4 className="mb-3 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] uppercase leading-[1.2] tracking-[-0.005em] text-[var(--txt)]">
                {card.title}
              </h4>
              <p className="m-0 text-[length:var(--font-size-dense)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {card.body}
              </p>
            </div>
            <div className="mt-[18px] text-[9.5px] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              <span className="text-[var(--accent)]">→ </span>
              {card.tag}
            </div>
          </article>
        ))}
      </div>
    </OpsSection>
  );
}
