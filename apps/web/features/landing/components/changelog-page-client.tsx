"use client";

import {
  type MouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@multica/ui/lib/utils";
import { OpsPageShell } from "./ops/ops-page-shell";
import { OpsContainer } from "./ops/ops-primitives";
import { useLocale } from "../i18n";
import type { Locale } from "../i18n/types";

const MONTHS_EN = [
  "JANUARY",
  "FEBRUARY",
  "MARCH",
  "APRIL",
  "MAY",
  "JUNE",
  "JULY",
  "AUGUST",
  "SEPTEMBER",
  "OCTOBER",
  "NOVEMBER",
  "DECEMBER",
];

type ParsedDate = { year: number; month: number; day: number };

function parseDate(dateStr: string): ParsedDate {
  const parts = dateStr.split("-");
  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
    day: Number(parts[2]),
  };
}

function monthYearLabel(year: number, month: number, locale: Locale) {
  if (!year || !month) return "";
  if (locale === "zh") return `${year}年${month}月`;
  return `${MONTHS_EN[month - 1]} ${year}`;
}

function fullDateLabel(dateStr: string, locale: Locale) {
  const { year, month, day } = parseDate(dateStr);
  if (!year || !month || !day) return dateStr;
  if (locale === "zh") return `${year}年${month}月${day}日`;
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

type Release = {
  version: string;
  date: string;
  title: string;
  changes: string[];
  features?: string[];
  improvements?: string[];
  fixes?: string[];
};

type MonthGroup = {
  key: string;
  year: number;
  month: number;
  entries: Release[];
};

function groupByMonth(entries: readonly Release[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const entry of entries) {
    const { year, month } = parseDate(entry.date);
    const key = `${year}-${month}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, year, month, entries: [entry] });
    }
  }
  return groups;
}

function anchorId(version: string) {
  return `release-${version.replace(/\./g, "-")}`;
}

function ChangeList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 mt-3 list-none space-y-2 p-0">
      {items.map((change) => (
        <li
          key={change}
          className="flex items-start gap-3 text-[length:var(--font-size-dense)] leading-[var(--lh-loose)] text-[var(--txt2)]"
        >
          <span
            aria-hidden="true"
            className="mt-[10px] h-[3px] w-[8px] flex-none bg-[var(--accent)]"
          />
          <span>{change}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChangelogPageClient() {
  const { t, locale } = useLocale();
  const categoryLabels = t.changelog.categories;
  const entries = t.changelog.entries;
  const groups = useMemo(() => groupByMonth(entries), [entries]);

  const [activeVersion, setActiveVersion] = useState<string>(
    entries[0]?.version ?? "",
  );
  const navLockRef = useRef<number | null>(null);

  useEffect(() => {
    if (entries.length === 0) return;
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((e) => {
          const v = (e.target as HTMLElement).dataset.version;
          if (!v) return;
          if (e.isIntersecting) visible.add(v);
          else visible.delete(v);
        });
        if (navLockRef.current !== null) return;

        const firstVisible = entries.find((r) => visible.has(r.version));
        if (firstVisible) {
          setActiveVersion(firstVisible.version);
          return;
        }
        const scrollY = window.scrollY;
        let best = entries[0]?.version ?? "";
        for (const r of entries) {
          const el = document.getElementById(anchorId(r.version));
          if (!el) continue;
          if (el.getBoundingClientRect().top + scrollY <= scrollY + 160) {
            best = r.version;
          }
        }
        setActiveVersion(best);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    entries.forEach((r) => {
      const el = document.getElementById(anchorId(r.version));
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries]);

  const jumpTo = (version: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(anchorId(version));
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${anchorId(version)}`);
    setActiveVersion(version);
    if (navLockRef.current !== null) {
      window.clearTimeout(navLockRef.current);
    }
    navLockRef.current = window.setTimeout(() => {
      navLockRef.current = null;
    }, 800);
  };

  return (
    <OpsPageShell>
      <article className="border-b border-[var(--line2)] py-[var(--section-pad)] max-[1020px]:py-[var(--section-pad-lg)] max-[760px]:py-[var(--section-pad-md)]">
        <OpsContainer>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
            <aside className="hidden lg:block">
              <nav
                aria-label={t.changelog.toc}
                className="sticky top-[calc(var(--nav-height)+24px)] max-h-[calc(100vh-var(--nav-height)-32px)] overflow-y-auto pb-8 pr-2"
              >
                <div className="mb-5 text-[length:var(--font-size-nano)] tracking-[var(--tr-label)] text-[var(--dim)]">
                  <span className="text-[var(--dim2)]">{"// "}</span>
                  {t.changelog.toc}
                </div>

                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-[4px] top-2 bottom-2 w-px bg-[var(--line2)]"
                  />

                  <ol className="m-0 list-none space-y-5 p-0">
                    {groups.map((group) => (
                      <li key={group.key} className="m-0 p-0">
                        <p className="m-0 ml-6 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-label)] text-[var(--dim)]">
                          {monthYearLabel(group.year, group.month, locale)}
                        </p>

                        <ol className="m-0 mt-1.5 list-none p-0">
                          {group.entries.map((release) => {
                            const isActive =
                              release.version === activeVersion;
                            const { day } = parseDate(release.date);
                            return (
                              <li
                                key={release.version}
                                className="m-0 p-0"
                              >
                                <a
                                  href={`#${anchorId(release.version)}`}
                                  onClick={jumpTo(release.version)}
                                  aria-current={isActive ? "true" : undefined}
                                  className={cn(
                                    "group relative flex items-center gap-3 py-1 pr-2 text-[length:var(--font-size-tag)] transition-colors duration-[var(--duration-fast)]",
                                    isActive
                                      ? "text-[var(--txt)]"
                                      : "text-[var(--dim)] hover:text-[var(--txt2)]",
                                  )}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      "relative z-10 block size-[9px] flex-none border transition-colors duration-[var(--duration-fast)]",
                                      isActive
                                        ? "border-[var(--accent)] bg-[var(--accent)] [box-shadow:var(--glow-accent)]"
                                        : "border-[var(--line3)] bg-[var(--bg)] group-hover:border-[var(--txt2)]",
                                    )}
                                  />
                                  <span
                                    className={cn(
                                      "w-[1.25rem] flex-none text-right tabular-nums",
                                      isActive
                                        ? "font-[number:var(--weight-bold)]"
                                        : "font-[number:var(--weight-medium)]",
                                    )}
                                  >
                                    {String(day).padStart(2, "0")}
                                  </span>
                                  <span className="tabular-nums text-[length:var(--font-size-nano)] text-[var(--dim2)]">
                                    v{release.version}
                                  </span>
                                </a>
                              </li>
                            );
                          })}
                        </ol>
                      </li>
                    ))}
                  </ol>
                </div>
              </nav>
            </aside>

            <div className="min-w-0">
              <div className="mb-8 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// CHANGELOG"}
              </div>
              <h1 className="m-0 mb-4 text-[length:var(--font-size-h2)] font-[number:var(--weight-bold)] uppercase leading-[1.05] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-h2-lg)] max-[760px]:text-[length:var(--font-size-h2-md)] [overflow-wrap:anywhere]">
                {t.changelog.title}
              </h1>
              <p className="m-0 mb-12 max-w-[62ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {t.changelog.subtitle}
              </p>

              <div className="space-y-14">
                {entries.map((release) => {
                  const hasCategorized =
                    release.features ||
                    release.improvements ||
                    release.fixes;
                  return (
                    <section
                      key={release.version}
                      id={anchorId(release.version)}
                      data-version={release.version}
                      className="relative scroll-mt-[calc(var(--nav-height)+16px)] border-t border-[var(--line)] pt-8"
                    >
                      <div className="flex items-baseline gap-3 text-[length:var(--font-size-label)] tracking-[var(--tr-caps)] text-[var(--dim)]">
                        <span className="font-[number:var(--weight-medium)] tabular-nums text-[var(--accent)]">
                          v{release.version}
                        </span>
                        <span className="tabular-nums text-[var(--dim)]">
                          {fullDateLabel(release.date, locale)}
                        </span>
                      </div>
                      <h2 className="m-0 mt-3 text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase leading-[1.15] tracking-[-0.012em] text-[var(--txt)]">
                        {release.title}
                      </h2>

                      {hasCategorized ? (
                        <div className="mt-6 space-y-7">
                          {release.features &&
                            release.features.length > 0 && (
                              <div>
                                <h3 className="m-0 text-[length:var(--font-size-nano)] tracking-[var(--tr-label)] text-[var(--accent)]">
                                  {"// "}
                                  {categoryLabels.features.toUpperCase()}
                                </h3>
                                <ChangeList items={release.features} />
                              </div>
                            )}
                          {release.improvements &&
                            release.improvements.length > 0 && (
                              <div>
                                <h3 className="m-0 text-[length:var(--font-size-nano)] tracking-[var(--tr-label)] text-[var(--accent2)]">
                                  {"// "}
                                  {categoryLabels.improvements.toUpperCase()}
                                </h3>
                                <ChangeList items={release.improvements} />
                              </div>
                            )}
                          {release.fixes && release.fixes.length > 0 && (
                            <div>
                              <h3 className="m-0 text-[length:var(--font-size-nano)] tracking-[var(--tr-label)] text-[var(--warn)]">
                                {"// "}
                                {categoryLabels.fixes.toUpperCase()}
                              </h3>
                              <ChangeList items={release.fixes} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="mt-4">
                          <ChangeList items={release.changes} />
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </div>
          </div>
        </OpsContainer>
      </article>
    </OpsPageShell>
  );
}
