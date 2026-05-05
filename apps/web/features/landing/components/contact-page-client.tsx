"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";

/**
 * /contact — direct lines and a structured intake form.
 *
 * Form submission is mailto:-based (no backend dependency): on submit
 * we construct an `agenthost@kensink.com` mailto URL with the topic
 * encoded into the subject and the form fields rendered in the body.
 * The user's mail client opens with a pre-filled draft. This works
 * everywhere immediately; if/when we add a server-side mailer for the
 * landing surface we can swap to a real POST without touching the UI.
 */

const PRIMARY_INBOX = "agenthost@kensink.com";

const DIRECT_LINES: {
  email: string;
  label: string;
  purpose: string;
  notes: string;
}[] = [
  {
    email: "support@kensink.com",
    label: "// SUPPORT",
    purpose: "Product help, bugs, account issues",
    notes: "Median response · 8 business hours · Mon–Fri",
  },
  {
    email: "triage@kensink.com",
    label: "// TRIAGE",
    purpose: "Incidents, P0 outages, urgent regressions",
    notes: "On-call rotation · 24/7 best-effort during beta",
  },
  {
    email: "legal@kensink.com",
    label: "// LEGAL",
    purpose: "Compliance, DPA, contracts, security review",
    notes: "Median response · 2 business days",
  },
  {
    email: "partners@kensink.com",
    label: "// PARTNERS",
    purpose: "Integrations, distribution, GTM partnerships",
    notes: "Founder reads every thread · Mon–Fri",
  },
];

const TOPICS = [
  "Product question",
  "Bug report",
  "Sales / Demo",
  "Partnership",
  "Press / Media",
  "Other",
] as const;

type Topic = (typeof TOPICS)[number];

const SUPPORT_LAYERS: {
  num: string;
  name: string;
  desc: string;
  cta?: { label: string; href: string };
}[] = [
  {
    num: "01",
    name: "DOCS_FIRST",
    desc: "Most issues are answered in the docs. Search by symptom; the example workspace mirrors what production teams ship.",
    cta: { label: "OPEN_DOCS →", href: "/docs" },
  },
  {
    num: "02",
    name: "STATUS_PAGE",
    desc: "Live system status for the control plane and runtime registries. Subscribe for incident updates by email.",
    cta: { label: "OPEN_STATUS →", href: "/status" },
  },
  {
    num: "03",
    name: "EMAIL_TIER",
    desc: "Direct inboxes (support / triage / legal / partners) — see the table above. We tag and assign within the hour during business days.",
  },
  {
    num: "04",
    name: "FOUNDER_DIRECT",
    desc: "Use the form below or write to agenthost@kensink.com. Every message lands in a founder-watched inbox; we read every one.",
    cta: { label: `MAILTO_${PRIMARY_INBOX}`, href: `mailto:${PRIMARY_INBOX}` },
  },
];

