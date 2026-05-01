"use client";

import Link from "next/link";
import { OpsPageShell } from "./ops/ops-page-shell";
import { OpsContainer, opsButtonClassName } from "./ops/ops-primitives";
import { useLocale } from "../i18n";
import type { LegalDoc } from "../i18n/types";

type LegalDocKey = "terms" | "privacy" | "security" | "dpa" | "subProcessors";

const EYEBROW: Record<LegalDocKey, string> = {
  terms: "// LEGAL · TERMS",
  privacy: "// LEGAL · PRIVACY",
  security: "// LEGAL · SECURITY",
  dpa: "// LEGAL · DPA",
  subProcessors: "// LEGAL · SUB-PROCESSORS",
};

export function LegalPageClient({ docKey }: { docKey: LegalDocKey }) {
  const { t } = useLocale();
  const doc: LegalDoc = t.legal[docKey];

  return (
    <OpsPageShell>
      <article className="border-b border-[var(--line2)] py-[var(--section-pad)] max-[1020px]:py-[var(--section-pad-lg)] max-[760px]:py-[var(--section-pad-md)]">
        <OpsContainer>
          <div className="mx-auto max-w-[760px]">
            <div className="mb-8 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {EYEBROW[docKey]}
            </div>
            <h1 className="m-0 mb-3 text-[length:var(--font-size-h2)] font-[number:var(--weight-bold)] uppercase leading-[1.05] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-h2-lg)] max-[760px]:text-[length:var(--font-size-h2-md)] [overflow-wrap:anywhere]">
              {doc.title}
            </h1>
            <p className="m-0 mb-10 text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
              {t.legal.lastUpdatedLabel}: {doc.lastUpdated}
            </p>
            <p className="m-0 mb-12 text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {doc.intro}
            </p>

            <div className="space-y-12">
              {doc.sections.map((section, i) => (
                <section
                  key={i}
                  className="border-t border-[var(--line)] pt-10"
                >
                  <h2 className="m-0 mb-4 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] uppercase leading-[1.2] tracking-[-0.005em] text-[var(--txt)]">
                    {section.heading}
                  </h2>
                  <div className="space-y-4">
                    {section.paragraphs.map((p, j) => (
                      <p
                        key={j}
                        className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]"
                      >
                        {p}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 border-t border-[var(--line)] pt-10 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--dim)]">
              {t.legal.contactLine}
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="/" className={opsButtonClassName("ghost")}>
                {"← BACK_HOME"}
              </Link>
            </div>
          </div>
        </OpsContainer>
      </article>
    </OpsPageShell>
  );
}
