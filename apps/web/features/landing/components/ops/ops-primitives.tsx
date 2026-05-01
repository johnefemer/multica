import type { ReactNode } from "react";
import { cn } from "@multica/ui/lib/utils";

export function OpsContainer({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[var(--container-max)] px-[var(--container-pad-md)] sm:px-[var(--container-pad-lg)] lg:px-[var(--container-pad)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function OpsSection({
  id,
  className,
  containerClassName,
  children,
}: {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative border-b border-[var(--line2)]",
        "py-[var(--section-pad-md)] sm:py-[var(--section-pad-lg)] lg:py-[var(--section-pad)]",
        className,
      )}
    >
      <OpsContainer className={containerClassName}>{children}</OpsContainer>
    </section>
  );
}

export function OpsSectionHead({
  num,
  label,
  headlineParts,
  sub,
  toneMap,
}: {
  num: string;
  label: string;
  headlineParts: string[];
  sub?: string;
  /**
   * Optional per-fragment tone for the headline. Default tone is `txt`.
   * Use the index of the fragment as the key.
   */
  toneMap?: Record<number, "txt" | "accent" | "dim2">;
}) {
  return (
    <div className="mb-9 grid grid-cols-1 gap-[18px] sm:mb-14 sm:grid-cols-[200px_1fr] sm:gap-12">
      <div className="pt-[10px] text-[var(--font-size-micro)] tracking-[var(--tr-label)] text-[var(--dim)]">
        <span className="mb-2 block text-[var(--font-size-label)] text-[var(--accent)]">
          {num}
        </span>
        {label}
      </div>
      <div>
        <h2
          className="m-0 break-words text-[var(--font-size-h2-md)] font-[var(--weight-bold)] uppercase leading-[1.05] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[var(--font-size-h2-lg)] sm:text-[var(--font-size-h2)]"
        >
          {headlineParts.map((part, i) => {
            const tone = toneMap?.[i] ?? "txt";
            const className =
              tone === "accent"
                ? "text-[var(--accent)]"
                : tone === "dim2"
                  ? "text-[var(--dim2)]"
                  : "text-[var(--txt)]";
            return (
              <span key={i} className={className}>
                {part}
              </span>
            );
          })}
        </h2>
        {sub ? (
          <p className="mt-[18px] max-w-[62ch] text-[var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)] sm:text-[var(--font-size-body)]">
            {sub}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export type OpsButtonTone = "solid" | "outline" | "ghost";

export function opsButtonClassName(tone: OpsButtonTone = "outline") {
  const base =
    "inline-flex items-center gap-2 px-[18px] font-[var(--weight-medium)] uppercase tracking-[var(--tr-tag)] text-[var(--font-size-label)] transition-[background-color,color,border-color] duration-[var(--duration-fast)] cursor-pointer";
  const sizing = "min-h-[var(--btn-min-h)] py-[11px]";
  const variant =
    tone === "solid"
      ? "bg-[var(--accent)] text-[var(--bg)] border border-[var(--accent)] hover:bg-[var(--accent-hover)]"
      : tone === "ghost"
        ? "bg-transparent text-[var(--dim)] border border-[var(--line2)] hover:bg-[var(--line)] hover:text-[var(--txt)] hover:border-[var(--line3)]"
        : "bg-transparent text-[var(--accent)] border border-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--bg)]";
  return cn(base, sizing, variant);
}
