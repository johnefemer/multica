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
  ACTORS,
  AgentPickerMock,
  BlockKitCard,
  ChannelHeader,
  ChatLink,
  EphemeralNotice,
  Mention,
  MessageRow,
  SlashCommandPopover,
  ThreadFrame,
  ThreadIndicator,
} from "./slack-mocks";

/**
 * Marketing page for the Slack ↔ Agenthost integration.
 *
 * Section structure mirrors the /10x precedent: hero → manifesto →
 * concrete demo → use cases → install → trust band → roadmap → FAQ →
 * CTA. The Slack-specific content lives in stylized mocks (no images);
 * mocks come from `./slack-mocks` so they stay legible across dark/
 * light tokens and test snapshots.
 */
export function SlackPageClient() {
  const user = useAuthStore((s) => s.user);
  const installHref = user ? "/" : "/login?next=/integrations";
  const docsHref = "/docs/slack";

  return (
    <OpsPageShell>
      {/* §00 — HERO */}
      <OpsSection id="hero">
        <div className="mb-9 flex flex-wrap items-center gap-[14px] text-[length:var(--font-size-label)] tracking-[var(--tr-label)] text-[var(--accent)] before:content-['//'] before:text-[var(--dim)]">
          <span>INTEGRATION</span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            SLACK
          </span>
          <span className="text-[var(--dim2)]">/</span>
          <span className="tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
            V1
          </span>
        </div>

        <div className="grid grid-cols-[1.4fr_1fr] gap-12 max-[1020px]:grid-cols-1 max-[1020px]:gap-8">
          <div>
            <h1 className="m-0 mb-6 sm:mb-8 [overflow-wrap:anywhere] text-[length:var(--font-size-hero)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-hero-lg)] max-[760px]:text-[length:var(--font-size-hero-md)] max-[380px]:text-[length:var(--font-size-hero-sm)]">
              YOUR AI TEAMMATES,
              <br />
              <span className="text-[var(--dim2)]">WHERE YOUR TEAM </span>
              <span className="text-[var(--accent)]">ALREADY IS.</span>
            </h1>
            <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-loose)] text-[var(--txt2)]">
              Threads become first-class agent sessions.{" "}
              <b className="font-[number:var(--weight-medium)] text-[var(--txt)]">
                @agenthost
              </b>{" "}
              picks up tickets, ships code, and replies back to the same
              thread —{" "}
              <span className="text-[var(--accent)]">
                no copy-paste, no context-switch, no new chat surface to learn.
              </span>
            </p>
            <div className="mb-9 flex flex-wrap items-center gap-[10px]">
              <Link href={installHref} className={opsButtonClassName("solid")}>
                INSTALL FOR YOUR TEAM
              </Link>
              <Link href="#flow" className={opsButtonClassName("ghost")}>
                SEE_IT_LIVE ↓
              </Link>
              <span className="ml-[6px] text-[length:var(--font-size-micro)] tracking-[var(--tr-caps)] text-[var(--dim)]">
                FREE · 5-MIN SETUP
              </span>
            </div>
            <div className="grid grid-cols-3 border border-[var(--line2)] max-[760px]:grid-cols-1">
              {[
                { k: "// SCOPE", v: "bot · users:read.email" },
                { k: "// LATENCY", v: "<3s ack" },
                { k: "// PROVIDER", v: "Slack OAuth v2" },
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

          {/* Hero-side mock: a compressed end-to-end thread */}
          <div className="flex flex-col gap-3">
            <ThreadFrame>
              <ChannelHeader />
              <MessageRow actor={ACTORS.human} time="10:12 AM">
                <Mention>agenthost</Mention> create issue: API 500 on null
                user_id in <ChatLink>billing/checkout.go</ChatLink>
              </MessageRow>
              <MessageRow actor={ACTORS.bot} time="10:12 AM">
                Filed and queued.
                <BlockKitCard
                  issueId="// MCA-482"
                  title="API 500 on null user_id in billing/checkout"
                  status={{ label: "TRIAGED", tone: "in_progress" }}
                  assignee="Python-Agent"
                  buttons={[
                    { label: "OPEN →", primary: true },
                    { label: "REASSIGN" },
                  ]}
                  variant="accent"
                />
              </MessageRow>
              <MessageRow actor={ACTORS.python} time="10:14 AM">
                Reproduced in test. Pushing fix to{" "}
                <ChatLink>fix/null-user-id</ChatLink>…
              </MessageRow>
              <MessageRow actor={ACTORS.python} time="10:18 AM">
                Shipped — PR{" "}
                <ChatLink>#491</ChatLink>. Coverage +2 cases. Ready for review.
              </MessageRow>
            </ThreadFrame>
            <p className="text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {"// FROM @ MENTION TO MERGED PR · SAME THREAD"}
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
            "STOP COPY-PASTING ",
            "BETWEEN ",
            "SLACK ",
            "AND YOUR TICKETS.",
          ]}
          toneMap={{ 1: "dim2", 2: "accent" }}
          sub="Your team already lives in Slack threads. Agenthost meets them there. Every @-mention starts a tracked agent session; every reply continues it; every shipped artefact lands back in the thread that asked for it."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            {
              tag: "// BEFORE",
              tone: "dim2",
              name: "TWO TOOLS, TWO BRAINS",
              desc: "Discuss in Slack → triage in tickets → assign to a human → wait for context to be re-explained → ship → drop a link back into Slack. Every transition leaks information.",
            },
            {
              tag: "// THE BRIDGE",
              tone: "accent2",
              name: "ONE THREAD = ONE SESSION",
              desc: "@agenthost in a bound channel auto-creates an Agenthost chat session. The thread starter picks an agent (or uses the channel default). Replies in that thread keep going; the agent keeps responding.",
            },
            {
              tag: "// AFTER",
              tone: "accent",
              name: "WORK SHIPS WHERE IT WAS REQUESTED",
              desc: "PRs, status changes, comments, tool-call timelines — all posted back to the same Slack thread. The conversation IS the audit trail.",
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

      {/* §02 — LIVE FLOW (full-width thread mock) */}
      <OpsSection id="flow">
        <OpsSectionHead
          num="§02"
          label="// LIVE_FLOW"
          headlineParts={["A FULL HANDOFF, ", "IN ONE THREAD."]}
          toneMap={{ 1: "accent" }}
          sub="A real flow, end to end: a human asks for work, the agent picks up, ships, and reports back. Every message you see here is something you'd see in your channel."
        />
        <div className="grid grid-cols-[1fr_320px] gap-8 max-[1020px]:grid-cols-1">
          <ThreadFrame>
            <ChannelHeader />
            <MessageRow actor={ACTORS.human} time="9:42 AM">
              <Mention>agenthost</Mention> we&apos;re seeing intermittent 500s on
              checkout when user_id is null. Can someone scope this?
            </MessageRow>
            <AgentPickerMock />
            <MessageRow actor={ACTORS.bot} time="9:43 AM">
              Picked <b className="text-[var(--accent)]">Python-Agent</b>.
              Working in this thread.
              <BlockKitCard
                issueId="// MCA-482"
                title="API 500 on null user_id in billing/checkout"
                status={{ label: "ASSIGNED", tone: "in_progress" }}
                assignee="Python-Agent"
                buttons={[
                  { label: "OPEN →", primary: true },
                  { label: "DISPATCH AGAIN" },
                ]}
                variant="accent"
              />
            </MessageRow>
            <MessageRow actor={ACTORS.python} time="9:48 AM" threaded>
              Repro&apos;d locally with{" "}
              <ChatLink>POST /checkout body:{`{user_id: null}`}</ChatLink>.
              Cause: missing nil-guard before the price lookup. Adding test +
              fix.
            </MessageRow>
            <MessageRow actor={ACTORS.python} time="9:53 AM" threaded>
              Tests passing. Pushing branch{" "}
              <ChatLink>fix/null-user-id</ChatLink>.
            </MessageRow>
            <MessageRow actor={ACTORS.python} time="9:55 AM" threaded>
              <BlockKitCard
                issueId="// PR-491"
                title="fix(checkout): guard against null user_id before price lookup"
                status={{ label: "READY FOR REVIEW", tone: "in_review" }}
                assignee="Python-Agent · req: Review-Agent"
                buttons={[
                  { label: "OPEN PR →", primary: true },
                  { label: "MERGE" },
                ]}
              />
            </MessageRow>
            <MessageRow actor={ACTORS.review} time="9:57 AM" threaded>
              Diff scoped, tests cover both paths. Suggesting one rename for
              clarity. <Mention>Maya</Mention> over to you for final
              approval.
            </MessageRow>
          </ThreadFrame>

          {/* Side commentary panel */}
          <aside className="flex flex-col gap-4">
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--accent)]">
                {"// WHAT'S HAPPENING"}
              </div>
              <ol className="m-0 flex list-none flex-col gap-3 p-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">01</span>
                  <span>
                    @-mention summons Agenthost; an ephemeral agent picker
                    appears.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">02</span>
                  <span>
                    Selection finalizes a chat_session bound to the thread_ts.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">03</span>
                  <span>
                    Agent works in its runtime; replies stream back as threaded
                    messages with provenance (APP badge).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="text-[var(--accent)]">04</span>
                  <span>
                    Every artefact (issue, PR, review) posts as a Block Kit
                    card with action buttons — open, reassign, dispatch again.
                  </span>
                </li>
              </ol>
            </div>
            <div className="border border-[var(--line2)] bg-[var(--bg2)] p-5">
              <div className="mb-2 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
                {"// CHAT_SESSION SOURCE"}
              </div>
              <pre className="m-0 overflow-x-auto whitespace-pre font-[family-name:var(--font-mono-display)] text-[length:var(--font-size-nano-sm)] leading-[var(--lh-normal)] text-[var(--txt2)]">{`source              = "slack"
external_team_id    = "T024F8…"
external_channel_id = "C0789A…"
external_thread_id  = "1714…"
agent_id            = "Python-Agent"`}</pre>
            </div>
          </aside>
        </div>
      </OpsSection>

      {/* §03 — USE CASES */}
      <OpsSection id="use-cases">
        <OpsSectionHead
          num="§03"
          label="// FLOWS"
          headlineParts={["THREE FLOWS ", "YOUR TEAM WILL OPEN DAILY."]}
          toneMap={{ 1: "accent" }}
          sub="Each maps to one Slack interaction surface — mention, slash command, or thread reply — and one Agenthost primitive."
        />
        <div className="grid gap-0 border border-[var(--line2)]">
          {/* Use case A — triage */}
          <UseCaseRow
            tag="// TRIAGE"
            num="01"
            title="Convert a thread into a tracked ticket"
            body="Drop @agenthost in any conversation. The bot reads the parent message, files an issue with its title and link, and posts a Block Kit card so the team can open, reassign, or dispatch in one click."
            mock={
              <ThreadFrame>
                <ChannelHeader channel="agenthost-prod" />
                <MessageRow actor={ACTORS.human} time="2:04 PM">
                  <Mention>agenthost</Mention> create issue: rate limiter is
                  off-by-one for tier=pro
                </MessageRow>
                <MessageRow actor={ACTORS.bot} time="2:04 PM">
                  Filed.
                  <BlockKitCard
                    issueId="// MCA-512"
                    title="Rate limiter off-by-one for tier=pro"
                    status={{ label: "OPEN", tone: "open" }}
                    buttons={[
                      { label: "ASSIGN TO ME", primary: true },
                      { label: "DISPATCH" },
                      { label: "OPEN" },
                    ]}
                    variant="accent"
                  />
                </MessageRow>
              </ThreadFrame>
            }
          />
          {/* Use case B — dispatch */}
          <UseCaseRow
            tag="// DISPATCH"
            num="02"
            title="Hand work to a coding agent without context-switching"
            body="Type /agenthost dispatch with an issue ID and the agent's name. The agent claims the work, runs in its runtime, and posts the result back to the thread. Ownership is enforced — only owners can dispatch their agents."
            mock={
              <div className="flex flex-col gap-3">
                <SlashCommandPopover
                  typed="/agenthost dispatch MCA-482 Python-A"
                  hints={[
                    {
                      sub: "dispatch <id> <agent>",
                      usage: "dispatch a tracked issue to one of your agents",
                    },
                    {
                      sub: "agents",
                      usage: "list your agents and pending requests",
                    },
                    {
                      sub: "issue assign <id> @user",
                      usage: "reassign a tracked issue",
                    },
                  ]}
                />
                <ThreadFrame>
                  <ChannelHeader channel="agenthost-prod" />
                  <MessageRow actor={ACTORS.bot} time="2:11 PM">
                    Queued <b className="text-[var(--accent)]">MCA-482</b> for{" "}
                    <b className="text-[var(--txt)]">Python-Agent</b>. Daemon
                    will claim on next poll (≤ 3s).
                  </MessageRow>
                </ThreadFrame>
              </div>
            }
          />
          {/* Use case C — chat sessions */}
          <UseCaseRow
            tag="// CHAT"
            num="03"
            title="Threads ARE chat sessions"
            body="Reply in the same thread; the agent keeps the context. Tool calls, file diffs, and follow-up questions stream back as threaded messages — the audit trail is the conversation. v1 mirrors the thread starter; multi-user threads coming next."
            mock={
              <ThreadFrame>
                <ChannelHeader channel="design-bot-channel" />
                <MessageRow actor={ACTORS.human} time="3:20 PM">
                  <Mention>agenthost</Mention> draft a release note for the
                  null-user-id fix
                </MessageRow>
                <ThreadIndicator count={3} />
                <MessageRow actor={ACTORS.python} time="3:21 PM" threaded>
                  Drafted. Three options — short, technical, customer-facing.
                </MessageRow>
                <MessageRow actor={ACTORS.human} time="3:22 PM" threaded>
                  go with technical, mention the tier=pro repro path
                </MessageRow>
                <MessageRow actor={ACTORS.python} time="3:23 PM" threaded>
                  Updated. Posted to{" "}
                  <ChatLink>release-notes/v1.4.2</ChatLink>.
                </MessageRow>
                <EphemeralNotice title="// HEADS UP">
                  Only the thread starter is mirrored to Agenthost. Multi-user
                  threads are tracked in{" "}
                  <ChatLink>johnefemer/multica#9</ChatLink>.
                </EphemeralNotice>
              </ThreadFrame>
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
          sub="OAuth v2, no proxy, no webhook config to copy around. Workspace admins install once; teammates onboard themselves on first @-mention."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            {
              num: "01",
              title: "ADD TO SLACK",
              body: "An admin clicks Install. Slack OAuth grants the bot scope and users:read.email so we can map Slack profiles to Agenthost accounts.",
              footer: "// scopes: bot · channels:read · users:read.email",
            },
            {
              num: "02",
              title: "BIND A CHANNEL",
              body: "From workspace settings, pick which Slack channels route to this Agenthost workspace. Optional: set a default agent so the picker is skipped.",
              footer: "// 1 channel ↔ 1 workspace",
            },
            {
              num: "03",
              title: "@AGENTHOST",
              body: "Mention the bot in a bound channel. The first teammate's account is auto-linked via their Slack profile email — no manual link step.",
              footer: "// auto-onboard via email",
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

      {/* §05 — TRUST / SCOPES */}
      <OpsSection id="trust">
        <OpsSectionHead
          num="§05"
          label="// TRUST"
          headlineParts={["ONLY THE SCOPES ", "YOU EXPECT."]}
          toneMap={{ 1: "accent" }}
          sub="Agenthost only responds when explicitly addressed. A bound channel is summonable, not eavesdropped. Permissions are minimal and documented."
        />
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 max-[880px]:grid-cols-1">
          <div className="flex flex-col border border-[var(--line2)]">
            <div className="border-b border-[var(--line2)] bg-[var(--bg2)] px-5 py-3 text-[length:var(--font-size-nano-sm)] tracking-[var(--tr-eyebrow)] text-[var(--dim)]">
              {"// OAUTH SCOPES REQUESTED AT INSTALL"}
            </div>
            {[
              {
                k: "bot",
                v: "post and react as Agenthost; receive @-mentions",
              },
              {
                k: "users:read.email",
                v: "map Slack profile email → Agenthost account",
              },
              {
                k: "channels:read",
                v: "list channels in the binding picker (bot only sees channels it's added to)",
              },
              {
                k: "chat:write",
                v: "post threaded replies and Block Kit cards",
              },
              {
                k: "commands",
                v: "register /agenthost slash commands",
              },
            ].map((row, i, arr) => (
              <div
                key={row.k}
                className={`grid grid-cols-[180px_1fr] gap-4 px-5 py-3 ${
                  i < arr.length - 1
                    ? "border-b border-[var(--line)]"
                    : ""
                }`}
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
                  "Read channels you didn't add the bot to",
                  "Index past messages or train on conversations",
                  "Cross-link Slack identities between unrelated workspaces",
                  "Auto-create agents — ownership requires admin approval",
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
                {"// SEAMLESS AUTO-ONBOARD"}
              </div>
              <p className="m-0 text-[length:var(--font-size-tag)] leading-[var(--lh-loose)] text-[var(--txt2)]">
                First @-mention from a teammate creates their Agenthost user
                via Slack profile email — no manual link step. Workspace owners
                can disable this with one toggle if your security model
                requires explicit invites.
              </p>
            </div>
          </div>
        </div>
      </OpsSection>

      {/* §06 — ROADMAP */}
      <OpsSection id="roadmap">
        <OpsSectionHead
          num="§06"
          label="// ROADMAP"
          headlineParts={["SLACK FIRST. ", "DISCORD ", "AND ", "TEAMS NEXT."]}
          toneMap={{ 1: "accent", 3: "accent" }}
          sub="The chat surface is abstracted behind a single ChatPlatform interface. Slack is the first concrete provider; the platform-neutral pieces — identity, channel binding, dispatch, ownership — work unchanged when the next surface lands."
        />
        <div className="grid grid-cols-3 gap-0 border border-[var(--line2)] max-[880px]:grid-cols-1">
          {[
            { name: "SLACK", status: "GA · V1", tone: "accent" },
            { name: "DISCORD", status: "DESIGN · Q3", tone: "accent2" },
            { name: "TEAMS", status: "PLANNED · Q4", tone: "dim" },
          ].map((p, i) => {
            const TONE_TEXT: Record<string, string> = {
              accent: "text-[var(--accent)]",
              accent2: "text-[var(--accent2)]",
              dim: "text-[var(--dim)]",
            };
            return (
              <div
                key={p.name}
                className={`flex flex-col gap-2 bg-[var(--bg2)] p-7 ${
                  i < 2
                    ? "border-r border-[var(--line2)] max-[880px]:border-r-0 max-[880px]:border-b"
                    : ""
                }`}
              >
                <div
                  className={`text-[length:var(--font-size-label)] tracking-[var(--tr-eyebrow)] ${TONE_TEXT[p.tone]}`}
                >
                  {`// ${p.status}`}
                </div>
                <div className="text-[length:var(--font-size-h3)] font-[number:var(--weight-bold)] uppercase tracking-[var(--tr-headline)] text-[var(--txt)]">
                  {p.name}
                </div>
              </div>
            );
          })}
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
              q: "Does Agenthost listen to every message in a bound channel?",
              a: "No. The bot only acts on direct triggers — an @-mention or a /agenthost slash command. Ambient channel chatter is ignored.",
            },
            {
              q: "Can teammates without Agenthost accounts use it from Slack?",
              a: "Yes. On their first @-mention, we auto-create an Agenthost user from their Slack profile email and add them as a workspace member. No manual link.",
            },
            {
              q: "How is dispatch authorized?",
              a: "Agents have explicit owners (1:N — one user can own multiple agents). Only the owner can dispatch them. Ownership requires workspace-admin approval.",
            },
            {
              q: "What happens to a thread if the channel is later unbound?",
              a: "Existing threads keep working until they're archived. Only new threads stop being mirrored.",
            },
            {
              q: "Can I use Agenthost in a private channel?",
              a: "Yes — invite the bot to the private channel and bind it from settings. Public channels are not implicitly bound.",
            },
            {
              q: "Where's the data hosted?",
              a: "On agenthost.pro (self-hostable). Slack message bodies pass through Agenthost only when explicitly addressed; outbound bot replies are posted via the Slack Web API.",
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
                {"// INSTALL_FOR_YOUR_TEAM"}
              </div>
              <h2 className="m-0 mb-7 max-w-[18ch] [overflow-wrap:anywhere] text-[length:var(--font-size-cta)] font-[number:var(--weight-bold)] uppercase leading-[0.96] tracking-[var(--tr-headline)] text-[var(--txt)] max-[1020px]:text-[length:var(--font-size-cta-lg)] max-[760px]:text-[length:var(--font-size-cta-md)] max-[380px]:text-[length:var(--font-size-cta-sm)]">
                DEPLOY YOUR <span className="text-[var(--accent)]">FLEET</span>
                <br />
                INTO <span className="text-[var(--dim2)]">THE THREAD.</span>
              </h2>
              <p className="m-0 mb-9 max-w-[56ch] text-[length:var(--font-size-lede)] leading-[var(--lh-normal)] text-[var(--txt2)]">
                Five-minute install. Free during beta. Bring your team into the
                same workspace your agents already work in.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link href={installHref} className={opsButtonClassName("solid")}>
                  INSTALL TO SLACK →
                </Link>
                <Link href={docsHref} className={opsButtonClassName("outline")}>
                  READ_THE_DOCS
                </Link>
                <Link href="/pricing" className={opsButtonClassName("ghost")}>
                  SEE_PRICING
                </Link>
              </div>
            </div>
            <div className="flex flex-col border border-[var(--line2)] bg-[var(--bg2)]">
              {[
                { k: "// PROVIDER", v: "Slack OAuth v2" },
                { k: "// SCOPE", v: "bot · users:read.email" },
                { k: "// LATENCY", v: "<3s slash-command ack" },
                { k: "// STATUS", v: "GA", ok: true },
                { k: "// COST", v: "free · beta" },
                { k: "// CONTACT", v: "agenthost@kensink.com" },
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
 * One use-case row inside §03. Stacked layout (copy left, mock right)
 * collapses to single column on narrow viewports. The mock prop is the
 * caller's responsibility — pass any composition of Slack mock pieces.
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
    <article className="grid grid-cols-[200px_1fr_minmax(0,400px)] gap-10 border-b border-[var(--line2)] bg-[var(--bg2)] p-7 last:border-b-0 max-[1020px]:grid-cols-1 max-[1020px]:gap-5">
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
