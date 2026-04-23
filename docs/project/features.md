# Multica — feature arrangement

This document maps **user-visible capabilities** to **implementation loci** (HTTP routes, packages, major services). Routes reference `server/cmd/server/router.go`.

## 1. Feature taxonomy

### 1.1 Identity, auth, and onboarding

| Capability | API / mechanism | Notes |
|------------|-----------------|-------|
| Email magic link / code login | `POST /auth/send-code`, `POST /auth/verify-code` | Resend integration; dev fallback logs codes. |
| Google OAuth | `POST /auth/google` | Social login path. |
| Logout | `POST /auth/logout` | Session invalidation pattern in handler layer. |
| Current user + profile | `GET/PATCH /api/me` | |
| Onboarding state | `PATCH /api/me/onboarding`, `POST .../complete`, cloud waitlist | Migrations add columns on `user`. |
| Starter content | `POST /api/me/starter-content/import`, `.../dismiss` | Product-led onboarding. |
| CLI token | `POST /api/cli-token` | Bridge for daemon/CLI auth. |
| PAT management | `/api/tokens` CRUD | Hashed storage; WS resolution. |

**Frontend:** `packages/core/auth`, `packages/core/onboarding`, login flows in `apps/web` / `packages/views`.

### 1.2 Workspaces and membership

| Capability | API |
|------------|-----|
| List / create workspaces | `GET/POST /api/workspaces` |
| Workspace detail + members | `GET /api/workspaces/{id}`, `GET .../members` |
| Update workspace (admin) | `PUT/PATCH /api/workspaces/{id}` |
| Leave / delete | `POST .../leave`, `DELETE /` (owner) |
| Invitations | `POST .../members` (create invite), `GET /api/invitations`, accept/decline |

**Frontend:** `packages/core/workspace`, invitation UX in views.

### 1.3 Issues (core product)

| Capability | API |
|------------|-----|
| CRUD + list | `/api/issues`, `/api/issues/{id}` |
| Search | `GET /api/issues/search` | DB search + optional bigram indexes. |
| Batch update/delete | `POST .../batch-update`, `.../batch-delete` |
| Comments + timeline | `POST/GET .../comments`, `GET .../timeline` |
| Subscribers | `GET .../subscribers`, `POST subscribe/unsubscribe` |
| Reactions | `POST/DELETE .../reactions` (issue-level) |
| Child issues + progress | `GET .../children`, `GET /api/issues/child-progress` |
| Attachments | `GET .../attachments`, `GET /api/attachments/{id}`, upload via `POST /api/upload-file` |
| Assignee analytics | `GET /api/assignee-frequency` |

**Domain logic:** `internal/handler/issue.go`, mention expansion `internal/mention`, task enqueue on assign `internal/service/task.go` (listeners).

**Frontend:** `packages/core/issues/*`, board/list stores, WS updaters.

### 1.4 Projects

| Capability | API |
|------------|-----|
| CRUD + search | `/api/projects`, `/api/projects/search`, `/{id}` |

**Frontend:** `packages/core/projects`.

### 1.5 Agents

| Capability | API |
|------------|-----|
| List / create | `GET/POST /api/agents` |
| Detail / update | `GET/PUT /api/agents/{id}` |
| Archive / restore | `POST .../archive`, `.../restore` |
| Task history | `GET .../tasks` |
| Skills assignment | `GET/PUT .../skills` |

**Frontend:** `packages/core` agent modules (via runtimes/settings UIs), views for agent profiles.

### 1.6 Runtimes (execution endpoints)

| Capability | API |
|------------|-----|
| List runtimes | `GET /api/runtimes` |
| Usage + activity | `GET /api/runtimes/{id}/usage`, `.../activity` |
| Health / ops | `POST .../ping`, `POST .../update`, `POST .../models`, local skills import |
| Settings | `PATCH .../settings` |
| Delete runtime | `DELETE /api/runtimes/{runtimeId}` |

**Daemon-side mirrors** under `/api/daemon/runtimes/...` for claim, ping results, model lists, etc.

