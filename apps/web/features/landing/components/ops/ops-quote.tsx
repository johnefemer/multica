"use client";

import { useLocale } from "../../i18n";
import { OpsSection } from "./ops-primitives";

export function OpsQuote() {
  const { t } = useLocale();
  const { quote } = t.ops;

  return (
    <OpsSection>
      <div className="grid grid-cols-[1fr_240px] items-end gap-12 border border-[var(--line2)] bg-[var(--bg2)] p-12 max-[760px]:grid-cols-1 max-[760px]:gap-7 max-[760px]:p-7">
        <q className="block text-[length:var(--font-size-quote)] font-[number:var(--weight-medium)] uppercase leading-[1.4] tracking-[-0.005em] text-[var(--txt)] max-[760px]:text-[length:var(--font-size-quote-sm)] max-[760px]:leading-[1.45]">
          <span
            aria-hidden="true"
            className="mr-1 align-[-8px] text-[32px] leading-[0] text-[var(--accent)]"
          >
            ❝
          </span>
          {quote.bodyPre}
          <span className="text-[var(--accent)]">{quote.bodyHighlight}</span>
          {quote.bodyPost}
        </q>
        <div className="text-[length:var(--font-size-micro)] leading-[var(--lh-loose)] tracking-[var(--tr-tag)] text-[var(--dim)]">
          <b className="mb-1 block font-[number:var(--weight-bold)] text-[var(--txt)]">
            {quote.by.name}
          </b>
          <span className="font-[number:var(--weight-medium)] text-[var(--accent)]">
            {quote.by.role}
          </span>
          <br />
          {quote.by.lines.map((line, i) => (
            <span key={i}>
              {line}
              {i < quote.by.lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </div>
      </div>
    </OpsSection>
  );
}
