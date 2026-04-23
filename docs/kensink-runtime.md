# Agenthost Runtime — Architecture & Operations Guide

> **Audience:** Kensink Labs operators and developers setting up agent runtimes on Agenthost.
>
> **Server:** `https://agenthost.kensink.com`

---

## What is a Runtime?

A **runtime** is a daemon process that runs on a developer's machine (laptop, desktop, remote server, or CI box). It is the execution environment for AI agents — the daemon receives tasks from the Agenthost backend, invokes the AI coding tool (Claude Code, Cursor, Codex, etc.), and streams results back.

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser / App                      │
│            https://agenthost.kensink.com                    │
└──────────────────────────┬──────────────────────────────────┘
                           │  HTTPS / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Agenthost Server (EC2 / Docker)                │
│  ┌────────────────┐   ┌────────────────────────────────┐   │
│  │  Go Backend    │   │  Next.js Frontend              │   │
│  │  :8080 /api    │   │  :3000                         │   │
│  │  /ws           │   │                                │   │
│  └───────┬────────┘   └────────────────────────────────┘   │
│          │ PostgreSQL (pgvector) :5432                       │
└──────────┼──────────────────────────────────────────────────┘
           │
           │  WebSocket (wss://agenthost.kensink.com/ws)
           │  Long-lived, authenticated
           ▼
┌─────────────────────────────────────────────────────────────┐
│             Developer Machine / Runtime Host                │
│  ┌────────────────────────────────────────────────────┐    │
│  │  multica daemon  (background process)              │    │
│  │  • holds WebSocket connection to server            │    │
│  │  • receives agent tasks over the socket            │    │
│  │  • executes tasks via local AI tools               │    │
│  │  • streams output back to server                   │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                   │
│            ┌─────────────┼──────────────┐                   │
│            ▼             ▼              ▼                    │
│    Claude Code       Cursor         Codex                   │
│    (AI coding tool — does the actual work)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Runtime Components

### 1. `multica` CLI

The `multica` binary is the single entrypoint for everything runtime-related:

| Command | What it does |
|---------|-------------|
| `multica setup self-host --server-url <url>` | Configures server URL, authenticates, and starts daemon |
| `multica login` | Re-authenticate against the configured server |
| `multica daemon start` | Start the daemon in the background |
| `multica daemon stop` | Stop the background daemon |
| `multica daemon status` | Check daemon health and connected workspace |
| `multica agent run <issue-id>` | Manually trigger an agent task |

**Config file location:** `~/.multica/config.json` (per profile)

```json
{
  "server_url": "https://agenthost.kensink.com",
  "app_url":    "https://agenthost.kensink.com",
  "token":      "<jwt — set during login>"
}
```

### 2. Daemon

The daemon is a long-running background process spawned by `multica daemon start`. It:

- Opens a **WebSocket connection** to `wss://agenthost.kensink.com/ws`
- Authenticates using the JWT token stored in the config file
- Receives agent task payloads from the backend
- Invokes the configured AI tool (Claude Code, Cursor, Codex) in a subprocess
- Streams output (stdout/stderr) back to the backend over the WebSocket
- Auto-reconnects on disconnect with exponential backoff

The daemon runs as the **user's own process** — it has full access to the local filesystem, git repos, and installed tools, the same as if the user typed the command themselves.

### 3. Authentication Flow

```
1. User runs: multica setup self-host --server-url https://agenthost.kensink.com
2. CLI writes server_url + app_url to ~/.multica/config.json
3. CLI opens browser → https://agenthost.kensink.com/auth/cli-callback
4. User logs in via email code (Resend → noreply@kensink.com)
5. Backend issues a JWT; CLI polls localhost callback server to receive it
6. JWT stored in ~/.multica/config.json
7. CLI launches daemon → daemon connects via WebSocket with JWT in header
```

### 4. WebSocket Protocol

The daemon connects to: `wss://agenthost.kensink.com/ws`

- **Auth:** JWT passed as `Authorization: Bearer <token>` on the upgrade request
- **Messages:** JSON-framed task payloads (`task_start`, `task_output`, `task_done`, `ping/pong`)
- **Timeout:** nginx proxy_read_timeout is set to 3600s — connections stay alive for 1 hour idle
- **Reconnect:** daemon reconnects automatically on close/error

---

## Installation (for runtime operators)

### Step 1 — Install the CLI

```bash
curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
```

This downloads the official Multica CLI binary and prints the setup command for Agenthost.

> The CLI binary is the standard upstream release from `multica-ai/multica` — the same binary works with any self-hosted backend. The kensink install script just pre-configures it for `agenthost.kensink.com`.

### Step 2 — Connect to Agenthost

```bash
multica setup self-host --server-url https://agenthost.kensink.com
```

This will:
1. Save the server URL config
2. Open a browser login window
3. Start the daemon after successful authentication

### Step 3 — Verify

```bash
multica daemon status
```

Expected output when healthy:
```
daemon: running
server: https://agenthost.kensink.com
workspace: <your workspace name>
connected: yes
```

---

## Runtime Access Requirements

| Requirement | Details |
|-------------|---------|
| Outbound HTTPS | Port 443 to `agenthost.kensink.com` |
| Outbound WSS | Port 443 (WebSocket upgrade on same host) |
| Email domain | Must be `@kensink.com` (set by `ALLOWED_EMAIL_DOMAINS`) |
| AI tool | Claude Code, Cursor, Codex, or compatible tool installed locally |
| OS | macOS, Linux (x86_64 or arm64). Windows via WSL2. |

---

## How Onboarding Connects a Runtime

The web onboarding flow (`/onboarding`) Step 3 shows the CLI install instructions:

```
Step 3 · Runtime
"Connect a runtime."

┌─────────────────────────────────────────────┐
│  Install the CLI                            │
│  For servers, remote dev boxes, headless.  │
│                                  Show steps │
└─────────────────────────────────────────────┘
```

Clicking **Show steps** opens a dialog with the two commands:
1. `curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash`
2. `multica setup self-host --server-url https://agenthost.kensink.com`

The dialog listens for an active runtime — once `multica setup` completes and the daemon connects, the backend notifies the frontend over WebSocket and the **"Connect & continue"** button activates.

The desktop app download and cloud runtime waitlist options are **disabled** on this deployment — CLI is the only supported runtime.

---

## Day-to-Day Operations

### Start daemon after reboot
```bash
multica daemon start
```

### Check if daemon is running
```bash
multica daemon status
```

### Reconnect after token expiry
```bash
multica login
multica daemon restart
```

### Run an agent manually
```bash
multica agent run <issue-id>
```

### Update the CLI
```bash
curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
# Script detects existing install and upgrades automatically
```

---

## Multiple Runtimes

You can connect multiple machines as runtimes to the same workspace. Each daemon registers as a separate runtime that appears in workspace settings. Agents can be dispatched to any available runtime.

Common patterns at Kensink Labs:
- **Dev laptop** — interactive tasks, code review, short-running agents
- **Server / EC2** — long-running agents, overnight tasks, CI-like workloads (not `agenthost` itself — that runs the backend, not the CLI daemon)

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `server not reachable` | Server down or DNS not resolving | Check `https://agenthost.kensink.com/health` |
| `token expired` | JWT has 24h lifetime | Run `multica login` |
| `daemon: not running` | Process crashed or not started | Run `multica daemon start` |
| WebSocket reconnects in loop | Auth failure (bad token) | Run `multica login` then `multica daemon restart` |
| Agent tasks queue but don't run | No runtime connected in workspace | Check `multica daemon status` |

---

## Security Notes

- The JWT token stored in `~/.multica/config.json` is bearer auth — protect this file
- The daemon runs as your local user — it has full filesystem access
- Email login is restricted to `@kensink.com` addresses via `ALLOWED_EMAIL_DOMAINS` on the backend
- All traffic is over HTTPS/WSS — Cloudflare terminates TLS before the backend
