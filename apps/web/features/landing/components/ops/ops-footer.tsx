"use client";

import Link from "next/link";
import { cn } from "@multica/ui/lib/utils";
import { useLocale, locales, localeLabels } from "../../i18n";
import { GitHubMark, githubUrl } from "../shared";
import { OpsContainer } from "./ops-primitives";

export function OpsFooter() {
  const { t, locale, setLocale } = useLocale();
  const { footer } = t.ops;

  return (
    <footer className="pb-8 pt-14">
      <OpsContainer>
        <div className="mb-12 grid grid-cols-1 gap-7 max-[480px]:grid-cols-1 max-[880px]:grid-cols-2 max-[880px]:gap-7 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:gap-8">
          {/* Brand cell */}
          <div className="max-[880px]:col-span-2 max-[480px]:col-auto">
            <div className="flex items-center gap-[10px] text-[var(--font-size-tag)] font-[var(--weight-medium)] tracking-[var(--tr-label)]">
              <span
                aria-hidden="true"
                className="block h-[10px] w-[10px] bg-[var(--accent)] [animation:ops-pulse_2.4s_ease-in-out_infinite] [box-shadow:var(--glow-accent)]"
              />
              <span>AGENTHOST</span>
            </div>
            <p className="mt-[14px] text-[12.5px] leading-[var(--lh-log)] text-[var(--dim)]">
              {footer.tagline}
            </p>
            <Link
              href={githubUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="mt-[14px] inline-flex text-[var(--dim)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--txt)]"
            >
              <GitHubMark className="size-4" />
            </Link>
          </div>

          {/* Link groups */}
          {footer.groups.map((group, i) => (
            <div key={i}>
              <h6 className="m-0 mb-[14px] text-[var(--font-size-nano)] font-[var(--weight-medium)] tracking-[var(--tr-label)] text-[var(--accent)]">
                {group.label}
              </h6>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[var(--font-size-dense)] text-[var(--txt2)]">
                {group.links.map((link, j) => (
                  <li key={j}>
                    <Link
                      href={link.href}
                      className="text-[var(--txt2)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--txt)]"
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line2)] pt-6 text-[var(--font-size-label)] tracking-[var(--tr-caps)] text-[var(--dim)]">
          <span>
            {footer.copyright.replace("{year}", String(new Date().getFullYear()))}
          </span>
          <div className="flex items-center gap-4">
            <span>{footer.buildString}</span>
            <div className="flex items-center">
              {locales.map((l, i) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "px-[6px] py-1 text-[var(--font-size-tag)] font-[var(--weight-medium)] tracking-[var(--tr-tag)] transition-colors duration-[var(--duration-fast)]",
                    l === locale
                      ? "text-[var(--txt)]"
                      : "text-[var(--dim)] hover:text-[var(--txt2)]",
                    i > 0 && "border-l border-[var(--line2)]",
                  )}
                >
                  {localeLabels[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </OpsContainer>
    </footer>
  );
}
