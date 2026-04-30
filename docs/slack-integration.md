# Slack Integration — Plan

Status: Draft. Implementation not yet started.

## Goals

- Install an Agenthost Slack app to a Slack workspace and bind individual channels to individual Agenthost workspaces (channel ↔ workspace is 1:1).
- **Make a Slack thread a first-class Agenthost chat session.** Each thread in a bound channel mirrors a `chat_session` in Agenthost; replies flow both ways.
- **Map Slack users to Agenthost users seamlessly** — no manual link step. First contact in a bound channel resolves the Agenthost user via Slack profile email and creates one if needed.
- Let Slack users work on issues (create, assign, change status, dispatch to agents) via slash commands and structured interactivity.
- Let humans own multiple coding agents (1:N, admin-approved) and dispatch issues to a named agent from Slack.
- Architect the chat surface so Discord and Teams can plug in later as drop-in providers — Slack is the first concrete implementation.

## Non-goals (v1)

- **Multi-participant chat.** Today's `chat_session` is 1 user ↔ 1 agent. v1 mirrors only the Slack thread *starter* into Agenthost; other Slack users replying in the same thread get a one-time ephemeral note. Multi-user chat is tracked separately in [johnefemer/multica#9](https://github.com/johnefemer/multica/issues/9) (design) and #10 (impl).
- Public Slack App Directory listing — ship as a private/per-tenant install until product fit is clear.
- Two-way comment sync (Slack thread reply ↔ issue comment). Outbound notifications for issue events are one-way for v1.
- Synchronous agent push. Dispatch enqueues a task; the daemon picks it up on its next poll. UX must reflect this ("queued").
- Mid-thread agent switching. The agent is fixed at chat session creation, matching today's chat behavior. To use a different agent, start a new Slack thread.

## Decisions settled

1. **Cardinality.** Channel ↔ workspace is 1:1 (each channel routes to exactly one workspace). One Slack team can host channels bound to multiple Agenthost workspaces. One Agenthost workspace can have multiple bound channels (e.g. `#issues`, `#agents`) — each channel determines its own workspace context.
2. **Slack user ↔ Agenthost user is 1:1.** Mapping is automatic on first contact via Slack profile email + name. No manual link command required for the happy path.
3. **`@me` resolves to the Agenthost user.** To dispatch work to an agent, name it explicitly: `/agenthost dispatch ISSUE-123 Python-Agent`.
4. **User ↔ coding agents is 1:N.** A workspace member can own multiple agents. Ownership requires workspace-admin approval. Agents act on behalf of their owner; comments and status changes produced by an agent are attributed to the agent with provenance shown (`agent X owned by user Y`).
5. **Slack thread = Agenthost chat session, 1:1.** Each top-level message in a bound channel that explicitly invokes Agenthost (`@agenthost ...` mention or `/agenthost chat ...` slash command) creates one `chat_session`. Replies in the Slack thread by the original starter are subsequent messages in that session. Agent's responses post back into the Slack thread.
6. **Agent selection per thread is via ephemeral picker.** First message in a new thread → bot replies ephemerally to the thread starter with an agent picker. Selection finalizes the `chat_session`. Picker auto-cancels after 10 minutes of no selection.
7. **Channel binding may carry a default agent.** `chat_channel_binding.default_agent_id` is nullable. When set, the picker is skipped and the default is used. UI for setting it is deferred to a follow-up — column exists from day one to avoid migration churn.
8. **Modular abstraction.** A new `ChatPlatform` interface sits alongside the existing `IntegrationProvider`. Slack/Discord/Teams each implement `ChatPlatform`. The OAuth install path keeps reusing `IntegrationProvider`.

## Open questions remaining

- **Multi-tenant Slack team installs.** If two unrelated Agenthost orgs install the app to the same Slack team, do they share the bot token? Slack issues one bot token per team, so practically yes. Channel binding scopes data per workspace. Worth flagging in security review.
- **Channel binding authority.** Recommendation: workspace admin only, performed from the integration settings page (channel picker), not via Slack command. Confirm before wiring `/agenthost bind` (or remove it).
- **Mid-thread non-creator replies.** v1 ignores them with a one-time ephemeral note. If someone considers this confusing, alternative is reacting with an info emoji and threading a single bot reply to the channel about the limitation.