export function ContactPageClient() {
  return (
    <OpsPageShell>
      {/* §00 — HERO */}
      <OpsSection id="hero">
        <div className="mb-9 flex flex-wrap items-center gap-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-label)] text-[var(--accent)] before:content-['//'] before:text-[var(--dim)]">
          <span>CONTACT</span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            DIRECT_LINES
          </span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            FOUNDER_INBOX
          </span>
        </div>

        <div className="grid grid-cols-[1.4fr_minmax(0,1fr)] gap-12 max-[1180px]:grid-cols-1 max-[1180px]:gap-10">
          <div>
            <h1 className="m-0 mb-6 sm:mb-8 [overflow-wrap:anywhere] text-[length:var(--font-size-hero-lg)] font-[number:var(--weight-bold)] uppercase leading-[0.98] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1280px]:text-[length:var(--font-size-hero-md)] max-[760px]:text-[length:var(--font-size-hero-sm)]">
              <span className="text-[var(--accent)]">DIRECT LINES.</span>
              <br />
              NO TICKET QUEUES.
            </h1>
            <p className="m-0 mb-9 max-w-[60ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              Four named inboxes — pick the one that fits, or use the form
              below to land in our shared founder inbox.{" "}
              <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
                We answer every thread.
              </b>{" "}
              Median first reply on weekdays:{" "}
              <span className="text-[var(--accent)]">under 4 hours</span>.
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-[10px]">
              <Link href="#form" className={opsButtonClassName("solid")}>
                WRITE TO US ↓
              </Link>
              <Link
                href={`mailto:${PRIMARY_INBOX}`}
                className={opsButtonClassName("ghost")}
              >
                {`MAILTO_${PRIMARY_INBOX.toUpperCase()}`}
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// CONTACT_AT_A_GLANCE"}
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {[
                  { k: "PRIMARY", v: PRIMARY_INBOX },
                  { k: "RESPONSE", v: "<4h weekdays · best-effort weekends" },
                  { k: "TIMEZONE", v: "UTC+8 · CN office hours" },
                  { k: "INCIDENTS", v: "triage@kensink.com · 24/7" },
                  { k: "FORMAT", v: "plain text · no portals" },
                ].map((row) => (
                  <li
                    key={row.k}
                    className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-b-0 last:pb-0 text-[length:var(--font-size-tag)]"
                  >
                    <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                      {`// ${row.k}`}
                    </span>
                    <span className="text-[var(--txt)]">{row.v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </OpsSection>

      {/* §01 — DIRECT EMAILS */}
      <OpsSection id="emails">
        <OpsSectionHead
          num="§01"
          label="// DIRECT_EMAILS"
          headlineParts={["FOUR NAMED INBOXES. ", "ONE PER PURPOSE."]}
          toneMap={{ 1: "accent" }}
          sub="Each address routes to a small, watched team. Choose the right one and you skip a triage hop."
        />
        <div className="grid grid-cols-2 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {DIRECT_LINES.map((line, i) => (
            <a
              key={line.email}
              href={`mailto:${line.email}`}
              className={`group relative flex flex-col gap-3 bg-[var(--bg2)] p-7 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg2))] ${i % 2 === 0 ? "border-r border-[var(--line2)] max-[880px]:border-r-0" : ""} ${i < DIRECT_LINES.length - 2 ? "border-b border-[var(--line2)]" : ""} max-[880px]:border-b max-[880px]:last:border-b-0`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {line.label}
                </span>
                <Mail className="h-3.5 w-3.5 text-[var(--dim)] transition-colors group-hover:text-[var(--accent)]" />
              </div>
              <code className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-h5)] font-[number:var(--weight-medium)] tracking-[0.02em] text-[var(--txt)] transition-colors group-hover:text-[var(--accent)]">
                {line.email}
              </code>
              <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {line.purpose}
              </p>
              <div className="mt-auto pt-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {`// ${line.notes}`}
              </div>
            </a>
          ))}
        </div>
      </OpsSection>

      {/* §02 — SUPPORT LAYERS */}
      <OpsSection id="support">
        <OpsSectionHead
          num="§02"
          label="// SUPPORT_LAYERS"
          headlineParts={["FOUR LAYERS. ", "ESCALATE WHEN YOU NEED TO."]}
          toneMap={{ 1: "accent" }}
          sub="Most teams resolve in the first two layers. The bottom two exist so nothing falls through."
        />
        <div className="grid grid-cols-4 gap-0 border border-[var(--line2)] max-[1020px]:grid-cols-2 max-[640px]:grid-cols-1">
          {SUPPORT_LAYERS.map((layer, i) => (
            <div
              key={layer.num}
              className={`flex flex-col gap-3 bg-[var(--bg2)] p-7 ${
                i < SUPPORT_LAYERS.length - 1
                  ? "border-r border-[var(--line2)] max-[1020px]:[&:nth-child(2n)]:border-r-0 max-[640px]:!border-r-0"
                  : ""
              } ${i < 2 ? "max-[1020px]:border-b" : ""} max-[640px]:border-b max-[640px]:last:border-b-0`}
            >
              <span className="text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] leading-none text-[var(--accent)]">
                {layer.num}
              </span>
              <span className="text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                {layer.name}
              </span>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {layer.desc}
              </p>
              {layer.cta && (
                <Link
                  href={layer.cta.href}
                  className="mt-auto inline-flex w-fit items-center gap-1 pt-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                >
                  {layer.cta.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </OpsSection>

      {/* §03 — CONTACT FORM */}
      <OpsSection id="form">
        <OpsSectionHead
          num="§03"
          label="// FOUNDER_INBOX"
          headlineParts={["WRITE TO ", "FOUNDERS."]}
          toneMap={{ 1: "accent" }}
          sub={`Form submissions land at ${PRIMARY_INBOX} as a structured email. Your default mail client opens with a pre-filled draft — review, edit, send.`}
        />
        <div className="grid grid-cols-[1fr_320px] gap-10 max-[1020px]:grid-cols-1">
          <ContactForm />
          <aside className="flex flex-col gap-4">
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// HOW_THIS_WORKS"}
              </div>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">01</span>
                  <span>Fill in the fields below.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">02</span>
                  <span>
                    Submit opens your email client with a pre-filled draft to{" "}
                    <code className="text-[var(--accent)]">{PRIMARY_INBOX}</code>.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">03</span>
                  <span>
                    Review, edit, send. We reply from a real human address —
                    no <code>noreply@</code> addresses, ever.
                  </span>
                </li>
              </ol>
            </div>
            <div className="border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-5">
              <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// PRIVACY"}
              </div>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                The form does not POST to a server — it composes a mailto URL
                in your browser. Your message goes through your own email
                provider, not ours.
              </p>
            </div>
          </aside>
        </div>
      </OpsSection>

      {/* §04 — FINAL CTA */}
      <section
        id="cta"
        className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y)] max-[1020px]:py-[var(--cta-pad-y-lg)] max-[760px]:py-[var(--cta-pad-y-md)]"
        style={{ background: "var(--bg-cta-glow), var(--bg)" }}
      >
        <OpsContainer>
          <div className="grid grid-cols-[1.4fr_1fr] items-end gap-16 max-[880px]:grid-cols-1 max-[880px]:gap-9">
            <div>
              <div className="mb-5 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// EVERY_MESSAGE_GETS_READ"}
              </div>
              <h2 className="m-0 mb-7 max-w-[18ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                NO QUEUES. <span className="text-[var(--accent)]">REAL HUMANS.</span>
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                We&apos;re a small founder-led team in beta. Email lands on a
                terminal, not a help-desk app. No bots, no auto-replies — just
                a thread you can keep.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`mailto:${PRIMARY_INBOX}`}
                  className={opsButtonClassName("solid")}
                >
                  {`OPEN_${PRIMARY_INBOX}`}
                </Link>
                <Link href="/docs" className={opsButtonClassName("outline")}>
                  READ_THE_DOCS
                </Link>
                <Link href="/pricing" className={opsButtonClassName("ghost")}>
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// PRIMARY", v: PRIMARY_INBOX },
                { k: "// SUPPORT", v: "support@kensink.com" },
                { k: "// TRIAGE", v: "triage@kensink.com" },
                { k: "// LEGAL", v: "legal@kensink.com" },
                { k: "// PARTNERS", v: "partners@kensink.com" },
                { k: "// HOURS", v: "Mon–Fri · UTC+8" },
              ].map((row) => (
                <a
                  key={row.k}
                  href={
                    row.v.includes("@") ? `mailto:${row.v}` : undefined
                  }
                  className="flex justify-between gap-3 border-b border-[var(--line)] px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] transition-colors last:border-b-0 hover:text-[var(--accent)]"
                >
                  <span className="flex-none">{row.k}</span>
                  <b className="truncate font-[number:var(--weight-medium)] text-[var(--txt)] hover:text-[var(--accent)]">
                    {row.v}
                  </b>
                </a>
              ))}
            </div>
          </div>
        </OpsContainer>
      </section>
    </OpsPageShell>
  );
}

