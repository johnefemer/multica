# Moving Agenthost to upstream's GitHub and Slack integrations

**Decision (2026-10-03):** move from the fork's own GitHub/Slack OAuth
integrations to upstream's GitHub App and Slack bot integrations, and retire
the fork's versions once nothing depends on them.

**Production today:** 5 GitHub and 2 Slack connections through the fork's
integrations, 90 issues imported from GitHub (`origin_type = 'integration'`),
1 Slack channel binding. Upstream's GitHub App was not configured; upstream's
Slack bots were enabled on 2026-10-03 (see Phase 1).

## How the two sets differ

| Capability | Fork (OAuth, Settings → Integrations) | Upstream |
|---|---|---|
| Link PRs to issues, show PR state + CI | Webhook-based, per repo | **GitHub App**: auto-links by issue identifier, CI + mergeability on the PR card, moves issues on merge |
| Pick repos for agent checkouts | Fork repo picker (dropped in v3) | **GitHub App**: "Choose from GitHub" in Settings → Code |
| Import GitHub issues + keep them in sync | **Yes** (import, opened/closed/edited sync) | **No equivalent** |
| Map a project to a repo | **Yes** (`integration_provider/repo` on projects) | **No equivalent** |
| Slack | One shared, hosted Slack app: channel bindings, slash commands, issue notifications, chat mirroring | **Per-agent bots** (bring your own Slack app, Socket Mode): chat with an agent in Slack threads |

Upstream does not replace GitHub issue import/sync, project↔repo mapping, or
the shared Slack app's slash commands and channel notifications. Retiring the
fork's integrations removes those features; keep them until you decide they
are not needed (Phase 3).

## Phase 1 — enable upstream alongside (now)

1. **Slack — done.** `MULTICA_SLACK_SECRET_KEY` is set in production's `.env`
   (32-byte key generated on the server; `.env` backed up first). Keep it
   stable: rotating it makes stored Slack tokens unreadable. Agents can now be
   connected to Slack from upstream's Slack panel.
2. **GitHub App — needs you.** Create it at
   <https://github.com/settings/apps/new> (or the org's settings):

   | Field | Value |
   |---|---|
   | Homepage URL | `https://agenthost.pro` |
   | Callback URL | leave blank |
   | Setup URL | `https://agenthost.pro/api/github/setup`, **Redirect on update** on |
   | Webhook URL | `https://agenthost.pro/api/webhooks/github` |
   | Webhook secret | **production's existing `GITHUB_WEBHOOK_SECRET`** — the fork's repo webhooks verify with the same value, so a new secret would break them. Read it with `ssh agenthost "grep ^GITHUB_WEBHOOK_SECRET= /opt/apps/agenthost/.env"` |
   | Repository permissions | Metadata, Contents, Pull requests, Checks, Commit statuses — all **Read-only** |
   | Events | Pull request, Check suite, Check run, Status |

   Then generate a private key and add to production's `.env`:

   ```dotenv
   GITHUB_APP_SLUG=<slug from https://github.com/apps/<slug>>
   GITHUB_APP_ID=<numeric App ID>
   GITHUB_APP_PRIVATE_KEY=<full PEM, BEGIN/END lines and newlines kept>
   ```

   and redeploy (`ssh agenthost 'bash /opt/apps/agenthost/scripts/agenthost-deploy.sh'`).
   Workspaces then connect from **Settings → Code**.

## Phase 2 — move users over

- Each workspace installs the GitHub App (Settings → Code) and picks the repos
  it already tracks through the fork's integration.
- Agents that should talk in Slack get a per-agent bot from upstream's Slack
  panel.
- Watch both paths for a while: upstream PR links should appear on issues
  that already show fork PR activity.

## Phase 3 — retire the fork's integrations (decide first)

Only once issue import/sync, project↔repo mapping and the shared Slack app are
confirmed unnecessary:

1. Hide the fork's Integrations page and settings tab, and stop registering
   repo webhooks.
2. Leave the data: the 90 imported issues stay ordinary issues
   (`origin_type = 'integration'` remains valid); `integration_connection`,
   `chat_channel_binding`, project mapping columns stay until a cleanup
   migration is agreed.
3. Remove the fork's `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` and GitHub OAuth
   app credentials from `.env`, and revoke the OAuth apps on GitHub/Slack.
