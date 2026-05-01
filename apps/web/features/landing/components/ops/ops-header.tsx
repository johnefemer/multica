"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@multica/ui/lib/utils";
import { useAuthStore } from "@multica/core/auth";
import { useLocale } from "../../i18n";
import { OpsContainer, opsButtonClassName } from "./ops-primitives";

export function OpsHeader() {
  const { t } = useLocale();
  const { nav } = t.ops;
  const user = useAuthStore((s) => s.user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close drawer when viewport widens past the burger breakpoint.
  useEffect(() => {
    if (!drawerOpen) return;
    const handler = () => {
      if (window.innerWidth > 1020) setDrawerOpen(false);
    };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [drawerOpen]);

  const navLinks = [
    { href: "#product", label: nav.product },
    { href: "#workflow", label: nav.workflow },
    { href: "#compare", label: nav.compare },
    { href: "#pricing", label: nav.pricing },
    { href: "#docs", label: nav.docs },
    { href: "#changelog", label: nav.changelog },
  ];

  const ctaHref = user ? "/" : "/login";

  return (
    <nav className="sticky top-0 z-[var(--z-nav)] border-b border-[var(--line2)] bg-[var(--bg-sticky)] backdrop-blur-md">
      <OpsContainer>
        <div className="flex h-[var(--nav-height)] items-center justify-between">
          <Link
            href="/"
            className="flex min-w-0 items-center gap-[10px] text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] tracking-[var(--tr-label)] text-[var(--txt)]"
          >
            <span
              aria-hidden="true"
              className="block h-[10px] w-[10px] flex-none bg-[var(--accent)] [animation:ops-pulse_2.4s_ease-in-out_infinite] [box-shadow:var(--glow-accent)]"
            />
            <span className="truncate">AGENTHOST</span>
            <span className="ml-1 truncate text-[length:var(--font-size-micro)] font-[number:var(--weight-regular)] text-[var(--dim)] max-[480px]:hidden">
              {"// KENSINK_LABS"}
            </span>
          </Link>

          <div className="flex gap-6 text-[length:var(--font-size-label)] tracking-[var(--tr-caps)] text-[var(--dim)] max-[1020px]:hidden">
            {navLinks.map((link, i) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative py-[6px] transition-colors duration-[var(--duration-fast)] hover:text-[var(--txt)]",
                  i === 0 && "text-[var(--txt)]",
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[length:var(--font-size-nano)] tracking-[var(--tr-caps)] text-[var(--dim)] max-[1020px]:hidden">
              <b className="font-[number:var(--weight-regular)] text-[var(--accent)]">
                {nav.statusOnline}
              </b>{" "}
              · {nav.statusRuntimes}
            </span>
            <Link href={ctaHref} className={opsButtonClassName("outline")}>
              {nav.cta}
            </Link>
            <button
              type="button"
              aria-label={nav.menuLabel}
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen((v) => !v)}
              className="hidden h-9 w-9 items-center justify-center border border-[var(--line2)] bg-transparent p-0 max-[1020px]:inline-flex"
            >
              <span
                aria-hidden="true"
                className="relative block h-px w-[14px] bg-[var(--txt)] before:absolute before:left-0 before:top-[-5px] before:block before:h-px before:w-[14px] before:bg-[var(--txt)] before:content-[''] after:absolute after:left-0 after:top-[5px] after:block after:h-px after:w-[14px] after:bg-[var(--txt)] after:content-['']"
              />
            </button>
          </div>
        </div>
      </OpsContainer>

      {drawerOpen ? (
        <div
          className="fixed inset-x-0 top-[var(--nav-height)] bottom-0 z-[var(--z-drawer)] flex flex-col gap-0 border-t border-[var(--line2)] bg-[var(--bg-drawer)] px-5 pb-8 pt-6 backdrop-blur-md"
          onClick={(e) => {
            if ((e.target as HTMLElement).tagName === "A") setDrawerOpen(false);
          }}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between border-b border-[var(--line)] px-1 py-[18px] text-[length:var(--font-size-dense)] tracking-[var(--tr-label)] text-[var(--txt)] after:text-[var(--accent)] after:content-['→']"
            >
              {link.label}
            </Link>
          ))}
          <span className="mt-[18px] block text-[length:var(--font-size-label)] text-[var(--dim)] tracking-[var(--tr-caps)]">
            <b className="font-[number:var(--weight-regular)] text-[var(--accent)]">
              {nav.statusOnline}
            </b>{" "}
            · {nav.statusRuntimes}
          </span>
        </div>
      ) : null}
    </nav>
  );
}
