# Multica — algorithms, runtime behavior, and dependencies

## 1. Core algorithms and distributed-style protocols

### 1.1 Per-runtime task claiming

**Problem:** Many **agents** can share one **runtime** (one daemon). Pending rows include `agent_id` and `runtime_id`. The daemon must claim work it can execute while respecting each agent’s **concurrency limit**.

**Implementation:** `TaskService.ClaimTaskForRuntime` (`internal/service/task.go`):

1. `ListPendingTasksByRuntime(runtimeID)` returns candidate queued rows ordered for dispatch.
2. Iterate candidates; **dedupe by `agent_id`** (first pending row per agent is enough to probe capacity).
3. For each distinct agent, call `ClaimTask(agentID)`:
   - Load agent; `CountRunningTasks(agent)` vs `MaxConcurrentTasks`.
   - If capacity allows, run **`ClaimAgentTask`** SQL — atomic single-row transition from queued/dispatched to claimed/dispatched (exact states defined in SQL).
4. Return the first claimed task whose `runtime_id` still matches the requesting runtime.

**Why it matters:** avoids head-of-line blocking when the first pending row belongs to a saturated agent.

### 1.2 Per-agent task claiming

`ClaimTask`:

1. Reject if at capacity (`running >= max_concurrent_tasks`).
2. Atomically claim next task via `ClaimAgentTask`.
3. Set agent status toward **`working`** (`updateAgentStatus`).
4. Broadcast **`task:dispatch`** with workspace resolution (`broadcastTaskDispatch` may load issue, chat session, or autopilot context).

**Observability:** slow-path logging when claim latency exceeds ~300ms (structured breakdown of DB vs broadcast).

### 1.3 Chat task completion (transactional)

**Race addressed:** Chat resume pointers (`chat_session.session_id`, `work_dir`) must stay consistent with task completion so the next message does not resume a stale session.

**Implementation:** `CompleteTask` runs **`CompleteAgentTask` + `UpdateChatSessionSession` in one transaction** when `chat_session_id` is set (`internal/service/task.go`).

### 1.4 Task cancellation and agent status reconciliation

`CancelTask` updates the queue row, calls **`ReconcileAgentStatus`** to downgrade agent status when no active work remains, and emits **`task:cancelled`** (mapped to failed-style UI clearing per protocol).

### 1.5 Retry / lease / orphan recovery

Migration `055_task_lease_and_retry.up.sql` adds:

- **`attempt` / `max_attempts` / `parent_task_id`** for chained retries.
- **`failure_reason`** taxonomy (`agent_error`, `timeout`, `runtime_offline`, `runtime_recovery`, `manual`, …) for policy decisions.
- **`last_heartbeat_at`** for distinguishing stuck vs long-running tasks.

Daemon endpoints **`recover-orphans`** and server **runtime sweeper** cooperate to reset or respawn work when a daemon disappears mid-task (see `RecoverOrphanedTasks` handler and sweeper).

### 1.6 Autopilot scheduling

**Cron parsing:** `service.ComputeNextRun` uses **`github.com/robfig/cron/v3`** with a **5-field** parser (`cron.Minute | Hour | Dom | Month | Dow`) — `internal/service/cron.go`.

**Dispatch loop:** `runAutopilotScheduler` periodically calls `ClaimDueScheduleTriggers`, which **atomically claims due rows** by running an `UPDATE autopilot_trigger SET next_run_at = NULL … RETURNING` filtered to enabled schedule triggers whose `next_run_at <= now()` and whose parent autopilot is `active` (`server/pkg/db/queries/autopilot.sql`). After handling each claimed row, `advanceNextRun` recomputes the next fire time from the cron expression (`cmd/server/autopilot_scheduler.go`). (Task claiming elsewhere may use `FOR UPDATE SKIP LOCKED` — see `server/pkg/db/queries/agent.sql`.)

**Concurrency policies:** `skip` | `queue` | `replace` on the autopilot row govern behavior when a run is already active (enforced in `AutopilotService`).

### 1.7 Issue mention expansion

`mention.ExpandIssueIdentifiers` (`internal/mention/expand.go`):

1. Load workspace **`issue_prefix`**.
2. Regex match `PREFIX-(\d+)` with word-boundary hygiene.
3. Skip fenced code, inline code, and existing markdown links.
4. Resolve issue by `(workspace_id, number)` and replace with `mention://issue/<uuid>` links for rich rendering.