/**
 * Mailto-based contact form. Submits by composing a mailto URL with the
 * topic in the subject and the form fields rendered as a plaintext
 * body. The user's mail client opens with a pre-filled draft. No
 * server roundtrip; no captcha; no third-party form service.
 */
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<Topic>("Product question");
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState(false);

  const isReady =
    name.trim() !== "" && email.trim() !== "" && message.trim() !== "";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!isReady) return;
    const subject = `[${topic}] ${name} — Agenthost contact form`;
    const body = [
      `From: ${name} <${email}>`,
      company ? `Company: ${company}` : null,
      `Topic: ${topic}`,
      "",
      message,
      "",
      "—",
      "Sent via the Agenthost contact form (https://agenthost.kensink.com/contact)",
    ]
      .filter(Boolean)
      .join("\n");
    const url = `mailto:${PRIMARY_INBOX}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setOpened(true);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <FieldText
          id="contact-name"
          label="Name"
          value={name}
          onChange={setName}
          required
          placeholder="Maya Chen"
        />
        <FieldText
          id="contact-email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          required
          placeholder="you@example.com"
        />
      </div>
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
        <FieldText
          id="contact-company"
          label="Company"
          value={company}
          onChange={setCompany}
          placeholder="Optional · helps us route faster"
        />
        <div className="flex flex-col gap-2">
          <label
            htmlFor="contact-topic"
            className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]"
          >
            {"// TOPIC"}
          </label>
          <select
            id="contact-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value as Topic)}
            className="h-[44px] border border-[var(--line2)] bg-[var(--bg2)] px-3 text-[length:var(--font-size-tag)] text-[var(--txt)] focus:border-[var(--accent)] focus:outline-none"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-message"
          className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]"
        >
          {"// MESSAGE"}
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={7}
          placeholder="What are you working on? What's blocking? Be specific — links and repro steps welcome."
          className="resize-y border border-[var(--line2)] bg-[var(--bg2)] px-3 py-3 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt)] placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line2)] pt-5">
        <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
          {`// LANDS_AT ${PRIMARY_INBOX}`}
        </span>
        <button
          type="submit"
          disabled={!isReady}
          className={`inline-flex items-center justify-center gap-2 border px-5 py-3 text-[length:var(--font-size-label)] font-[number:var(--weight-medium)] uppercase tracking-[var(--tr-tag)] transition-colors duration-[var(--duration-fast)] ${
            isReady
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]"
              : "cursor-not-allowed border-[var(--line2)] bg-[var(--line)] text-[var(--dim)]"
          }`}
        >
          {opened ? (
            <>
              <Check className="h-3.5 w-3.5" />
              MAIL_CLIENT_OPENED
            </>
          ) : (
            <>
              <ArrowRight className="h-3.5 w-3.5" />
              OPEN MAIL DRAFT
            </>
          )}
        </button>
      </div>
      {opened && (
        <p className="text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
          Your mail client opened with a pre-filled draft. Review, edit, and
          send. If nothing happened, your browser may have blocked the
          handler — write to{" "}
          <a
            href={`mailto:${PRIMARY_INBOX}`}
            className="text-[var(--accent)] underline underline-offset-2"
          >
            {PRIMARY_INBOX}
          </a>{" "}
          directly.{" "}
          <Loader2 className="ml-1 inline h-3 w-3" />
        </p>
      )}
    </form>
  );
}

function FieldText({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "email";
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]"
      >
        {`// ${label.toUpperCase()}`}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        className="h-[44px] border border-[var(--line2)] bg-[var(--bg2)] px-3 text-[length:var(--font-size-tag)] text-[var(--txt)] placeholder:text-[var(--dim)] focus:border-[var(--accent)] focus:outline-none"
      />
    </div>
  );
}
