# Slack App Setup — Agenthost

How to create the Slack app on Slack's side, wire it to your Agenthost instance, and install it to a Slack workspace.

This guide covers what's working in **Phase 1** of [docs/slack-integration.md](slack-integration.md): OAuth install, the bot lands in your Slack workspace, the connection appears in Agenthost integration settings. Slash commands, events, interactivity, and chat mirroring are wired in later phases — but the Slack app you set up here is configured for them too, so you won't need to revisit this guide when those land.

---

## Prerequisites

- An Agenthost instance reachable from Slack's servers (Slack must be able to POST to your callback / webhook URLs over HTTPS). For local dev, use a tunnel like `ngrok http 3000` and set `MULTICA_APP_URL=https://<your-tunnel>.ngrok.io`.
- A Slack workspace where you can install apps (you must be a workspace admin, or have an admin who can approve the install).

---

## 1. Create the Slack app

1. Go to <https://api.slack.com/apps> and click **Create New App** → **From scratch**.
2. Name it `Agenthost` (or whatever your team will recognize), pick the development workspace.
3. You'll land on the **Basic Information** page. Keep this tab open — you'll come back for credentials at the end.

---

## 2. Configure OAuth & Permissions

Open **OAuth & Permissions** in the left sidebar.

### Redirect URL

Add the Agenthost OAuth callback URL:

```
https://<your-agenthost-host>/auth/slack/callback
```

For local dev with ngrok: `https://<your-tunnel>.ngrok.io/auth/slack/callback`.

Click **Add** and then **Save URLs**.

### Bot token scopes

Under **Scopes → Bot Token Scopes**, add the following. Agenthost requests all of these on install so users don't have to re-approve when later phases ship:

| Scope | Why |
|---|---|
| `app_mentions:read` | Receive `@agenthost` mentions in bound channels |
| `channels:history` | Read public-channel messages for chat mirroring |
| `channels:read` | List channels in the binding picker |
| `chat:write` | Post agent replies and notifications |
| `commands` | Execute `/agenthost` slash commands |
| `groups:history` | Read private-channel messages (when bot is added) |
| `groups:read` | List private channels in the binding picker |
| `im:history` | Read DMs (e.g. `/agenthost link` callbacks) |
| `im:write` | DM users (admin approvals, link prompts) |
| `team:read` | Fetch team metadata for the connection card |
| `users:read` | Resolve Slack user → profile |
| `users:read.email` | **Required** for seamless Slack ↔ Agenthost user mapping |

> **Why request everything up front?** Slack shows the requested scopes on the install consent screen. If we add scopes later, every existing install has to be re-approved by an admin — bad UX. Easier to ask once.

---

## 3. Configure Event Subscriptions (Phase 3+ — optional now)

Required when slash commands and chat mirroring land. You can skip this for Phase 1 (OAuth-install-only), but configuring it now means no second visit.

Open **Event Subscriptions** in the left sidebar and toggle **Enable Events** on.

### Request URL

```
https://<your-agenthost-host>/webhooks/slack/events
```

> Slack will immediately POST a `url_verification` challenge to this URL and expect a 200 response with the challenge value echoed back. **This endpoint does not exist in Phase 1** — Slack will refuse to save the URL until Phase 3 lands. Leave Event Subscriptions disabled for now and come back when you upgrade to a Phase 3+ build.

### Subscribe to bot events (when ready)

Add these events:

- `app_mention` — user @-mentions the bot in a channel
- `message.channels` — public channel messages (for chat mirroring)
- `message.groups` — private channel messages (when bot is added)
- `message.im` — DMs to the bot

---

## 4. Configure Slash Commands (Phase 3+ — optional now)

Required for `/agenthost ...` commands. Skip for Phase 1.

Open **Slash Commands** → **Create New Command**.

| Field | Value |
|---|---|
| Command | `/agenthost` |
| Request URL | `https://<your-agenthost-host>/webhooks/slack/commands` |
| Short Description | `Work with Agenthost from Slack` |
| Usage Hint | `chat <message> · issue new · dispatch <id> <agent> · help` |

Save.

---

## 5. Configure Interactivity (Phase 4+ — optional now)

Required for buttons and modals (agent picker, issue creation modal, ownership approvals). Skip for Phase 1.

Open **Interactivity & Shortcuts** → toggle **Interactivity** on.

### Request URL

```
https://<your-agenthost-host>/webhooks/slack/interactivity
```