### 1.8 WebSocket hub

`realtime.Hub` maintains:

- **Rooms:** `workspaceID -> set(Client)`.
- **Control plane:** register/unregister/broadcast channels; goroutine `Run()` loop.
- **Heartbeat:** server pings on `pingPeriod`, client must pong within `pongWait` (`internal/realtime/hub.go` constants).

**Auth:** JWT (HMAC) validated with shared secret; PAT path for alternate clients.

### 1.9 In-process event bus

`events.Bus.Publish` invokes listeners **synchronously** in registration order; panics recovered per handler. This makes **listener registration order** meaningful (`main.go` documents subscriber-before-notification ordering).

### 1.10 Search (issues)

When `pg_bigm` is present, GIN indexes accelerate `LIKE '%term%'`-style queries for title/description. Without extension, migration no-ops with notice — CI/local must match expectations in `032_issue_search_index.up.sql`.

---

## 2. Go module dependencies (direct)

From `server/go.mod` — **why each matters**:

| Module | Role in Multica |
|--------|-----------------|
| `github.com/go-chi/chi/v5` | HTTP routing, route groups, URL params. |
| `github.com/go-chi/cors` | CORS for browser apps (`router.go`). |
| `github.com/jackc/pgx/v5` | PostgreSQL driver + connection pool (`pgxpool`), UUID/pgtype support. |
| `github.com/golang-jwt/jwt/v5` | Session JWT creation/validation (`internal/auth`, realtime). |
| `github.com/google/uuid` | UUID parsing/formatting at boundaries. |
| `github.com/gorilla/websocket` | WebSocket upgrade, framing, ping/pong. |
| `github.com/spf13/cobra` | `multica` CLI command tree. |
| `github.com/robfig/cron/v3` | Autopilot schedule evaluation. |
| `github.com/lmittmann/tint` | Structured/colorful slog handler (`internal/logger`). |
| `github.com/resend/resend-go/v2` | Transactional email for verification. |
| AWS SDK v2 (`config`, `credentials`, `s3`, `secretsmanager`) | File uploads to S3; optional secret loading in cloud deployments. |

**Tooling (not in go.mod but required in dev):** **`sqlc`** generates `server/pkg/db/generated/*` from SQL queries.

---

## 3. Frontend / Node dependencies (high level)

**Tooling:** `pnpm` workspaces, **Turborepo**, **TypeScript 5.9**, **Vitest**, **Playwright** (E2E), **ESLint**.

**Runtime libraries (catalog in `pnpm-workspace.yaml`):**

| Library | Role |
|---------|------|
| `react` / `react-dom` 19 | UI rendering (web + desktop). |
| `@tanstack/react-query` | Server state, cache invalidation from WS. |
| `zustand` | Client-only UI state. |
| `tailwindcss` 4 + `@tailwindcss/vite` / postcss | Styling pipeline. |
| `posthog-js` | Product analytics. |
| `lucide-react` | Icons. |
| `katex` + `remark-math` + `rehype-katex` | Math in markdown content. |

**Desktop:** Electron, `electron-vite` (see `apps/desktop/package.json` for exact versions).

---

## 4. External services

| Service | Usage |
|---------|-------|
| **PostgreSQL** | System of record. |
| **Resend** | Email OTP / notifications (`RESEND_API_KEY`). |
| **S3** | Durable uploads (optional). |
| **CloudFront** | Signed cookie helpers for CDN attachment delivery (optional). |
| **Google OAuth** | User authentication. |

---

## 5. Known “sharp edges” for readers of the code

1. **Synchronous event bus** — a slow listener delays all downstream listeners for that event; keep handlers fast or offload to goroutines with care.
2. **Single-hub memory model** — horizontal scaling of WebSocket requires sticky sessions or a shared pub/sub layer **not present in OSS** as of this doc (verify deployment docs for cloud).
3. **Optional pg_bigm** — search behavior differs between environments unless extension is installed.
4. **Task vs issue status** — completing a task does not automatically move the issue column; agents must update issue state explicitly.

---

## 6. Testing surfaces

- **Go:** `go test ./...` — handlers, services, agents (`server/pkg/agent/*_test.go`), integration tests under `cmd/server`.
- **TS:** Vitest per package; Playwright E2E under repo root `e2e/`.

This document should be updated when new background workers, claim strategies, or third-party SDKs are introduced.