**Frontend:** `packages/core/runtimes`.

### 1.7 Task execution and monitoring

| User-facing | API |
|-------------|-----|
| Active task on issue | `GET /api/issues/{id}/active-task` |
| Cancel | `POST .../tasks/{taskId}/cancel`, `POST /api/tasks/{taskId}/cancel` |
| Rerun | `POST /api/issues/{id}/rerun` |
| Task runs list | `GET .../task-runs` |
| Usage on issue | `GET .../usage` |
| Task messages | `GET /api/tasks/{taskId}/messages` (user), daemon has read/write variants |

**Daemon:** claim, start, progress, complete, fail, usage, messages, session pin, orphan recovery (`router.go` `/api/daemon/...`).

**Realtime:** `protocol.EventTask*` events.

### 1.8 Skills

| Capability | API |
|------------|-----|
| CRUD + import | `/api/skills`, `/api/skills/import`, `/{id}` |
| Files | `GET/PUT .../files`, `DELETE .../files/{fileId}` |

**Frontend:** skills management views; agents consume via runtime/task prompt path (server + daemon).

### 1.9 Chat with agents

| Capability | API |
|------------|-----|
| Sessions | `/api/chat/sessions` CRUD-ish + archive |
| Messages | `POST/GET .../{sessionId}/messages` |
| Pending task bridge | `GET .../pending-task`, `GET /api/chat/pending-tasks` |
| Read receipts | `POST .../read` |

**Frontend:** `packages/core/chat`.

### 1.10 Inbox

| Capability | API |
|------------|-----|
| List, unread count, bulk read/archive | `/api/inbox/*` |

**Frontend:** `packages/core/inbox` + WS updaters.

### 1.11 Autopilot (scheduled automation)

| Capability | API |
|------------|-----|
| Autopilot CRUD | `/api/autopilots` |
| Manual trigger | `POST .../{id}/trigger` |
| Triggers | `POST .../triggers`, `PATCH/DELETE .../triggers/{triggerId}` |
| Run history | `GET .../runs` |

**Backend:** `internal/service` autopilot + `cmd/server/autopilot_scheduler.go` + `ClaimDueScheduleTriggers` in sqlc.

**Frontend:** `packages/core/autopilots`.

### 1.12 Pins (navigation shortcuts)

| Capability | API |
|------------|-----|
| List, create, reorder, delete | `/api/pins` |

**Frontend:** `packages/core/pins`.

### 1.13 Usage analytics (workspace)

| Capability | API |
|------------|-----|
| Daily + summary | `GET /api/usage/daily`, `.../summary` |

**Frontend:** usage dashboards; may pair with Posthog in `packages/core/analytics`.

### 1.14 Comments (cross-issue)

| Capability | API |
|------------|-----|
| Edit/delete comment | `PUT/DELETE /api/comments/{commentId}` |
| Reactions | `POST/DELETE .../reactions` |

### 1.15 Configuration surface

| Capability | API |
|------------|-----|
| Public config | `GET /api/config` | Feature flags, signup policy, etc. |

## 2. Cross-cutting behaviors

- **Mentions:** `@agent` flows and issue identifier `PREFIX-###` expansion (`internal/mention`) — enqueue **mention tasks** distinct from assignee tasks (`TaskService.EnqueueTaskForMention`).
- **WebSocket:** all major entity changes fan out to workspace rooms for instant UI sync.
- **Activity + notifications:** event bus listeners materialize **activity_log** and **inbox_item** rows.

## 3. CLI feature parity (selected)

The **`multica`** binary (`server/cmd/multica`) exposes operational commands: config, auth, daemon lifecycle, workspace/agent/issue operations, attachments, autopilot triggers — aligned with the HTTP API for scripting and local dev.

## 4. Deliberate boundaries (not duplicated here)

- **Kensink / container runtime** deployment docs live under `docs/kensink-*.md` — operational packaging distinct from core schema.
- **Self-hosting** narrative: `SELF_HOSTING.md`, `SELF_HOSTING_AI.md`.