## Invocation rules (when does Agenthost respond?)

The defining rule: **Agenthost only responds when explicitly addressed.** A bound channel is *summonable*, not eavesdropped.

| Situation | Trigger? |
|---|---|
| First message in a channel mentions `@agenthost` or uses `/agenthost ...` | **Yes** — start a new chat session, prompt for agent |
| First message is plain channel chatter (no mention, no slash) | **No** — ignored |
| Reply in a thread that already has a chat session, from the thread creator | **Yes** — append to session |
| Reply in a thread that already has a chat session, from anyone else | **No** — one-time ephemeral note about 1:1 limitation |
| Channel isn't bound to a workspace | **No** — if `@agenthost` mentioned, ephemeral pointer to ask an admin to bind |

## Modular architecture: `ChatPlatform`

The existing `IntegrationProvider` interface ([provider.go](server/internal/integration/provider.go)) handles OAuth install + generic webhooks well, but chat platforms have a distinct surface (slash commands, interactive components, ephemeral replies, modals) that doesn't map cleanly onto a generic webhook handler. Adding a sibling abstraction keeps both clean.

```
server/internal/messaging/
  platform.go             // ChatPlatform interface (Slack/Discord/Teams)
  command.go              // CommandRequest, CommandResponse, CommandRouter
  interaction.go          // InteractionRequest (button/modal), InteractionResponse
  message.go              // OutboundMessage (rich card, plain text, ephemeral)
  identity.go             // IdentityResolver — seamless Slack→Agenthost user mapping
  channel.go              // ChannelBinding lookup (channel_id → workspace_id)
  thread.go               // ThreadResolver — Slack thread ↔ chat_session lookup/create
  router.go               // central dispatcher: verifies signature, resolves identity, routes

server/internal/messaging/slack/
  provider.go             // implements ChatPlatform AND IntegrationProvider (for OAuth install)
  oauth.go                // Slack OAuth v2 (bot scope)
  client.go               // thin wrapper over Slack Web API
  events.go               // Events API (app_mention, message.channels) → CommandRequest / chat input
  commands.go             // slash command parser → CommandRequest
  interactivity.go        // block_actions, view_submission → InteractionRequest
  notify.go               // outbound: post chat replies, issue updates as Slack Block Kit

server/internal/messaging/discord/   // future
server/internal/messaging/teams/     // future
```

`ChatPlatform` interface (sketch):

```go
type ChatPlatform interface {
    Name() string                                            // "slack", "discord", "teams"
    VerifyRequest(r *http.Request, body []byte) error        // signature/timestamp check
    ParseCommand(r *http.Request, body []byte) (*CommandRequest, error)
    ParseInteraction(r *http.Request, body []byte) (*InteractionRequest, error)
    ParseEvent(r *http.Request, body []byte) (*EventRequest, error)
    PostMessage(ctx context.Context, channelID, threadID string, msg OutboundMessage) (string, error)
    PostEphemeral(ctx context.Context, channelID, userID string, msg OutboundMessage) error
    OpenModal(ctx context.Context, triggerID string, view ModalView) error
    LookupUserProfile(ctx context.Context, externalUserID string) (*ExternalProfile, error)
    LookupChannel(ctx context.Context, externalChannelID string) (*ExternalChannel, error)
}
```

Command, identity resolution, and chat-session bridging live in platform-neutral code; only parsing/serialization is Slack-specific. When we add Discord later, we write `discord.Provider` and the rest works unchanged.

## Schema

One migration. Additive: extends existing tables, adds two new ones.

