"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@multica/ui/lib/utils";
import { useAuthStore } from "@multica/core/auth";
import { useLocale } from "../../i18n";
import { OpsContainer, opsButtonClassName } from "./ops-primitives";

function BurgerIcon() {
  return (
    <span
      aria-hidden="true"
      className="relative block h-px w-[14px] bg-[var(--txt)] before:absolute before:left-0 before:top-[-5px] before:block before:h-px before:w-[14px] before:bg-[var(--txt)] before:content-[''] after:absolute after:left-0 after:top-[5px] after:block after:h-px after:w-[14px] after:bg-[var(--txt)] after:content-['']"
    />
  );
}

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 2L12 12M12 2L2 12"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="square"
      />
    </svg>
  );
}

export function OpsHeader() {
  const { t } = useLocale();
  const { nav, footer } = t.ops;
  const user = useAuthStore((s) => s.user);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-close on viewport widening, ESC, and lock body scroll while open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onResize = () => {
      if (window.innerWidth > 1020) setDrawerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
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
  const closeDrawer = () => setDrawerOpen(false);

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
              aria-label={drawerOpen ? "Close menu" : nav.menuLabel}
              aria-expanded={drawerOpen}
              aria-controls="ops-mobile-drawer"
              onClick={() => setDrawerOpen((v) => !v)}
              className="hidden h-9 w-9 items-center justify-center border border-[var(--line2)] bg-transparent p-0 text-[var(--txt)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--line3)] max-[1020px]:inline-flex"
            >
              {drawerOpen ? <CloseIcon /> : <BurgerIcon />}
            </button>
          </div>
        </div>
      </OpsContainer>

      {drawerOpen ? (
        <div
          id="ops-mobile-drawer"
          role="dialog"
          aria-modal="true"
          aria-label={nav.menuLabel}
          className="fixed inset-x-0 top-[var(--nav-height)] bottom-0 z-[var(--z-drawer)] flex flex-col border-t border-[var(--line2)] bg-[var(--bg)] [animation:ops-drawer-in_240ms_ease-out]"
        >
          {/* Scrollable nav region */}
          <div className="flex-1 overflow-y-auto px-5 pb-6 pt-2">
            <div className="mb-4 px-1 pt-3 text-[length:var(--font-size-nano)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {"// NAV"}
            </div>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={closeDrawer}
                className="flex items-center justify-between border-b border-[var(--line)] px-1 py-[18px] text-[length:var(--font-size-dense)] tracking-[var(--tr-label)] text-[var(--txt)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent)] after:text-[var(--accent)] after:content-['→']"
              >
                {link.label}
              </Link>
            ))}
            <span className="mt-6 block px-1 text-[length:var(--font-size-label)] tracking-[var(--tr-caps)] text-[var(--dim)]">
              <b className="font-[number:var(--weight-regular)] text-[var(--accent)]">
                {nav.statusOnline}
              </b>{" "}
              · {nav.statusRuntimes}
            </span>
          </div>

          {/* Sticky footer */}
          <div className="border-t border-[var(--line2)] bg-[var(--bg2)] px-5 pb-6 pt-5">
            <div className="mb-3 flex items-center gap-[10px]">
              <span
                aria-hidden="true"
                className="block h-[10px] w-[10px] flex-none bg-[var(--accent)] [animation:ops-pulse_2.4s_ease-in-out_infinite] [box-shadow:var(--glow-accent)]"
              />
              <span className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] tracking-[var(--tr-label)] text-[var(--txt)]">
                AGENTHOST
              </span>
              <span className="text-[length:var(--font-size-micro)] font-[number:var(--weight-regular)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {"// KENSINK_LABS"}
              </span>
            </div>
            <p className="m-0 mb-4 text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
              {footer.copyright.replace(
                "{year}",
                String(new Date().getFullYear()),
              )}
            </p>
            <Link
              href={ctaHref}
              onClick={closeDrawer}
              className={cn(
                opsButtonClassName("solid"),
                "w-full justify-center",
              )}
            >
              {nav.cta}
            </Link>
          </div>
        </div>
      ) : null}
    </nav>
  );
}
