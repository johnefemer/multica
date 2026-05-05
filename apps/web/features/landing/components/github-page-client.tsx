"use client";

import Link from "next/link";
import { useAuthStore } from "@multica/core/auth";
import { OpsPageShell } from "./ops/ops-page-shell";
import {
  OpsContainer,
  OpsSection,
  OpsSectionHead,
  opsButtonClassName,
} from "./ops/ops-primitives";
import {
  BoardFrame,
  BoardLane,
  IssueCard,
  PRCard,
  RepoPickerMock,
  WebhookTicker,
} from "./github-mocks";

/**
 * Marketing page for the GitHub ↔ Agenthost integration.
 *
 * The thesis the page argues — and the only one consistent with the
 * actual integration in `server/internal/integration/github/` — is:
 *
 *     GitHub stays canonical. Agenthost mirrors issues onto an
 *     AI-native task board so agents can pick them up. PRs land in
 *     the real repo via the agent's runtime, not via the OAuth token.
 *
 * Section order mirrors /slack so the two pages read as a series:
 * hero → shift → live flow → use cases → install → trust → source-of-
 * truth → faq → cta. Mocks come from `./github-mocks`.
 */
export function GitHubPageClient() {
  const user = useAuthStore((s) => s.user);
  const installHref = user ? "/" : "/login?next=/integrations";
  const docsHref = "/docs/github";

  return (
    <OpsPageShell>
      {/* §00 — HERO */}
      <OpsSection id="hero">
        <div className="mb-9 flex flex-wrap items-center gap-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-label)] text-[var(--accent)] before:content-['//'] before:text-[var(--dim)]">
          <span>INTEGRATION</span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            GITHUB
          </span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            SOURCE-OF-TRUTH
          </span>
        </div>

        <div className="grid grid-cols-[1.5fr_minmax(0,1fr)] gap-10 max-[1180px]:grid-cols-1 max-[1180px]:gap-10">
          <div>
            <h1 className="m-0 mb-6 sm:mb-8 [overflow-wrap:anywhere] text-[length:var(--font-size-hero-lg)] font-[number:var(--weight-bold)] uppercase leading-[0.98] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1280px]:text-[length:var(--font-size-hero-md)] max-[760px]:text-[length:var(--font-size-hero-sm)]">
              GITHUB ISSUES IN.
              <br />
              <span className="text-[var(--accent)]">SHIPPED PRS</span>{" "}
              <span className="text-[var(--dim2)]">OUT.</span>
            </h1>
            <p className="m-0 mb-9 max-w-[58ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              Connect a repo. Every open issue mirrors onto your Agenthost
              board within seconds. Assign one to an agent — it works in its
              runtime,{" "}
              <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
                opens a real PR back into your repo
              </b>
              , closes the loop.{" "}
              <span className="text-[var(--accent)]">
                GitHub stays canonical. We just put a fleet on the queue.
              </span>
            </p>
            <div className="mb-9 flex flex-wrap items-center gap-[10px]">
              <Link href={installHref} className={opsButtonClassName("solid")}>
                CONNECT YOUR REPO
              </Link>
              <Link href="#flow" className={opsButtonClassName("ghost")}>
                SEE_IT_LIVE ↓
              </Link>
              <span className="ml-[6px] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
                FREE · NO MIGRATION
              </span>
            </div>
            <div className="grid grid-cols-3 border border-[var(--line2)] max-[760px]:grid-cols-1">
              {[
                { k: "// SCOPE", v: "repo · admin:repo_hook" },
                { k: "// WEBHOOKS", v: "issues · PRs · workflow_run" },
                { k: "// SYNC", v: "real-time · bi-directional" },
              ].map((cell, i) => (
                <div
                  key={cell.k}
                  className={`px-5 py-[18px] ${i < 2 ? "border-r border-[var(--line2)] max-[760px]:border-r-0 max-[760px]:border-b" : ""}`}
                >
                  <div className="mb-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                    {cell.k}
                  </div>
                  <div className="text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] text-[var(--txt)]">
                    {cell.v}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero side mock — a focused 2-lane snapshot anchored on the
              same issue moving from Triage → In Progress with an agent
              assigned. Two lanes (instead of four) keeps the column narrow
              enough that the H1 on the left doesn't get squeezed into
              one-word-per-line. */}
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden border border-[var(--line2)] bg-[var(--bg)]">
              <div className="border-b border-[var(--line2)] bg-[var(--bg2)] px-3 py-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {"// AGENTHOST_BOARD · MIRROR_OF_GITHUB_ISSUES"}
              </div>
              <div className="grid grid-cols-2 gap-3 p-3">
                <BoardLane name="// TRIAGE" count={3}>
                  <IssueCard
                    repo="multica-ai/api"
                    number={482}
                    title="API 500 on null user_id in billing/checkout"
                    labels={["bug"]}
                  />
                  <IssueCard
                    repo="multica-ai/api"
                    number={486}
                    title="Add idempotency key on POST /charges"
                    labels={["enhancement"]}
                  />
                </BoardLane>
                <BoardLane name="// IN PROGRESS" count={1} active>
                  <IssueCard
                    repo="multica-ai/api"
                    number={482}
                    title="API 500 on null user_id in billing/checkout"
                    labels={["bug"]}
                    state="in_progress"
                    assignee="Python-Agent"
                  />
                </BoardLane>
              </div>
            </div>
            <p className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {"// CARDS COME FROM GITHUB · STATE STAYS IN SYNC"}
            </p>
          </div>
        </div>
      </OpsSection>

      {/* §01 — THE SHIFT */}
      <OpsSection id="shift">
        <OpsSectionHead
          num="§01"
          label="// THE_SHIFT"
          headlineParts={[
            "STOP MIGRATING. ",
            "MIRROR.",
          ]}
          toneMap={{ 1: "accent" }}
          sub="Most issue trackers ask you to migrate off GitHub. Agenthost adds a layer on top — your issues stay where they are, your team stays where they are, and an agent fleet starts working the queue."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            {
              tag: "// BEFORE",
              tone: "dim2",
              name: "TWO BACKLOGS",
              desc: "Issues sit in GitHub, never picked up. Agents live in another tool. Someone copy-pastes context to dispatch work — and the fix never makes it back onto the issue.",
            },
            {
              tag: "// THE BRIDGE",
              tone: "accent2",
              name: "ONE REPO, ONE BOARD",
              desc: "Connect a repo. Open issues import in seconds. A signed webhook (HMAC-SHA256) keeps both sides in sync. issues, pull_request, and workflow_run events flow inbound.",
            },
            {
              tag: "// AFTER",
              tone: "accent",
              name: "GITHUB STAYS CANONICAL",
              desc: "Your team works the same board your agents do. PRs land in the real repo. Disconnect any time — your GitHub is untouched. No vendor lock-in, no second source of truth.",
            },
          ].map((s, i) => {
            const TONE_TEXT: Record<string, string> = {
              dim2: "text-[var(--dim2)]",
              accent: "text-[var(--accent)]",
              accent2: "text-[var(--accent2)]",
            };
            const TONE_BAR: Record<string, string> = {
              dim2: "bg-[var(--dim2)]",
              accent: "bg-[var(--accent)]",
              accent2: "bg-[var(--accent2)]",
            };
            return (
              <div
                key={s.tag}
                className={`relative flex flex-col gap-3 bg-[var(--bg2)] p-7 ${
                  i < 2
                    ? "border-r border-[var(--line2)] max-[880px]:border-r-0 max-[880px]:border-b"
                    : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute left-0 top-0 h-full w-[2px] ${TONE_BAR[s.tone]}`}
                />
                <div
                  className={`text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] ${TONE_TEXT[s.tone]}`}
                >
                  {s.tag}
                </div>
                <div className="text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] uppercase leading-[1.15] tracking-[var(--tr-headline)] text-[var(--txt)]">
                  {s.name}
                </div>
                <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                  {s.desc}
                </p>
              </div>
            );
          })}
        </div>
      </OpsSection>

      {/* §02 — LIVE FLOW: webhook ticker + board + PR card */}
      <OpsSection id="flow">
        <OpsSectionHead
          num="§02"
          label="// LIVE_FLOW"
          headlineParts={["ONE ISSUE, ", "FROM FILED TO MERGED."]}
          toneMap={{ 1: "accent" }}
          sub="A real flow, end to end. Every event you see here corresponds to a webhook Agenthost subscribes to — no polling, no stale state."
        />
        <div className="grid grid-cols-[1fr_360px] gap-8 max-[1020px]:grid-cols-1">
          <div className="flex flex-col gap-4">
            <WebhookTicker
              events={[
                {
                  time: "10:12:04",
                  event: "issues.opened",
                  detail: "multica-ai/api#482 · API 500 on null user_id",
                },
                {
                  time: "10:12:05",
                  event: "→ mirrored",
                  detail: "imported as MCA-482 · status=triage",
                },
                {
                  time: "10:14:31",
                  event: "→ assigned",
                  detail: "Python-Agent · status=in_progress",
                },
                {
                  time: "10:18:09",
                  event: "pull_request.opened",
                  detail:
                    "multica-ai/api#491 · fix(checkout): guard null user_id",
                },
                {
                  time: "10:18:42",
                  event: "workflow_run.completed",
                  detail: "ci.yml · success · 38s",
                },
                {
                  time: "10:21:55",
                  event: "pull_request.closed",
                  detail: "merged · issues#482 → closed",
                },
              ]}
            />
            <PRCard
              repo="multica-ai/api"
              number={491}
              title="fix(checkout): guard against null user_id before price lookup"
              branch="fix/null-user-id"
              author="Python-Agent · req: Maya"
              state="open"
              ciState="passing"
            />
          </div>

          <aside className="flex flex-col gap-4">
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-6">
              <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// WHAT'S HAPPENING"}
              </div>
              <ol className="m-0 flex list-none flex-col gap-4 p-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                <li className="flex gap-3">
                  <span className="shrink-0 font-[number:var(--weight-bold)] text-[var(--accent)]">
                    01
                  </span>
                  <span>
                    GitHub fires <code>issues.opened</code>; Agenthost
                    verifies the HMAC signature and creates a mirrored issue
                    bound to the source repo.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 font-[number:var(--weight-bold)] text-[var(--accent)]">
                    02
                  </span>
                  <span>
                    The mirrored issue is a first-class Agenthost issue —
                    same kanban, same assignment model, same agent dispatch.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 font-[number:var(--weight-bold)] text-[var(--accent)]">
                    03
                  </span>
                  <span>
                    Agent runs in its runtime, opens a PR{" "}
                    <em>in your real repo</em>. The PR lands via the
                    runtime&apos;s git config — not via the integration token.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 font-[number:var(--weight-bold)] text-[var(--accent)]">
                    04
                  </span>
                  <span>
                    <code>workflow_run.completed</code> +{" "}
                    <code>pull_request.closed</code> flow back inbound; the
                    mirrored issue closes when the PR merges.
                  </span>
                </li>
              </ol>
            </div>
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-6">
              <div className="mb-3 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {"// WEBHOOK EVENTS WE LISTEN TO"}
              </div>
              <pre className="m-0 overflow-x-auto whitespace-pre font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">{`issues          opened, edited, closed, reopened
pull_request    opened, closed (merged)
workflow_run    completed (CI status)
push            commits to default branch`}</pre>
            </div>
          </aside>
        </div>
      </OpsSection>

      {/* §03 — USE CASES (3, sharp) */}
      <OpsSection id="use-cases">
        <OpsSectionHead
          num="§03"
          label="// FLOWS"
          headlineParts={["THREE FLOWS, ", "ZERO MIGRATION."]}
          toneMap={{ 1: "accent" }}
          sub="Each one solves a real problem teams have today with GitHub-only workflows. None require leaving GitHub."
        />
        <div className="grid gap-0 border border-[var(--line2)]">
          <UseCaseRow
            tag="// MIRROR"
            num="01"
            title="Connect a repo. Every open issue is on your board."
            body="Install grants the repo scope. Agenthost paginates /repos/{owner}/{repo}/issues, registers a webhook for issues + pull_request + workflow_run, and your board populates within seconds. Edits flow both ways. Disconnect at any time — the integration removes the webhook and your GitHub stays untouched."
            mock={
              <RepoPickerMock
                repos={[
                  {
                    owner: "multica-ai",
                    name: "api",
                    private: true,
                    selected: true,
                  },
                  {
                    owner: "multica-ai",
                    name: "web",
                    selected: true,
                  },
                  {
                    owner: "multica-ai",
                    name: "docs",
                  },
                  {
                    owner: "kensink-labs",
                    name: "agenthost-runtime",
                    private: true,
                    selected: true,
                  },
                ]}
              />
            }
          />
          <UseCaseRow
            tag="// DISPATCH"
            num="02"
            title="Assign a GitHub issue to an agent. Get a real PR back."
            body="Mirrored issues are first-class Agenthost issues — drag one to an agent's lane and the agent's runtime claims it. The agent works in its sandbox, opens a PR against the source repo with its own git identity (configurable per-agent), and CI runs as it would for any human PR. Reviewable, mergeable, cooperatable."
            mock={
              <PRCard
                repo="multica-ai/api"
                number={491}
                title="fix(checkout): guard null user_id before price lookup"
                branch="fix/null-user-id"
                author="Python-Agent"
                ciState="passing"
              />
            }
          />
          <UseCaseRow
            tag="// CROSS-REPO"
            num="03"
            title="One workspace, many repos, one board."
            body="Connect every repo your team owns. Each registers its own webhook; cards on the board show org/repo#number provenance. Filter by repo, label, milestone, or assignee. Lets one team manage a polyrepo backlog without flipping browser tabs."
            mock={
              <BoardFrame>
                <BoardLane name="// TODO" count={3}>
                  <IssueCard
                    repo="ml-ai/api"
                    number={221}
                    title="Add /v2/charges endpoint"
                  />
                  <IssueCard
                    repo="ml-ai/web"
                    number={89}
                    title="Settings page redesign"
                  />
                </BoardLane>
                <BoardLane name="// IN PROGRESS" count={2} active>
                  <IssueCard
                    repo="ml-ai/runtime"
                    number={42}
                    title="Daemon: 3s poll throttling"
                    state="in_progress"
                    assignee="Python-Agent"
                  />
                  <IssueCard
                    repo="ml-ai/docs"
                    number={17}
                    title="Add OAuth setup guide"
                    state="in_progress"
                    assignee="Docs-Agent"
                  />
                </BoardLane>
                <BoardLane name="// REVIEW" count={1}>
                  <IssueCard
                    repo="ml-ai/api"
                    number={482}
                    title="Null-guard checkout"
                    state="in_review"
                  />
                </BoardLane>
                <BoardLane name="// DONE" count={6}>
                  <IssueCard
                    repo="ml-ai/web"
                    number={87}
                    title="Empty-state for /agents"
                    state="closed"
                  />
                </BoardLane>
              </BoardFrame>
            }
          />
        </div>
      </OpsSection>

      {/* §04 — INSTALL */}
      <OpsSection id="install">
        <OpsSectionHead
          num="§04"
          label="// INSTALL"
          headlineParts={["THREE STEPS. ", "UNDER FIVE MINUTES."]}
          toneMap={{ 1: "accent" }}
          sub="OAuth v2, signed webhooks, no proxy to set up. Workspace admins install once; the rest of the team picks up the board."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            {
              num: "01",
              title: "AUTHORIZE",
              body: "Click Install. GitHub OAuth grants repo (issues + PRs + code) plus admin:repo_hook so Agenthost can register webhooks programmatically.",
              footer: "// scopes: repo · read:org · read:user · admin:repo_hook",
            },
            {
              num: "02",
              title: "PICK REPOS",
              body: "Choose repos to mirror. For each, pick the Agenthost project to map to. Webhook registers with an HMAC secret on each picked repo.",
              footer: "// 1 repo ↔ 1 project · webhook auto-registered",
            },
            {
              num: "03",
              title: "ISSUES POPULATE",
              body: "Open issues import in seconds via paginated GitHub REST. New events stream in as they happen. Your team starts working — agents start picking up.",
              footer: "// real-time after the initial import",
            },
          ].map((s, i) => (
            <div
              key={s.num}
              className={`flex flex-col gap-3 bg-[var(--bg2)] p-7 ${
                i < 2
                  ? "border-r border-[var(--line2)] max-[880px]:border-r-0 max-[880px]:border-b"
                  : ""
              }`}
            >
              <div className="flex items-baseline gap-3">
                <span className="text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] leading-none text-[var(--accent)]">
                  {s.num}
                </span>
                <span className="text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                  {s.title}
                </span>
              </div>
              <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {s.body}
              </p>
              <div className="mt-auto pt-3 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {s.footer}
              </div>
            </div>
          ))}
        </div>
      </OpsSection>

      {/* §05 — TRUST */}
      <OpsSection id="trust">
        <OpsSectionHead
          num="§05"
          label="// TRUST"
          headlineParts={["ONLY THE SCOPES ", "YOU EXPECT."]}
          toneMap={{ 1: "accent" }}
          sub="Webhooks are HMAC-SHA256 signed and verified on every inbound request. Agent PRs come from the runtime's own git identity — never from the integration token."
        />
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-[880px]:grid-cols-1">
          <div className="flex flex-col border border-[var(--line2)]">
            <div className="border-b border-[var(--line2)] bg-[var(--bg2)] px-5 py-3 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {"// OAUTH SCOPES REQUESTED AT INSTALL"}
            </div>
            {[
              {
                k: "repo",
                v: "read issues, PRs, and code on selected repos (write only when you explicitly dispatch)",
              },
              {
                k: "read:org",
                v: "list orgs you can pick repos from in the binding picker",
              },
              {
                k: "read:user",
                v: "your GitHub login + avatar for attribution",
              },
              {
                k: "admin:repo_hook",
                v: "register and remove webhooks on the repos you select — never on others",
              },
            ].map((row, i, arr) => (
              <div
                key={row.k}
                className={`grid grid-cols-[200px_1fr] gap-4 px-5 py-3 ${i < arr.length - 1 ? "border-b border-[var(--line)]" : ""}`}
              >
                <code className="font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-tag)] tracking-[0.02em] text-[var(--accent)]">
                  {row.k}
                </code>
                <span className="text-[length:var(--font-size-tag)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                  {row.v}
                </span>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-4">
            <div className="border-l-2 border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_5%,var(--bg2))] p-5">
              <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// WHAT WE DON'T DO"}
              </div>
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {[
                  "Train models on your code",
                  "Mirror repos you didn't explicitly select",
                  "Push commits using the integration token — agent PRs use the runtime's git config",
                  "Touch your GitHub data after disconnect — webhooks deregister, mirrored issues become read-only snapshots",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-px flex-none text-[11px] text-[var(--accent)]"
                    >
                      ▸
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {"// WEBHOOK INTEGRITY"}
              </div>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                Every inbound webhook is verified against a per-repo HMAC-SHA256
                secret. Mismatched signatures are rejected before any handler
                runs — no DB writes, no work queued. Source:{" "}
                <code className="text-[var(--accent)]">
                  VerifyWebhook
                </code>{" "}
                in <code>server/internal/integration/github/provider.go</code>.
              </p>
            </div>
          </div>
        </div>
      </OpsSection>

      {/* §06 — SOURCE OF TRUTH */}
      <OpsSection id="source-of-truth">
        <OpsSectionHead
          num="§06"
          label="// SOURCE_OF_TRUTH"
          headlineParts={["GITHUB STAYS ", "CANONICAL."]}
          toneMap={{ 1: "accent" }}
          sub="The strongest argument against most issue trackers is data lock-in. Agenthost flips it: your data was always GitHub's, and stays GitHub's. We add a layer; we don't replace one."
        />
        <div className="grid grid-cols-2 gap-0 border border-[var(--line2)] max-[760px]:grid-cols-1">
          {[
            {
              k: "// CANONICAL",
              v: "Issue body, comments, and state always reflect what's on GitHub. Edits flow both ways via webhook + REST.",
            },
            {
              k: "// PORTABLE",
              v: "Disconnect any time. Webhooks deregister; your GitHub repo is unchanged. Mirrored issues stay locally as read-only history.",
            },
            {
              k: "// AUDITABLE",
              v: "Every inbound event is logged with its delivery ID. Replay any window of webhook activity from the integration settings page.",
            },
            {
              k: "// SCOPED",
              v: "Webhooks register only on repos you select. Removing the integration removes those webhooks — nothing else.",
            },
          ].map((row, i) => (
            <div
              key={row.k}
              className={`flex flex-col gap-2 bg-[var(--bg2)] p-6 ${i % 2 === 0 ? "border-r border-[var(--line2)] max-[760px]:border-r-0" : ""} ${i < 2 ? "border-b border-[var(--line2)]" : ""} max-[760px]:border-b max-[760px]:last:border-b-0`}
            >
              <div className="text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {row.k}
              </div>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {row.v}
              </p>
            </div>
          ))}
        </div>
      </OpsSection>

      {/* §07 — FAQ */}
      <OpsSection id="faq">
        <OpsSectionHead
          num="§07"
          label="// FAQ"
          headlineParts={["SIX QUESTIONS ", "WE GET MOST."]}
          toneMap={{ 1: "accent" }}
        />
        <div className="grid grid-cols-2 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            {
              q: "What if I close an issue on GitHub directly?",
              a: "GitHub fires issues.closed; Agenthost reflects the close on the mirrored issue immediately. The reverse holds too — closing in Agenthost writes back via the GitHub REST API.",
            },
            {
              q: "Can agents push code to my repos through the integration token?",
              a: "No. Agent PRs are pushed by the agent's runtime using its own git identity (configurable per-agent), not by the integration's OAuth token. The token is read-only for code; writes are issue/PR metadata only.",
            },
            {
              q: "Does this work with private repos?",
              a: "Yes. The repo scope covers private repositories in any org you authorize. Org owners can scope which repos Agenthost is granted access to via GitHub's OAuth approval flow.",
            },
            {
              q: "Can I connect multiple repos to one workspace?",
              a: "Yes. Each repo registers its own webhook and maps to one Agenthost project. The board shows org/repo#number provenance on every card; filter by repo, label, milestone, or assignee.",
            },
            {
              q: "What happens if I disconnect the integration?",
              a: "Webhooks deregister automatically (DELETE /repos/{owner}/{repo}/hooks/{id}). Mirrored issues stay in Agenthost as read-only snapshots. Your GitHub repos are untouched.",
            },
            {
              q: "How do I avoid agents and humans stepping on each other?",
              a: "Same way you do today: assignment + status. Agents start work when the issue is assigned to them AND status is Todo. Anything in Backlog is paused. The board makes this visible at a glance.",
            },
          ].map((item, i, arr) => (
            <div
              key={item.q}
              className={`flex flex-col gap-2 bg-[var(--bg2)] p-6 ${i % 2 === 0 ? "border-r border-[var(--line2)] max-[880px]:border-r-0" : ""} ${i < arr.length - 2 ? "border-b border-[var(--line2)]" : ""} max-[880px]:border-b max-[880px]:last:border-b-0`}
            >
              <h3 className="m-0 text-[length:var(--font-size-tag)] font-[number:var(--weight-medium)] leading-[1.35] text-[var(--txt)]">
                {item.q}
              </h3>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </OpsSection>

      {/* §08 — FINAL CTA */}
      <section
        id="cta"
        className="relative border-b border-[var(--line2)] py-[var(--cta-pad-y)] max-[1020px]:py-[var(--cta-pad-y-lg)] max-[760px]:py-[var(--cta-pad-y-md)]"
        style={{ background: "var(--bg-cta-glow), var(--bg)" }}
      >
        <OpsContainer>
          <div className="grid grid-cols-[1.4fr_1fr] items-end gap-16 max-[880px]:grid-cols-1 max-[880px]:gap-9">
            <div>
              <div className="mb-5 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// CONNECT_YOUR_REPO"}
              </div>
              <h2 className="m-0 mb-7 max-w-[18ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                PUT A <span className="text-[var(--accent)]">FLEET</span>
                <br />
                ON YOUR <span className="text-[var(--dim2)]">QUEUE.</span>
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                Five-minute install. Free during beta. No CSV exports, no
                migration window, no second source of truth. Your GitHub stays
                exactly where it is.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={installHref} className={opsButtonClassName("solid")}>
                  CONNECT GITHUB →
                </Link>
                <Link href={docsHref} className={opsButtonClassName("outline")}>
                  READ_THE_DOCS
                </Link>
                <Link href="/slack" className={opsButtonClassName("ghost")}>
                  SEE_SLACK_TOO
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// PROVIDER", v: "GitHub OAuth v2" },
                { k: "// SCOPE", v: "repo · admin:repo_hook" },
                { k: "// WEBHOOK SIG", v: "HMAC-SHA256" },
                { k: "// SYNC", v: "real-time · bi-di" },
                { k: "// STATUS", v: "GA", ok: true },
                { k: "// COST", v: "free · beta" },
              ].map((row) => (
                <div
                  key={row.k}
                  className="flex justify-between gap-3 border-b border-[var(--line)] px-[18px] py-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-micro)] text-[var(--dim)] last:border-b-0"
                >
                  <span className="flex-none">{row.k}</span>
                  <b
                    className={`truncate font-[number:var(--weight-medium)] ${row.ok ? "text-[var(--accent)]" : "text-[var(--txt)]"}`}
                  >
                    {row.v}
                  </b>
                </div>
              ))}
            </div>
          </div>
        </OpsContainer>
      </section>
    </OpsPageShell>
  );
}

/**
 * One use-case row inside §03 — copy on the left, mock on the right,
 * collapsing to single column on narrow viewports. Same shape as the
 * /slack page's UseCaseRow so the two integrations read as a series.
 */
function UseCaseRow({
  tag,
  num,
  title,
  body,
  mock,
}: {
  tag: string;
  num: string;
  title: string;
  body: string;
  mock: React.ReactNode;
}) {
  return (
    <article className="grid grid-cols-[200px_1fr_minmax(0,420px)] gap-10 border-b border-[var(--line2)] bg-[var(--bg2)] p-7 last:border-b-0 max-[1020px]:grid-cols-1 max-[1020px]:gap-5">
      <div>
        <div className="mb-2 text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
          {tag}
        </div>
        <div className="text-[length:var(--font-size-h5)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
          {num}
        </div>
      </div>
      <div>
        <h3 className="m-0 mb-3 text-[length:var(--font-size-h4)] font-[number:var(--weight-bold)] leading-[1.25] text-[var(--txt)]">
          {title}
        </h3>
        <p className="m-0 text-[length:var(--font-size-base)] leading-[var(--lh-loose)] text-[var(--txt2)]">
          {body}
        </p>
      </div>
      <div>{mock}</div>
    </article>
  );
}