```sql
-- Channel binding: deterministic channel → workspace lookup for inbound routing.
-- Globally unique on external_channel_id (a channel can belong to at most one workspace).
CREATE TABLE chat_channel_binding (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,                 -- 'slack' | 'discord' | 'teams'
  external_team_id TEXT NOT NULL,         -- Slack team id
  external_channel_id TEXT NOT NULL,      -- Slack channel id (C0123...)
  external_channel_name TEXT,             -- denormalized for UI; refreshed on rename event
  default_agent_id UUID REFERENCES agent(id) ON DELETE SET NULL,  -- skip ephemeral picker if set
  event_filters TEXT[] NOT NULL DEFAULT '{}',  -- which workspace events post here
  created_by UUID REFERENCES "user"(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, external_channel_id)
);

-- Identity bridge: external chat user ↔ Agenthost user (1:1 within a workspace).
CREATE TABLE chat_user_link (
  id UUID PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_team_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  external_email TEXT,                    -- snapshot at link time, for audit
  external_name TEXT,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, external_user_id),
  UNIQUE (workspace_id, user_id, platform)
);

-- Slack thread → chat session bridge. Additive columns on existing chat_session.
ALTER TABLE chat_session
  ADD COLUMN source TEXT NOT NULL DEFAULT 'web',  -- 'web' | 'slack' | 'discord' | 'teams'
  ADD COLUMN external_team_id TEXT,
  ADD COLUMN external_channel_id TEXT,
  ADD COLUMN external_thread_id TEXT;             -- Slack thread_ts (parent message ts)

CREATE UNIQUE INDEX chat_session_external_thread_idx
  ON chat_session (source, external_thread_id)
  WHERE external_thread_id IS NOT NULL;

-- Map outbound chat replies to Slack message ts for edit/update support.
ALTER TABLE chat_message
  ADD COLUMN external_message_id TEXT;            -- Slack message ts of the relayed reply

-- Coding agent ownership: a user can own N agents; each agent has at most one owner.
ALTER TABLE agent
  ADD COLUMN owner_user_id UUID REFERENCES "user"(id) ON DELETE SET NULL,
  ADD COLUMN ownership_status TEXT NOT NULL DEFAULT 'unowned',  -- 'unowned' | 'pending' | 'approved' | 'revoked'
  ADD COLUMN ownership_requested_at TIMESTAMPTZ,
  ADD COLUMN ownership_approved_by UUID REFERENCES "user"(id),
  ADD COLUMN ownership_approved_at TIMESTAMPTZ;

-- Per-workspace setting: gate seamless auto-onboarding from Slack profiles.
ALTER TABLE workspace
  ADD COLUMN chat_auto_onboard BOOLEAN NOT NULL DEFAULT true;
```

The existing `integration_webhook_event` idempotency table ([integration.sql](server/pkg/db/queries/integration.sql)) is reused for Slack `event_id` deduplication.

## Seamless user mapping (the centerpiece)

The Slack ↔ Agenthost user mapping must be invisible to users. The first time someone interacts with the Agenthost bot in a bound channel, it just works — no command to run, no link to click for the happy path.

**Resolution algorithm**, run on every inbound message before any other handling:

```
resolve_identity(slack_team_id, slack_user_id, workspace_id):
  1. lookup chat_user_link by (workspace_id, 'slack', slack_user_id)
     → if found: return linked Agenthost user
  2. fetch Slack profile via users.info(slack_user_id)
     → email, real_name, image_url
  3. lookup Agenthost user by email = profile.email
     → if found:
         - ensure workspace membership (auto-add as 'member' if missing)
         - INSERT chat_user_link
         - return user
  4. else:
     - if workspace.chat_auto_onboard = true:
         - CREATE Agenthost user (email, name, no password, source='slack')
         - ADD as workspace member (role='member')
         - INSERT chat_user_link
         - notify workspace admins via inbox: "X joined via Slack"
         - return user
     - else:
         - reply ephemerally: "Ask a workspace admin to enable Slack onboarding."
         - return nil
```

**Edge cases handled by this algorithm:**

