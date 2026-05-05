"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { cn } from "@multica/ui/lib/utils";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";

/**
 * /contact — public inquiry surface.
 *
 * Form submissions POST to /api/contact (Resend-backed, IP-rate-limited,
 * honeypot-protected on the server). All visible email addresses use the
 * <ProtectedEmail> component, which splits user / domain across separate
 * text nodes and exposes a click-to-mailto handler — simple regex crawlers
 * scraping the rendered HTML for `[\w.]+@[\w.]+` won't reassemble them.
 */

const ENDPOINT = "/api/contact";

type EmailAddress = { user: string; domain: string };

const PRIMARY_INBOX: EmailAddress = { user: "agenthost", domain: "kensink.com" };

const DIRECT_LINES: {
  email: EmailAddress;
  label: string;
  purpose: string;
  notes: string;
}[] = [
  {
    email: { user: "support", domain: "kensink.com" },
    label: "// SUPPORT",
    purpose: "Product help, bugs, account issues",
    notes: "Median response · 8 business hours · Mon–Fri",
  },
  {
    email: { user: "triage", domain: "kensink.com" },
    label: "// TRIAGE",
    purpose: "Incidents, P0 outages, urgent regressions",
    notes: "On-call rotation · best-effort during beta",
  },
  {
    email: { user: "legal", domain: "kensink.com" },
    label: "// LEGAL",
    purpose: "Compliance, DPA, contracts, security review",
    notes: "Median response · 2 business days",
  },
  {
    email: { user: "partners", domain: "kensink.com" },
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
  badge?: string;
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
    desc: "Live system status for the control plane and runtime registries — and an email subscription for incident updates.",
    badge: "// COMING_SOON",
  },
  {
    num: "03",
    name: "EMAIL_TIER",
    desc: "Direct inboxes (support / triage / legal / partners) — see the table above. We tag and assign within the hour during business days.",
  },
  {
    num: "04",
    name: "FOUNDER_DIRECT",
    desc: "Use the form below — it lands directly in our shared founder inbox, watched by humans, no triage queue in between.",
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
            FOUNDER_INBOX
          </span>
        </div>

        <div className="grid grid-cols-[1.4fr_minmax(0,1fr)] gap-12 max-[1180px]:grid-cols-1 max-[1180px]:gap-10">
          <div>
            <h1 className="m-0 mb-6 sm:mb-8 [overflow-wrap:anywhere] text-[length:var(--font-size-hero-lg)] font-[number:var(--weight-bold)] uppercase leading-[0.98] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1280px]:text-[length:var(--font-size-hero-md)] max-[760px]:text-[length:var(--font-size-hero-sm)]">
              <span className="text-[var(--accent)]">SAY HELLO.</span>
              <br />
              WE READ EVERY EMAIL.
            </h1>
            <p className="m-0 mb-9 max-w-[60ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              Pick one of the named inboxes below or use the form to reach the
              shared founder inbox.{" "}
              <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
                Real humans on the other end
              </b>{" "}
              — no auto-replies, no ticket numbers, no chatbots.
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-[10px]">
              <Link href="#form" className={opsButtonClassName("solid")}>
                WRITE TO US ↓
              </Link>
              <ProtectedEmailLink
                email={PRIMARY_INBOX}
                className={opsButtonClassName("ghost")}
              >
                MAILTO_FOUNDER_INBOX
              </ProtectedEmailLink>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// CONTACT_AT_A_GLANCE"}
              </div>
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                <GlanceRow label="PRIMARY">
                  <ProtectedEmail email={PRIMARY_INBOX} />
                </GlanceRow>
                <GlanceRow label="RESPONSE">
                  &lt;4h weekdays · best-effort weekends
                </GlanceRow>
                <GlanceRow label="HOURS">
                  Mon–Fri · 9am–6pm ET (US Eastern)
                </GlanceRow>
                <GlanceRow label="INCIDENTS">
                  <ProtectedEmail
                    email={{ user: "triage", domain: "kensink.com" }}
                  />
                </GlanceRow>
                <GlanceRow label="FORMAT">plain text · no portals</GlanceRow>
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
          headlineParts={["FOUR DIRECT LINES. ", "FOUR HUMANS."]}
          toneMap={{ 1: "accent" }}
          sub="Each address routes to a small, watched team. Choose the right one and you skip a triage hop."
        />
        <div className="grid grid-cols-2 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {DIRECT_LINES.map((line, i) => (
            <ProtectedEmailLink
              key={`${line.email.user}-${line.email.domain}`}
              email={line.email}
              className={`group relative flex flex-col gap-3 bg-[var(--bg2)] p-7 transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--bg2))] ${i % 2 === 0 ? "border-r border-[var(--line2)] max-[880px]:border-r-0" : ""} ${i < DIRECT_LINES.length - 2 ? "border-b border-[var(--line2)]" : ""} max-[880px]:border-b max-[880px]:last:border-b-0`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                  {line.label}
                </span>
                <Mail className="h-3.5 w-3.5 text-[var(--dim)] transition-colors group-hover:text-[var(--accent)]" />
              </div>
              <span className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-h5)] font-[number:var(--weight-medium)] tracking-[0.02em] text-[var(--txt)] transition-colors group-hover:text-[var(--accent)]">
                <ProtectedEmail email={line.email} />
              </span>
              <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {line.purpose}
              </p>
              <div className="mt-auto pt-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {`// ${line.notes}`}
              </div>
            </ProtectedEmailLink>
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
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] leading-none text-[var(--accent)]">
                  {layer.num}
                </span>
                {layer.badge && (
                  <span className="border border-[var(--dim)] px-1.5 py-0.5 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                    {layer.badge}
                  </span>
                )}
              </div>
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
          headlineParts={["WRITE TO US."]}
          toneMap={{}}
          sub="Replies might take a beat — every email gets read by a real human first so the response actually fits your context. No auto-reply, no triage queue."
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
                  <span>Fill in the fields and submit.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">02</span>
                  <span>
                    Your message lands in our shared founder inbox within
                    seconds.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">03</span>
                  <span>
                    A human reads it and replies from a real address — no{" "}
                    <code>noreply@</code>, ever.
                  </span>
                </li>
              </ol>
            </div>
            <div className="border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-5">
              <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// PRIVACY"}
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-px flex-none text-[11px] text-[var(--accent)]"
                  >
                    ▸
                  </span>
                  <span>
                    We don&apos;t share your email or any submitted data with
                    third parties.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-px flex-none text-[11px] text-[var(--accent)]"
                  >
                    ▸
                  </span>
                  <span>
                    We use what you send only to reply and to keep a record of
                    the thread.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span
                    aria-hidden="true"
                    className="mt-px flex-none text-[11px] text-[var(--accent)]"
                  >
                    ▸
                  </span>
                  <span>
                    No analytics pixels, no ad networks, no marketing-list
                    enrollment.
                  </span>
                </li>
              </ul>
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
                <ProtectedEmailLink
                  email={PRIMARY_INBOX}
                  className={opsButtonClassName("solid")}
                >
                  OPEN_FOUNDER_INBOX
                </ProtectedEmailLink>
                <Link href="/docs" className={opsButtonClassName("outline")}>
                  READ_THE_DOCS
                </Link>
                <Link href="/pricing" className={opsButtonClassName("ghost")}>
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {DIRECT_LINES.map((line) => (
                <div
                  key={`cta-${line.email.user}`}
                  className="flex justify-between gap-3 border-b border-[var(--line)] px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] last:border-b-0"
                >
                  <span className="flex-none">{line.label}</span>
                  <ProtectedEmailLink
                    email={line.email}
                    className="truncate font-[number:var(--weight-medium)] text-[var(--txt)] transition-colors hover:text-[var(--accent)]"
                  >
                    <ProtectedEmail email={line.email} />
                  </ProtectedEmailLink>
                </div>
              ))}
              <div className="flex justify-between gap-3 px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)]">
                <span className="flex-none">{"// HOURS"}</span>
                <b className="truncate font-[number:var(--weight-medium)] text-[var(--txt)]">
                  Mon–Fri · 9am–6pm ET
                </b>
              </div>
            </div>
          </div>
        </OpsContainer>
      </section>
    </OpsPageShell>
  );
}

function GlanceRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--line)] pb-2 last:border-b-0 last:pb-0 text-[length:var(--font-size-tag)]">
      <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        {`// ${label}`}
      </span>
      <span className="text-[var(--txt)]">{children}</span>
    </li>
  );
}

/**
 * Renders an email address split across separate text nodes so naive
 * `[\w.]+@[\w.]+` regex crawlers reading the rendered HTML don't reassemble
 * it. The `@` glyph is emitted via a Unicode escape; the `user` and `domain`
 * arrive as separate sibling spans. `aria-label` carries the readable form
 * for screen readers since the visible glyph isn't selectable as one
 * contiguous token.
 *
 * Visually identical to plain `user@domain` text.
 */
function ProtectedEmail({
  email,
  className,
}: {
  email: EmailAddress;
  className?: string;
}) {
  return (
    <span
      className={className}
      aria-label={`${email.user} at ${email.domain}`}
    >
      <span>{email.user}</span>
      <span aria-hidden="true">{"@"}</span>
      <span>{email.domain}</span>
    </span>
  );
}

/**
 * Click-to-mailto wrapper. Click composes the `mailto:` URL at runtime —
 * the `href` attribute is intentionally `#` so the address never appears
 * as a string in the static HTML for crawlers to harvest.
 */
function ProtectedEmailLink({
  email,
  className,
  children,
}: {
  email: EmailAddress;
  className?: string;
  children: React.ReactNode;
}) {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const addr = `${email.user}@${email.domain}`;
    window.location.href = `mailto:${addr}`;
  };
  return (
    <a
      href="#"
      onClick={onClick}
      className={className}
      aria-label={`Email ${email.user} at ${email.domain}`}
    >
      {children}
    </a>
  );
}

type SubmitStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/**
 * Form submits to /api/contact (Resend-backed, IP rate-limited, honeypot-
 * protected on the server). The `hp` field is hidden from sighted users;
 * bots auto-filling every field will populate it and get a silent 200.
 */
function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<Topic>("Product question");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState(""); // honeypot
  const [status, setStatus] = useState<SubmitStatus>({ kind: "idle" });

  const isReady =
    name.trim().length >= 2 &&
    email.trim() !== "" &&
    message.trim().length >= 10 &&
    status.kind !== "submitting";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isReady) return;
    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company: company.trim(),
          topic,
          message: message.trim(),
          hp,
        }),
      });
      if (res.status === 429) {
        setStatus({
          kind: "error",
          message:
            "You've sent a few in a row — please give it an hour and try again.",
        });
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setStatus({
          kind: "error",
          message:
            data.error ??
            "Something went wrong sending your message. Please try again.",
        });
        return;
      }
      setStatus({ kind: "success" });
      setName("");
      setEmail("");
      setCompany("");
      setTopic("Product question");
      setMessage("");
    } catch {
      setStatus({
        kind: "error",
        message: "Network error — your message wasn't sent. Please try again.",
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
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
      {/*
        Honeypot — visually hidden from sighted users, ignored by screen
        readers via aria-hidden + tabIndex=-1. Real users never type into
        it; bots that auto-fill every field do, and the server silently
        rejects those submissions.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor="contact-hp">Leave this field empty</label>
        <input
          id="contact-hp"
          name="hp"
          type="text"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line2)] pt-5">
        <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
          {"// LANDS_IN_SHARED_FOUNDER_INBOX"}
        </span>
        <button
          type="submit"
          disabled={!isReady}
          className={cn(
            "inline-flex items-center justify-center gap-2 border px-5 py-3 text-[length:var(--font-size-label)] font-[number:var(--weight-medium)] uppercase tracking-[var(--tr-tag)] transition-colors duration-[var(--duration-fast)]",
            isReady
              ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)] hover:bg-[var(--accent-hover)]"
              : "cursor-not-allowed border-[var(--line2)] bg-[var(--line)] text-[var(--dim)]",
          )}
        >
          {status.kind === "submitting" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {status.kind === "success" && <Check className="h-3.5 w-3.5" />}
          {status.kind === "idle" && <ArrowRight className="h-3.5 w-3.5" />}
          {status.kind === "error" && <ArrowRight className="h-3.5 w-3.5" />}
          {status.kind === "submitting"
            ? "SENDING…"
            : status.kind === "success"
              ? "SENT — WE'LL REPLY SOON"
              : "SEND MESSAGE"}
        </button>
      </div>
      {status.kind === "success" && (
        <p className="border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] px-3 py-2 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt)]">
          Thanks — your message landed. A human will reply within a few
          business hours during the week.
        </p>
      )}
      {status.kind === "error" && (
        <p className="border-l-2 border-[var(--pop)] bg-[color-mix(in_srgb,var(--pop)_5%,var(--bg2))] px-3 py-2 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt)]">
          {status.message}
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
