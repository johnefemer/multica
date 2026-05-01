"use client";

import Link from "next/link";
import { useAuthStore } from "@multica/core/auth";
import { useLocale } from "../../i18n";
import { OpsContainer, opsButtonClassName } from "./ops-primitives";

export function OpsCallToAction() {
  const { t } = useLocale();
  const { cta } = t.ops;
  const user = useAuthStore((s) => s.user);
  const ctaHref = user ? "/" : "/login";
  const [line1, line2, line3, line4] = cta.headlineParts;

  return (
    <section
      id="cta"
      className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y-md)] sm:py-[var(--cta-pad-y-lg)] lg:py-[var(--cta-pad-y)]"
      style={{ background: "var(--bg-cta-glow), var(--bg)" }}
    >
      <OpsContainer>
        <div className="grid grid-cols-1 items-end gap-9 max-[880px]:grid-cols-1 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <div>
            <h2 className="m-0 mb-7 max-w-[18ch] break-words text-[var(--font-size-cta-md)] font-[var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[380px]:text-[var(--font-size-cta-sm)] max-[1020px]:text-[var(--font-size-cta-lg)] sm:text-[var(--font-size-cta-md)] lg:text-[var(--font-size-cta)]">
              {line1}
              <br />
              <span className="text-[var(--accent)]">{line2}</span>
              <br />
              {line3}
              <span className="text-[var(--dim2)]">{line4}</span>
            </h2>
            <p className="m-0 mb-9 max-w-[56ch] text-[var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
              {cta.body}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={ctaHref} className={opsButtonClassName("solid")}>
                {cta.primary}
              </Link>
              <Link href="#docs" className={opsButtonClassName("outline")}>
                {cta.secondary}
              </Link>
              <Link href="#" className={opsButtonClassName("ghost")}>
                {cta.tertiary}
              </Link>
            </div>
          </div>
          <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
            {[
              { k: "// BUILD", v: cta.meta.build },
              { k: "// LICENSE", v: cta.meta.license },
              { k: "// RUNTIME", v: cta.meta.runtime },
              { k: "// STATUS", v: cta.meta.status, ok: true },
              { k: "// CONTACT", v: cta.meta.contact },
              { k: "// REPO", v: cta.meta.repo },
            ].map((row) => (
              <div
                key={row.k}
                className="flex justify-between border-b border-[var(--line)] px-[18px] py-[14px] text-[var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] last:border-b-0"
              >
                <span>{row.k}</span>
                <b
                  className={
                    row.ok
                      ? "font-[var(--weight-medium)] text-[var(--accent)]"
                      : "font-[var(--weight-medium)] text-[var(--txt)]"
                  }
                >
                  {row.v}
                </b>
              </div>
            ))}
          </div>
        </div>
      </OpsContainer>
    </section>
  );
}
