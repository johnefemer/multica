"use client";

import Link from "next/link";
import { OpsPageShell } from "./ops/ops-page-shell";
import { OpsContainer, opsButtonClassName } from "./ops/ops-primitives";
import { GitHubMark, githubUrl } from "./shared";
import { useLocale } from "../i18n";

export function AboutPageClient() {
  const { t } = useLocale();

  return (
    <OpsPageShell>
      <article className="border-b border-[var(--line2)] py-[var(--section-pad)] max-[1020px]:py-[var(--section-pad-lg)] max-[760px]:py-[var(--section-pad-md)]">
        <OpsContainer>
          <div className="mx-auto max-w-[760px]">
            <div className="mb-8 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              {"// ABOUT"}
            </div>
            <h1 className="m-0 mb-8 text-[length:var(--font-size-h2)] font-[number:var(--weight-bold)] uppercase leading-[1.05] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-h2-lg)] max-[760px]:text-[length:var(--font-size-h2-md)] [overflow-wrap:anywhere]">
              {t.about.title}
            </h1>
            <p className="m-0 mb-10 text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {t.about.intro}
            </p>

            <div className="space-y-6">
              {t.about.paragraphs.map((p, i) => (
                <p
                  key={i}
                  className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]"
                >
                  {p}
                </p>
              ))}
            </div>

            <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-10">
              <Link
                href={githubUrl}
                target="_blank"
                rel="noreferrer"
                className={opsButtonClassName("solid")}
              >
                <GitHubMark className="size-3.5" />
                {t.about.cta}
              </Link>
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
