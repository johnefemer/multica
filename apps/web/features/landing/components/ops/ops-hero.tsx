"use client";

import Link from "next/link";
import { useAuthStore } from "@multica/core/auth";
import { useLocale } from "../../i18n";
import { OpsContainer, opsButtonClassName } from "./ops-primitives";
import { OpsWorksWith } from "./ops-works-with";
import { OpsSprintQueue } from "./ops-sprint-queue";
import { OpsStreamFeed } from "./ops-stream-feed";

export function OpsHero() {
  const { t } = useLocale();
  const { hero } = t.ops;
  const user = useAuthStore((s) => s.user);
  const ctaHref = user ? "/" : "/login";

  return (
    <header className="relative overflow-hidden border-b border-[var(--line2)] py-[var(--hero-pad-y-md-top)] pb-[var(--hero-pad-y-md-bot)] sm:pt-[var(--hero-pad-y-top)] sm:pb-[var(--hero-pad-y-bot)]">
      <OpsContainer>
        <div className="grid grid-cols-1 gap-10 max-[1020px]:grid-cols-1 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="mb-8 flex flex-wrap items-center gap-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-label)] text-[var(--accent)] before:content-['//'] before:text-[var(--dim)]">
              <span>{hero.eyebrow.build}</span>
              <span className="text-[var(--dim2)]">/</span>
              <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {hero.eyebrow.version}
              </span>
              <span className="text-[var(--dim2)]">/</span>
              <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {hero.eyebrow.date}
              </span>
            </div>

            <h1 className="m-0 mb-6 break-words text-[length:var(--font-size-hero-md)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[380px]:text-[length:var(--font-size-hero-sm)] max-[1020px]:text-[length:var(--font-size-hero-lg)] sm:mb-8 sm:text-[length:var(--font-size-hero-md)] lg:text-[length:var(--font-size-hero)]">
              {hero.headlineLine1}
              <br />
              {hero.headlineLine2Pre}
              <span className="font-[number:var(--weight-medium)] text-[var(--accent)]">
                {hero.headlineLine2Connector}
              </span>
              <br />
              <span className="text-[var(--dim2)]">{hero.headlineLine3Open}</span>
              {hero.headlineLine3Inner}
              <span className="text-[var(--dim2)]">{hero.headlineLine3Close}</span>
            </h1>

            <p className="m-0 mb-9 max-w-[54ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              {hero.ledeIntro}
              <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
                {hero.ledeBold}
              </b>
              {hero.ledeMid}
              <span className="text-[var(--accent)]">{hero.ledeHighlight}</span>
              {hero.ledeTail}
            </p>

            <div className="mb-9 flex flex-wrap items-center gap-[10px]">
              <Link href={ctaHref} className={opsButtonClassName("solid")}>
                {hero.ctaPrimary}
              </Link>
              <Link href="#workflow" className={opsButtonClassName("ghost")}>
                {hero.ctaSecondary}
              </Link>
              <span className="ml-[6px] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
                {hero.ctaMeta}
              </span>
            </div>

            <OpsWorksWith />

            <div className="grid grid-cols-2 border border-[var(--line2)] sm:grid-cols-4">
              {(
                [
                  hero.meta.codingClis,
                  hero.meta.firstPr,
                  hero.meta.automated,
                  hero.meta.deploy,
                ] as { k: string; v: string; vSuffix?: string; n: string }[]
              ).map((cell, i) => (
                <div
                  key={i}
                  className="border-b border-r border-[var(--line2)] px-5 py-[18px] last:border-r-0 sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0 sm:!border-b-0 lg:!border-r lg:last:!border-r-0 lg:[&:nth-child(2n)]:!border-r"
                >
                  <div className="mb-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                    {cell.k}
                  </div>
                  <div className="text-[length:var(--font-size-metric)] font-[number:var(--weight-bold)] tracking-[-0.02em] text-[var(--txt)]">
                    {cell.v}
                    {cell.vSuffix ? (
                      <small className="ml-1 text-[11px] font-[number:var(--weight-medium)] text-[var(--accent)]">
                        {cell.vSuffix}
                      </small>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[length:var(--font-size-micro)] tracking-[0.04em] text-[var(--dim)]">
                    {cell.n}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-[14px]">
            <OpsSprintQueue />
            <OpsStreamFeed />
          </div>
        </div>
      </OpsContainer>
    </header>
  );
}
