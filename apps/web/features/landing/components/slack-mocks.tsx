"use client";

import { type ReactNode } from "react";
import { cn } from "@multica/ui/lib/utils";

/**
 * Slack-flavored mock components rendered in the Ops design language.
 *
 * Everything is semantic Tailwind — no images. The visuals borrow Slack
 * conventions (channel header, threaded replies, Block Kit-style cards,
 * ephemeral notices) but render through the landing page's CSS tokens
 * so the surface stays coherent with the rest of the site.
 *
 * All marks are decorative; the canonical product UI lives in-app.
 */

export type Actor = {
  kind: "human" | "agent" | "bot";
  name: string;
  initials: string;
};

const HUMAN: Actor = { kind: "human", name: "Maya · eng", initials: "M" };
const AGENT_PYTHON: Actor = {
  kind: "agent",
  name: "Python-Agent",
  initials: "PY",
};
const AGENT_REVIEW: Actor = {
  kind: "agent",
  name: "Review-Agent",
  initials: "RV",
};
const BOT: Actor = { kind: "bot", name: "Agenthost", initials: "A" };

export const ACTORS = {
  human: HUMAN,
  python: AGENT_PYTHON,
  review: AGENT_REVIEW,
  bot: BOT,
};

export function ChannelHeader({
  channel = "agenthost-prod",
  members = "12",
}: {
  channel?: string;
  members?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--line2)] bg-[var(--bg2)] px-4 py-2.5">
      <div className="flex items-center gap-2 text-[length:var(--font-size-tag)] tracking-[var(--tr-label)] text-[var(--txt)]">
        <span className="text-[var(--dim)]">#</span>
        <b className="font-[number:var(--weight-medium)]">{channel}</b>
      </div>
      <div className="flex items-center gap-2 text-[length:var(--font-size-micro)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        <span
          aria-hidden="true"
          className="block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
        />
        <span>{members} ONLINE</span>
      </div>
    </div>
  );
}

export function Avatar({ actor }: { actor: Actor }) {
  const tone =
    actor.kind === "human"
      ? "border-[var(--line3)] bg-[var(--bg)] text-[var(--txt)]"
      : actor.kind === "agent"
        ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--bg))] text-[var(--accent)]"
        : "border-[var(--line3)] bg-[color-mix(in_srgb,var(--accent)_8%,var(--bg))] text-[var(--accent)]";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center border text-[length:var(--font-size-nano-sm)] font-[number:var(--weight-bold)] tracking-[0.04em]",
        tone,
      )}
    >
      {actor.initials}
    </span>
  );
}

export function MessageRow({
  actor,
  time,
  children,
  threaded = false,
}: {
  actor: Actor;
  time: string;
  children: ReactNode;
  threaded?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 px-4 py-3", threaded && "pl-9")}>
      <Avatar actor={actor} />
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-baseline gap-2">
          <b className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] text-[var(--txt)]">
            {actor.name}
          </b>
          {actor.kind === "agent" && (
            <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              APP
            </span>
          )}
          <span className="text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--dim)]">
            {time}
          </span>
        </div>
        <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline `@mention` styling. Slack's @-mentions are pill-shaped and
 * tinted — same convention here, scoped to accent so they read as
 * "this is the trigger" without imitating Slack's brand purple.
 */
export function Mention({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] px-1.5 py-px font-[number:var(--weight-medium)] text-[var(--accent)]">
      @{children}
    </span>
  );
}

export function ChatLink({ children }: { children: ReactNode }) {
  return (
    <span className="font-[number:var(--weight-medium)] text-[var(--accent)] underline decoration-[var(--accent)]/40 underline-offset-2">
      {children}
    </span>
  );
}

/**
 * Block Kit-style issue card. Slack renders bot replies as Block Kit
 * messages with title, fields, and action buttons; the mock keeps that
 * structure so the reader maps "this is what the bot will post" to the
 * actual product output.
 */