- **Slack profile email is hidden** (Slack privacy setting). The bot install requires `users:read.email` scope; if the workspace owner declines it, identity resolution falls back to the manual `/agenthost link` escape hatch (DM with a one-time URL → web sign-in → row written).
- **Email collision across orgs.** A Slack user's email may already exist in Agenthost in a different workspace. We link to the existing user and add them as a member of the *current* workspace — never silently move them between orgs.
- **Auto-created users have no password.** They sign into the web app via "Sign in with Slack" (a follow-up phase). Until that lands, they live entirely through Slack.
- **Workspace owner toggles `chat_auto_onboard` off later.** Existing links keep working; only *new* user creation is gated.

The `/agenthost link` command exists as an escape hatch — for re-linking after a Slack workspace migration, or for users whose email mismatch wasn't auto-resolvable. It is never the primary path.

## Chat mirroring (Slack thread ↔ Agenthost `chat_session`)

The flagship behavior of v1.

**On first invocation in a thread** (top-level message that mentions `@agenthost` or uses `/agenthost chat <message>`):

1. Verify channel binding → resolve `workspace_id`.
2. Resolve identity → get Agenthost user (auto-onboarding if needed).
3. Determine agent:
   - If `chat_channel_binding.default_agent_id` is set → use it.
   - Else → post **ephemeral** message to the thread starter with an agent picker (block_actions select menu listing agents the user can assign per `canAssignAgent()`).
   - On selection → create `chat_session` with `(source='slack', external_team_id, external_channel_id, external_thread_id, agent_id, creator_id, title=<first 50 chars>)` and enqueue the user's message as the first `chat_message`.
   - On no selection within 10 minutes → post a follow-up ephemeral cancellation; the message is discarded.
4. Post a non-ephemeral threaded reply confirming "Working on it…" so other channel members can see Agenthost is engaged.

**On subsequent replies in the same thread:**

- By the original creator → look up `chat_session` by `(source='slack', external_thread_id)`, append to `chat_message`, enqueue task.
- By anyone else → ignore. On the *first* such occurrence per thread, post one ephemeral note to that user: "Agenthost only listens to the thread starter for now. Multi-user chat is tracked in johnefemer/multica#9."

