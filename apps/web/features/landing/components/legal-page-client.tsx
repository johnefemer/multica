"use client";

import { LandingHeader } from "./landing-header";
import { LandingFooter } from "./landing-footer";
import { useLocale } from "../i18n";
import type { LegalDoc } from "../i18n/types";

type LegalDocKey = "terms" | "privacy" | "security" | "dpa" | "subProcessors";

export function LegalPageClient({ docKey }: { docKey: LegalDocKey }) {
  const { t } = useLocale();
  const doc: LegalDoc = t.legal[docKey];

  return (
    <>
      <LandingHeader variant="light" />
      <main className="bg-white text-[#0a0d12]">
        <div className="mx-auto max-w-[720px] px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <h1 className="font-[family-name:var(--font-serif)] text-[2.6rem] leading-[1.05] tracking-[-0.03em] sm:text-[3.4rem]">
            {doc.title}
          </h1>
          <p className="mt-3 text-[12px] uppercase tracking-[0.14em] text-[#0a0d12]/55">
            {t.legal.lastUpdatedLabel}: {doc.lastUpdated}
          </p>
          <p className="mt-6 text-[17px] leading-[1.6] text-[#0a0d12]/85 sm:text-[19px]">
            {doc.intro}
          </p>

          <div className="mt-12 space-y-10">
            {doc.sections.map((section, i) => (
              <section key={i}>
                <h2 className="font-[family-name:var(--font-serif)] text-[1.6rem] leading-[1.2] tracking-[-0.015em] text-[#0a0d12] sm:text-[1.85rem]">
                  {section.heading}
                </h2>
                <div className="mt-4 space-y-4 text-[15px] leading-[1.8] text-[#0a0d12]/75 sm:text-[16px]">
                  {section.paragraphs.map((p, j) => (
                    <p key={j}>{p}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p className="mt-16 border-t border-[#0a0d12]/10 pt-8 text-[14px] leading-[1.7] text-[#0a0d12]/55">
            {t.legal.contactLine}
          </p>
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