export function BlockKitCard({
  issueId,
  title,
  status,
  assignee,
  buttons,
  variant = "neutral",
}: {
  issueId: string;
  title: string;
  status: { label: string; tone: "open" | "in_progress" | "in_review" | "done" };
  assignee?: string;
  buttons?: { label: string; primary?: boolean }[];
  variant?: "neutral" | "accent";
}) {
  const statusTone: Record<typeof status.tone, string> = {
    open: "border-[var(--dim)] text-[var(--dim)]",
    in_progress: "border-[var(--warn)] text-[var(--warn)]",
    in_review: "border-[var(--accent2)] text-[var(--accent2)]",
    done: "border-[var(--accent)] text-[var(--accent)]",
  };
  return (
    <div
      className={cn(
        "mt-2 border-l-2 bg-[var(--bg)]",
        variant === "accent"
          ? "border-l-[var(--accent)]"
          : "border-l-[var(--line3)]",
      )}
    >
      <div className="flex flex-col gap-2 border-y border-r border-[var(--line2)] px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
            {issueId}
          </span>
          <span
            className={cn(
              "border px-1.5 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)]",
              statusTone[status.tone],
            )}
          >
            {status.label}
          </span>
        </div>
        <div className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] leading-[var(--lh-normal)] text-[var(--txt)]">
          {title}
        </div>
        {assignee && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--line)] pt-2 text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--dim)]">
            <span>
              ASSIGNEE{" "}
              <b className="ml-1 font-[number:var(--weight-medium)] text-[var(--txt)]">
                {assignee}
              </b>
            </span>
          </div>
        )}
        {buttons && buttons.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-2">
            {buttons.map((b) => (
              <span
                key={b.label}
                className={cn(
                  "inline-flex items-center border px-2.5 py-1 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)]",
                  b.primary
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]"
                    : "border-[var(--line2)] text-[var(--txt2)]",
                )}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Slack ephemeral message — visible only to one user. Used for the
 * agent picker, error notices, and the "Agenthost only listens to the
 * thread starter" hint. The bordered grey treatment + footer line is
 * the dead giveaway in real Slack.
 */
export function EphemeralNotice({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="ml-9 mr-4 my-2 border-l-2 border-[var(--line3)] bg-[var(--bg2)]">
      <div className="border-y border-r border-[var(--line2)] px-4 py-3">
        {title && (
          <div className="mb-1 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            {title}
          </div>
        )}
        <div className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)] text-[var(--txt2)]">
          {children}
        </div>
        <div className="mt-2 border-t border-[var(--line)] pt-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
          {"// ONLY VISIBLE TO YOU · AGENTHOST"}
        </div>
      </div>
    </div>
  );
}

export function AgentPickerMock() {
  return (
    <EphemeralNotice title="// PICK_AN_AGENT">
      Choose which agent runs this thread. You can change the default for{" "}
      <ChatLink>#agenthost-prod</ChatLink> in workspace settings.
      <div className="mt-3 flex flex-col gap-1.5">
        {[
          { name: "Python-Agent", desc: "claude · backend, tests, migrations" },
          { name: "Review-Agent", desc: "codex · diffs, code review, comments" },
          { name: "Docs-Agent", desc: "claude · readmes, ADRs, changelogs" },
        ].map((a, i) => (
          <div
            key={a.name}
            className={cn(
              "flex items-center justify-between gap-3 border bg-[var(--bg)] px-3 py-2",
              i === 0
                ? "border-[var(--accent)]"
                : "border-[var(--line2)]",
            )}
          >
            <div className="flex flex-col">
              <b className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] text-[var(--txt)]">
                {a.name}
              </b>
              <span className="text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--dim)]">
                {a.desc}
              </span>
            </div>
            {i === 0 && (
              <span className="border border-[var(--accent)] px-2 py-0.5 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                SELECT →
              </span>
            )}
          </div>
        ))}
      </div>
    </EphemeralNotice>
  );
}

/**
 * Slash command + autocomplete. `/agenthost` is the single registered
 * command; subcommands surface as autocomplete hints. The chip row
 * mimics Slack's hint affordance for slash subcommands.
 */
export function SlashCommandPopover({
  typed,
  hints,
}: {
  typed: string;
  hints: { sub: string; usage: string }[];
}) {
  return (
    <div className="border border-[var(--line2)] bg-[var(--bg2)]">
      <div className="flex items-center gap-2 border-b border-[var(--line2)] px-3 py-2 font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-tag)] text-[var(--txt)]">
        <span className="text-[var(--accent)]">{typed}</span>
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-3 w-px animate-pulse bg-[var(--accent)]"
        />
      </div>
      <ul className="m-0 list-none p-0">
        {hints.map((h, i) => (
          <li
            key={h.sub}
            className={cn(
              "flex flex-wrap items-baseline justify-between gap-2 px-3 py-2",
              i === 0
                ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
                : "border-t border-[var(--line)]",
            )}
          >
            <span className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-tag)] text-[var(--txt)]">
              <b className="font-[number:var(--weight-medium)] text-[var(--accent)]">
                /agenthost {h.sub}
              </b>
            </span>
            <span className="text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--dim)]">
              {h.usage}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Threaded reply count strip — Slack's "X replies" indicator under
 * a parent message. Functional in real Slack; decorative here.
 */
export function ThreadIndicator({ count = 4 }: { count?: number }) {
  return (
    <div className="ml-9 mb-2 mr-4 flex items-center gap-2 border-l-2 border-[var(--line)] pl-3 py-1 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
      <span>{count} REPLIES</span>
      <span className="text-[var(--dim)]">→</span>
    </div>
  );
}

export function ThreadFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden border border-[var(--line2)] bg-[var(--bg2)] [box-shadow:0_0_0_1px_var(--bg2)_inset]">
      {children}
    </div>
  );
}