---

## 6. Grab credentials

Open **Basic Information** in the left sidebar. Scroll to **App Credentials**.

Copy these three values into your Agenthost environment (`.env` for local, secrets manager for production):

```bash
SLACK_CLIENT_ID=<from "Client ID">
SLACK_CLIENT_SECRET=<click "Show" under "Client Secret">
SLACK_SIGNING_SECRET=<click "Show" under "Signing Secret">
```

> **Signing Secret vs Client Secret** — they're different. Client Secret is for OAuth code exchange; Signing Secret is for verifying inbound webhook signatures. Don't mix them up.

Restart the backend so the new env vars take effect:

```bash
make stop && make start
```

For Docker self-host:

```bash
docker compose -f docker-compose.selfhost.yml up -d --force-recreate backend
```

---

## 7. Install the app to Agenthost

1. In Agenthost, navigate to your workspace's **Settings → Integrations** page.
2. The Slack tile should now show a **Connect** button (no longer "Coming soon"). If it's grayed out with the tooltip "SLACK_CLIENT_ID not configured", the env var didn't reach the backend — re-check step 6.
3. Click **Connect**. You'll be redirected to Slack to choose the workspace and approve the requested scopes.
4. After approval, Slack redirects back to `/<workspace>/integrations?connected=slack`. The Slack tile flips to **Connected** with the Slack team name and icon.

What happened under the hood:

- Agenthost generated a CSRF state token and redirected you to Slack's consent screen.
- After you approved, Slack redirected to `/auth/slack/callback?code=…&state=…`.
- Backend verified the state, exchanged the code for a bot token, called `team.info` to fetch team metadata, and persisted the row in `integration_connection` (workspace-scoped, one row per Agenthost workspace per Slack team).

---

## What works in Phase 1

After completing the steps above on a Phase 1 build, the following is true:

- The Slack app exists and is installed in your Slack workspace.
- The Agenthost workspace shows **Connected** for Slack with the team name + icon.
- Disconnecting from Agenthost removes the OAuth grant on Agenthost's side (the bot remains in the Slack workspace until you uninstall it from Slack's app management page).

The following is **not yet wired** (later phases):

- Channel binding UI — picking which Slack channels mirror to which Agenthost workspaces (Phase 2).
- Auto-onboarding when a Slack user first interacts (Phase 3).
- `/agenthost` slash commands (Phase 3 + 5).
- Chat mirroring between Slack threads and Agenthost chat sessions (Phase 4).
- Issue notifications posted to Slack channels (Phase 6).
- Coding agent ownership approvals via Slack DM (Phase 7).

---

## Troubleshooting

**`Connect` button is grayed out.**
`SLACK_CLIENT_ID` is not visible to the backend. Restart the backend after setting the env var. For Docker: `docker compose -f docker-compose.selfhost.yml up -d --force-recreate backend` then check `/api/config` returns `slack_client_id`.

**Slack redirects with `error=invalid_redirect_uri`.**
The Redirect URL on Slack's app config doesn't match exactly what Agenthost is generating. Check `MULTICA_APP_URL` matches the public host that Slack will redirect back to (scheme + host + port). Trailing slashes matter.

**Slack redirects with `error=invalid_client_id` or `bad_client_secret`.**
Credentials don't match. Re-copy from Slack's **Basic Information → App Credentials** page; whitespace at the end of the env var is a common culprit.

**Callback completes but tile still shows "Not connected".**
Look at backend logs for `slack oauth: …` errors. Most common: `oauth_v2_access` returned `invalid_grant` because the code was already used (refresh the page rather than re-running the callback URL manually).

**Slack refuses to save the Event Subscriptions Request URL.**
Phase 1 doesn't ship that endpoint. Leave Events disabled until you upgrade to a Phase 3+ build.

---

## Re-installing or rotating credentials

If you need to rotate the Client Secret or Signing Secret:

1. Slack → **Basic Information → App Credentials → Regenerate**.
2. Update the env var and restart the backend.
3. Existing installs continue to work for OAuth-issued tokens (those don't change) — only new installs and webhook signature verification use the new secrets.

To re-install fresh in the same Slack workspace:

1. Disconnect in Agenthost (Settings → Integrations → Slack → trash icon).
2. Slack → your-workspace → **Settings & administration → Manage apps** → find Agenthost → **Remove**.
3. Click **Connect** again in Agenthost.
