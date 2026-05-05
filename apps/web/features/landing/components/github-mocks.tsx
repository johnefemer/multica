"use client";

import { type ReactNode } from "react";
import { cn } from "@multica/ui/lib/utils";
import { GitHubMark } from "./shared";

/**
 * GitHub-flavored mock components rendered in the Ops design language.
 *
 * The shapes here mirror the real GitHub integration as it lands in
 * the product:
 *   - Issue cards carry `org/repo#number` provenance and an open/closed
 *     dot, matching the canonical view on github.com.
 *   - Board lanes show a small kanban with mirrored issues distributed
 *     across statuses, since the marketing thesis is "your GitHub
 *     issues, on an AI task board".
 *   - PR cards show CI status (green check) because workflow_run is one
 *     of the four webhook events we subscribe to.
 *
 * Everything is semantic Tailwind — no images. The Ops tokens keep the
 * page coherent with /slack, /pricing, /10x.
 */

export type IssueState = "open" | "closed" | "in_progress" | "in_review";

const STATE_DOT: Record<IssueState, string> = {
  open: "bg-[var(--accent)]",
  closed: "bg-[var(--dim)]",
  in_progress: "bg-[var(--warn)]",
  in_review: "bg-[var(--accent2)]",
};

const STATE_LABEL: Record<IssueState, string> = {
  open: "OPEN",
  closed: "CLOSED",
  in_progress: "IN PROGRESS",
  in_review: "IN REVIEW",
};