**On agent reply** (agent's task completes, writes assistant message via `chat:done` WS event):

- Sibling of the existing `chat:done` listener: a `slack_listeners.go` handler reads `chat_session.source = 'slack'`, formats the assistant content as Block Kit (handles markdown → mrkdwn conversion + tool-call timeline collapsed by default), posts to the thread via `client.PostMessage(channel_id, thread_ts=external_thread_id, ...)`, stores the returned `ts` on `chat_message.external_message_id`.

**Edge cases:**

- Agent task fails → post error message to thread with retry button.
- Slack message edited → ignore in v1 (chat is append-only). Document this clearly.
- Slack message deleted → also ignore in v1.
- Channel unbound while a thread is active → existing thread keeps working until archived; new threads can't start.
- Workspace deleted → CASCADE drops `chat_session` rows (no broken references).

## Inbound endpoints

Slack hits three different URLs with three different signature formats. Mount under the existing public webhook group in [router.go](server/cmd/server/router.go):

- `POST /webhooks/slack/events` — Events API. Verified via `X-Slack-Signature` + `X-Slack-Request-Timestamp` (timestamp within 5 min). Initial `url_verification` challenge handled inline.
- `POST /webhooks/slack/commands` — slash commands. Form-encoded body. **Must respond ≤3s** — handler ACKs `200 {}` immediately and dispatches real work to a goroutine, mirroring [integration_webhook.go:23-111](server/internal/handler/integration_webhook.go).
- `POST /webhooks/slack/interactivity` — block_actions and view_submission (button clicks, modal submits, agent picker selection). Same fast-ack rule.

These bypass the generic `/webhooks/{provider}` dispatcher because the surfaces are too different to fit through one `VerifyWebhook` method. Dispatch lives in `messaging/slack/router.go`.

## Outbound notifications (issue events → Slack)

Add `slack_notify_listeners.go` next to [notification_listeners.go](server/cmd/server/notification_listeners.go). Subscribes to internal events (`EventIssueCreated`, `EventIssueUpdated`, `EventIssueAssigned`, `EventTaskCompleted`, `EventCommentAdded`) and:

1. Looks up `chat_channel_binding` rows for the event's workspace.
2. Filters by `event_filters`.
3. Renders Block Kit and posts via `client.PostMessage` (no thread_ts — these are channel-level posts, not chat replies).

Don't merge this into the inbox listener — channel notifications are a different concern and keeping them separate leaves the door open for an email listener later.

Block Kit cards include: title (link), status badge, assignee, project, plus action buttons (Acknowledge, Reassign to me, Dispatch to agent, Open in Agenthost).

## Slash command surface (v1)

Single registered command `/agenthost` with subcommand routing.

```
/agenthost chat <message>            → start a new chat thread (alternative to @-mention)
/agenthost issue new                 → opens modal: title, description, project, assignee
/agenthost issue assign <id> @me     → assigns to caller's Agenthost user
/agenthost issue assign <id> @user   → reassigns to named user (must have chat_user_link)
/agenthost issue status <id> <status>→ set status
/agenthost issue show <id>           → ephemeral card with current state
/agenthost dispatch <id> <agent>     → dispatch to a named agent (caller must own it)
/agenthost agents                    → list my owned agents (+ pending requests)
/agenthost agents request <agent>    → request ownership (admin must approve)
/agenthost link                      → DM with one-time URL to (re-)link Slack ↔ Agenthost (escape hatch)
/agenthost help                      → ephemeral usage
```

Issue ID format matches the existing identifier (e.g. `ISS-123`). Subcommand parsing is a tiny state machine in `messaging/command.go`; no need for a CLI lib.

## Interactivity

Four flows ride on the interactivity webhook:

1. **Agent picker** (chat thread first message) — block_actions select; on submit, finalize `chat_session` and run the queued message.
2. **Issue card buttons** — Acknowledge, Reassign to me, Dispatch to agent (modal asks which one), Open (deep link).
3. **Issue creation modal** — opened by `/agenthost issue new`. `view_submission` validates and creates the issue.
4. **Agent ownership approval** — when a user requests ownership, workspace admins receive a DM with Approve/Deny buttons. Decision writes back to `agent.ownership_status`.

## Coding agent ownership and dispatch

Ownership lifecycle on `agent` row:

```
unowned ──► pending ──► approved
              │            │
              └── (denied) │
                           └──► revoked
```

Request paths:
- From Slack: `/agenthost agents request <agent-name>` → sets `ownership_status='pending'`, `owner_user_id=<requester>`, fires admin notification.
- From web: settings → agents → "Request ownership" button.

Approval paths:
- From Slack: button on admin DM.
- From web: agents settings page.

Dispatch (`/agenthost dispatch <id> <agent>`):
1. Look up agent by name within workspace.
2. Verify caller owns it (`agent.owner_user_id = caller.id` and `ownership_status='approved'`).
3. Enqueue an agent task tied to the issue (existing API).
4. Reply ephemerally: "Queued for <agent-name>."
5. When the agent runs, comments and status changes are written with `actor_type='agent'`, `actor_id=<agent.id>`. UI/Slack notifications show "agent X (owned by user Y)".

## Frontend changes

All under existing settings shell — no new app routes.

- [integrations-page.tsx](packages/views/integrations/integrations-page.tsx): flip Slack from `comingSoon: true` to a real provider; "Install" button hits `/auth/integrations/slack/start`.
- New `packages/views/settings/integrations/slack-settings.tsx`:
  - Connected Slack team (name, icon, disconnect).
  - Channel bindings list: bind a channel to this workspace (channel picker fetched via `conversations.list` from the bot token), event filter checkboxes per binding, per-binding default agent picker (skips ephemeral picker when set).
  - Linked Slack users list (read-only, derived from `chat_user_link`).
  - `chat_auto_onboard` toggle.
- New `packages/views/settings/agents/agent-ownership.tsx`:
  - List agents in the workspace, ownership status, owner.
  - Admin-only: pending approvals queue with Approve/Deny.
  - User: "Request ownership" actions.

All UI is shared (lives in [packages/views](packages/views)) — both web and desktop pick it up automatically through the existing settings routing.

## Phasing

Each phase is independently shippable. Chat mirroring is the centerpiece — phases 1-4 build to it; later phases extend.

1. **Foundation (provider skeleton + OAuth install).** `messaging/` package, `ChatPlatform` interface, `slack.Provider` boilerplate, OAuth v2 install (bot scope including `users:read.email`), `integration_connection` row written, settings UI shows "Connected to <Slack team>". No commands yet. ~2 days.
2. **Channel binding.** `chat_channel_binding` schema, channel picker UI in slack-settings page, admin-only binding flow. ~2 days.
3. **Seamless identity + auto-onboarding.** Three Slack endpoints with signature verification, `chat_user_link` schema, the resolution algorithm above, `chat_auto_onboard` workspace toggle, `/agenthost link` escape hatch, `/agenthost help`. ~3 days.
4. **Chat mirroring.** `chat_session` schema additions, ephemeral agent picker, thread → session bridging, agent reply → Slack thread relay via `slack_notify_listeners.go`. **The flagship demo for v1.** ~4 days.
5. **Issue commands.** `/agenthost issue new/assign/status/show`, issue-creation modal. ~3 days.
6. **Outbound issue notifications.** Listener subscribed to `EventIssueCreated/Updated/Assigned/TaskCompleted`, Block Kit issue cards with action buttons. ~3 days.
7. **Coding agent ownership + dispatch.** `agent` table changes, request/approval flow, `/agenthost dispatch/agents`. ~3 days.
8. **(Stretch) Sign in with Slack on web.** So auto-onboarded users have a password-less login path. ~1 day.

Total: ~21 working days for a single engineer; phases 5/6/7 can run in parallel after phase 4.

## Testing strategy

- **Go unit tests** for `messaging/command.go` parser, `messaging/identity.go` resolver (every branch of the seamless onboarding algorithm), `messaging/slack/oauth.go` token exchange (with httptest), Block Kit serialization, mrkdwn conversion.
- **Go integration tests** against test Postgres for: channel binding lookup, identity auto-onboarding (existing user / new user / disabled toggle), thread → session resolution, dispatch authorization. Use the existing per-test fixture pattern.
- **Frontend unit tests** for `slack-settings.tsx` and `agent-ownership.tsx` in [packages/views](packages/views) (vitest + jsdom; mock `@multica/core` per CLAUDE.md rules).
- **E2E** stubs out Slack: a `mockSlackPlatform` registered against `ChatPlatform` lets Playwright tests POST synthetic event/command/interactivity payloads at the local backend and assert that issues/chat_sessions/messages get the right rows.
- **Manual smoke test plan** for first install: install app → bind channel → mention `@agenthost help me with X` in thread → pick agent → assert agent reply lands in thread → reply in thread → assert subsequent message routes correctly.

## Future: Discord, Teams

Reusing the `ChatPlatform` interface, future providers need only:

- `discord/provider.go` implementing `ChatPlatform` (slash commands via Discord interactions; signature verification via Ed25519).
- `teams/provider.go` implementing `ChatPlatform` (Bot Framework messaging; HMAC verification via JWT bearer).

The platform-neutral pieces — command routing, identity resolution, channel binding lookup, thread bridging, agent ownership/dispatch, outbound notification fan-out — work unchanged. Block Kit rendering becomes platform-conditional in `notify.go` (Slack Block Kit / Discord embeds / Teams adaptive cards) but the trigger logic and event filters are shared.

When multi-participant chat lands ([#9](https://github.com/johnefemer/multica/issues/9) / #10), the per-platform thread-bridging logic gets extended to relay all participants' messages — the rest of the integration is unaffected.

## Environment variables

Add to `.env.example`:

```
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
SLACK_APP_ID=
SLACK_REDIRECT_URI=https://<host>/auth/integrations/slack/callback
```

Loaded via `os.Getenv()` in `messaging/slack/provider.go` constructor, registered in [router.go](server/cmd/server/router.go) alongside the existing GitHub provider.