export function IssueCard({
  repo,
  number,
  title,
  labels,
  state = "open",
  assignee,
  className,
}: {
  repo: string;
  number: number;
  title: string;
  labels?: string[];
  state?: IssueState;
  assignee?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border border-[var(--line2)] bg-[var(--bg)] px-3 py-2.5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", STATE_DOT[state])}
        />
        <code className="font-[family-name:var(--font-mono-display)] text-[var(--dim2)]">
          {repo}#{number}
        </code>
      </div>
      <div className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] leading-[1.35] text-[var(--txt)]">
        {title}
      </div>
      {(labels?.length || assignee) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
          {labels?.map((l) => (
            <span
              key={l}
              className="inline-flex border border-[var(--line2)] px-1.5 py-px text-[length:var(--font-size-nano-sm)] tracking-[0.04em] text-[var(--dim)]"
            >
              {l}
            </span>
          ))}
          {assignee && (
            <span className="ml-auto inline-flex items-center gap-1 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
              <span
                aria-hidden="true"
                className="block h-3 w-3 border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_18%,var(--bg))] text-center text-[8px] font-bold leading-3"
              >
                {assignee.charAt(0)}
              </span>
              {assignee}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * One column in a kanban-style board. The header shows the lane name +
 * count; children are issue cards. The visual emphasis (active=true)
 * highlights the lane where the action is currently happening.
 */
export function BoardLane({
  name,
  count,
  active = false,
  children,
}: {
  name: string;
  count: number;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 border border-[var(--line2)] bg-[var(--bg2)] p-3",
        active && "border-[var(--accent)]",
      )}
    >
      <div className="flex items-baseline justify-between border-b border-[var(--line2)] pb-2">
        <span
          className={cn(
            "text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)]",
            active ? "text-[var(--accent)]" : "text-[var(--dim)]",
          )}
        >
          {name}
        </span>
        <span className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-nano-sm)] text-[var(--dim2)]">
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

export function BoardFrame({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto border border-[var(--line2)] bg-[var(--bg)]">
      <div className="min-w-[720px] border-b border-[var(--line2)] bg-[var(--bg2)] px-3 py-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        {"// AGENTHOST_BOARD · MIRROR_OF_GITHUB_ISSUES"}
      </div>
      <div className="grid min-w-[720px] grid-cols-4 gap-3 p-3">{children}</div>
    </div>
  );
}

/**
 * PR card matching what GitHub itself would show — branch name,
 * mergeable check, CI run status. The "workflow_run" badge is the
 * webhook event Agenthost subscribes to so CI state surfaces on the
 * issue card.
 */
export function PRCard({
  repo,
  number,
  title,
  branch,
  author,
  state = "open",
  ciState = "running",
}: {
  repo: string;
  number: number;
  title: string;
  branch: string;
  author: string;
  state?: "open" | "merged";
  ciState?: "running" | "passing" | "failing";
}) {
  const stateChip =
    state === "merged"
      ? "border-[var(--accent2)] text-[var(--accent2)]"
      : "border-[var(--accent)] text-[var(--accent)]";
  const ciChip =
    ciState === "passing"
      ? "border-[var(--accent)] text-[var(--accent)]"
      : ciState === "failing"
        ? "border-[var(--warn)] text-[var(--warn)]"
        : "border-[var(--dim)] text-[var(--dim)]";
  const ciLabel =
    ciState === "passing"
      ? "✓ CHECKS PASSING"
      : ciState === "failing"
        ? "× CHECKS FAILING"
        : "▸ CHECKS RUNNING";
  const stateLabel = state === "merged" ? "MERGED" : "OPEN";
  return (
    <div className="flex flex-col gap-2 border border-[var(--line2)] bg-[var(--bg)] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <code className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--accent)]">
          {repo}#{number}
        </code>
        <span
          className={cn(
            "border px-1.5 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)]",
            stateChip,
          )}
        >
          PR · {stateLabel}
        </span>
      </div>
      <div className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] leading-[1.35] text-[var(--txt)]">
        {title}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-2 text-[length:var(--font-size-nano-sm)] tracking-[0.02em] text-[var(--dim)]">
        <span>
          BRANCH{" "}
          <code className="font-[family-name:var(--font-mono-display)] text-[var(--txt2)]">
            {branch}
          </code>
        </span>
        <span>
          AUTHOR{" "}
          <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
            {author}
          </b>
        </span>
        <span className={cn("ml-auto border px-1.5", ciChip)}>{ciLabel}</span>
      </div>
    </div>
  );
}

/**
 * Repo picker mock for the install/binding step. Mirrors what the
 * settings UI would render after OAuth — a checklist of repos with
 * private/public marker, owner/name, and a SELECTED chip on bound rows.
 */
export function RepoPickerMock({
  repos,
}: {
  repos: { owner: string; name: string; private?: boolean; selected?: boolean }[];
}) {
  return (
    <div className="border border-[var(--line2)] bg-[var(--bg)]">
      <div className="flex items-center gap-2 border-b border-[var(--line2)] bg-[var(--bg2)] px-3 py-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        <GitHubMark className="size-3.5 text-[var(--txt2)]" />
        <span>{"// PICK_REPOS_TO_MIRROR"}</span>
      </div>
      <ul className="m-0 list-none p-0">
        {repos.map((r, i) => (
          <li
            key={`${r.owner}/${r.name}`}
            className={cn(
              "flex items-center justify-between gap-3 px-3 py-2.5",
              i < repos.length - 1 && "border-b border-[var(--line)]",
              r.selected && "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]",
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center border text-[8px] font-bold",
                  r.selected
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--bg)]"
                    : "border-[var(--line3)]",
                )}
              >
                {r.selected ? "✓" : ""}
              </span>
              <code className="truncate font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-tag)] text-[var(--txt)]">
                {r.owner}/{r.name}
              </code>
            </div>
            <div className="flex items-center gap-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {r.private && (
                <span className="border border-[var(--line2)] px-1.5">
                  PRIVATE
                </span>
              )}
              {r.selected && (
                <span className="border border-[var(--accent)] px-1.5 text-[var(--accent)]">
                  WEBHOOK_REGISTERED
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Webhook event ticker. The marketing point: sync is push-based, not
 * polled — every event we subscribe to in `RegisterWebhook` shows up
 * here as a ticker line so the reader can map "this is real-time".
 */
export function WebhookTicker({
  events,
}: {
  events: { time: string; event: string; detail: string }[];
}) {
  return (
    <div className="border border-[var(--line2)] bg-[var(--bg)] font-[family-name:var(--font-mono-display)]">
      <div className="border-b border-[var(--line2)] bg-[var(--bg2)] px-3 py-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
        {"// INBOUND · /webhooks/github · HMAC_SHA256_VERIFIED"}
      </div>
      <ul className="m-0 list-none p-0">
        {events.map((e, i) => (
          <li
            key={i}
            className={cn(
              "flex flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-[length:var(--font-size-nano-sm)]",
              i < events.length - 1 && "border-b border-[var(--line)]",
            )}
          >
            <span className="text-[var(--dim2)]">{e.time}</span>
            <span className="text-[var(--accent)]">{e.event}</span>
            <span className="text-[var(--txt2)]">{e.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export { STATE_LABEL };
