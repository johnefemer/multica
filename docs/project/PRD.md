# Multica — Product Requirements Document (PRD)

**Document type:** Engineering PRD aligned to the **current open-source codebase** (`multica-ai/multica`).  
**Audience:** Product engineers, architects, and contributors.  
**Status:** Descriptive (as-built) with explicit **gaps and assumptions** where the code does not fully specify product intent.

---

## 1. Vision and positioning

### 1.1 Problem statement

Small AI-native teams (roughly **2–10 people**) need issue tracking where **coding agents are first-class**: assignable, accountable, observable, and reusable — not ad-hoc shell scripts or copy-pasted prompts.

### 1.2 Product thesis

Multica provides **managed agent operations**: a shared board, inbox, chat, skills, and runtimes so humans and agents collaborate on the same **issues**, **comments**, and **execution traces**, with **local** and **cloud** runtimes under one model.

### 1.3 Competitive framing (non-binding)

- **Versus generic PM tools:** native agent identity, task queue, daemon protocol, and skill library.
- **Versus IDE-only agents:** centralized visibility, team-wide skills, workspace isolation, optional cloud coordination.

---

## 2. Goals and non-goals

### 2.1 Goals (evidenced in code)

| Goal | Evidence |
|------|----------|
| Workspace-isolated multi-tenancy | `workspace`, `member`, slug routing, WS rooms by workspace UUID. |
| Human + agent collaboration | `assignee_type`, `author_type`, `creator_type` polymorphic columns; agent profiles. |
| Reliable task lifecycle | `agent_task_queue`, state machine, cancel, rerun, retry columns, orphan recovery endpoints. |
| Real-time UX | WebSocket hub + `pkg/protocol` event vocabulary; React Query invalidation pattern in `CLAUDE.md`. |
| Extensible agent ecosystem | `pkg/agent.Backend` with multiple CLI backends. |
| Automation | Autopilot + cron scheduler + triggers (schedule/webhook/API). |
| Self-host path | Docker/self-host docs, S3/local storage duality, configurable auth. |

### 2.2 Non-goals (implicit from architecture)

- **Not a source host:** repo metadata is `workspace.repos` JSON and daemon context — Git hosting is external.
- **Not a full IAM suite:** roles are `owner` / `admin` / `member`; fine-grained ACLs beyond workspace scope are not modeled.
- **Not guaranteed multi-region WS:** hub is in-process; scale-out needs additional design.
- **Not an LLM provider:** models are selected per agent/runtime configuration; inference is delegated to vendor CLIs.

---

## 3. Personas

### 3.1 Engineering lead (primary buyer/user)

- Sets up workspace, invites humans, connects runtimes, defines skills and autopilots.
- Needs auditability (activity log), usage summaries, and stable agent operations.

### 3.2 Individual contributor (human)

- Works issues, comments, @mentions agents, subscribes to issues, uses chat for ad-hoc agent sessions.
- Needs fast board, search, and clear task status on assigned agents.

### 3.3 Agent operator

- Maintains daemons on developer machines or CI-like hosts; upgrades CLI tools; monitors runtime health (ping/update/models).
- Needs deterministic task claim, recovery from crashes, and transparent logs/messages.

### 3.4 Self-hosted admin

- Runs Postgres, configures JWT/email/S3, manages deployments (see `SELF_HOSTING.md`).
- Needs health endpoints, migration story, and clear env var surface (`main.go` warnings for secrets).

---

## 4. User journeys (happy paths)

### 4.1 Onboard a workspace

1. User signs up (email code or Google).
2. Creates workspace; receives slug and issue prefix.
3. Invites teammates via email invitation flow.
4. Optional: import starter content (`/api/me/starter-content/import`).

**Success criteria:** workspace visible in list; members can open board; slug resolves in WS URL.

### 4.2 Connect a runtime and agent

1. User installs CLI / daemon.
2. Authenticates (`cli-token`, PAT, or OAuth session — depending on path).
3. Daemon registers against server; runtime row shows **online**.
4. User creates agent bound to runtime; sets concurrency and model/config.

**Success criteria:** heartbeat updates `last_seen_at`; daemon can list pending tasks.

### 4.3 Execute work on an issue

1. Human assigns issue to agent (or mentions agent in comment).
2. Server enqueues `agent_task_queue` row with priority derived from issue priority.
3. Daemon claims task for runtime; receives dispatch over WS; starts agent subprocess.
4. Agent streams messages; human sees progress; task completes or fails with reason.
5. Human or agent updates issue status/comments as appropriate.

**Success criteria:** end-to-end events: `task:dispatch`, `task:progress`, `task:completed` | `task:failed` | `task:cancelled`.

### 4.4 Chat session

1. User opens chat with agent; sends message.
2. Server enqueues **chat task** (`chat_session_id` set; `issue_id` null).
3. Daemon executes; on completion, **session resume pointers** updated transactionally.

**Success criteria:** follow-up message resumes same agent session without losing context.

### 4.5 Autopilot

1. Admin creates autopilot targeting agent + optional project.
2. Adds schedule trigger (cron + timezone) or external trigger.
3. Scheduler claims due triggers; creates run; optionally creates issue; enqueues task per **concurrency_policy**.

**Success criteria:** `autopilot_run` row transitions to terminal state; inbox/activity reflect failures.

---

## 5. Functional requirements

### 5.1 Tenancy and permissions

- **FR-T1:** Every workspace-scoped API MUST enforce membership via middleware (`RequireWorkspaceMember`, role gates).
- **FR-T2:** Workspace owner MAY delete workspace; admins MAY manage invites and workspace settings.
- **FR-T3:** Issue numbers MUST be unique per workspace (`uq_issue_workspace_number`).

### 5.2 Issues and workflow

- **FR-I1:** Issues MUST support status, priority, assignee (member or agent), parent/child, labels, dependencies, due dates.
- **FR-I2:** API MUST support batch update/delete for board operations.
- **FR-I3:** Search MUST return relevant issues; when `pg_bigm` installed, use bigram indexes (migration `032`).

### 5.3 Agents and runtimes

- **FR-A1:** Each agent MUST reference a valid `runtime_id`.
- **FR-A2:** `max_concurrent_tasks` MUST be enforced before claim (`ClaimTask`).
- **FR-A3:** Archived agents MUST NOT enqueue new tasks (`EnqueueTaskForIssue` guards).
- **FR-A4:** Daemon API MUST authenticate via daemon middleware (`/api/daemon/*`).

### 5.4 Task queue

- **FR-Q1:** Tasks MUST be claimable per runtime with per-agent fairness properties defined by `ClaimTaskForRuntime` (probe distinct agents).
- **FR-Q2:** Users MUST be able to cancel active tasks; system MUST reconcile agent status afterward.
- **FR-Q3:** Chat completions MUST update session pointers atomically with task completion.

### 5.5 Real-time

- **FR-R1:** Workspace clients MUST receive WS events for task progress and entity mutations defined in `pkg/protocol`.
- **FR-R2:** WS MUST reject disallowed origins consistently with CORS configuration.

### 5.6 Skills

- **FR-S1:** Workspace skills MUST support multiple files and many-to-many attachment to agents.
- **FR-S2:** Skill names MUST be unique per workspace.

### 5.7 Autopilot

- **FR-P1:** Schedule triggers MUST compute `next_run_at` using `robfig/cron` parser (`service.ComputeNextRun`).
- **FR-P2:** Scheduler MUST avoid double execution via atomic claim on schedule rows (`ClaimDueScheduleTriggers` clears `next_run_at` in a single `UPDATE … RETURNING` for due triggers).
- **FR-P3:** Autopilot MUST record runs with status suitable for UI history.

### 5.8 Notifications

- **FR-N1:** Inbox MUST support read/archive and batch operations.
- **FR-N2:** Activity log MUST capture major domain actions (listeners in `activity_listeners.go`).

### 5.9 Files

- **FR-F1:** Uploads MUST support S3 or local storage; attachments MUST store metadata row + URL.

---

## 6. Non-functional requirements

| ID | Requirement | Implementation notes |
|----|-------------|------------------------|
| NFR-1 | **Security:** JWT secret required in prod | `main.go` warns if missing. |
| NFR-2 | **Privacy:** workspace isolation at data layer | FK cascades scoped by `workspace_id`. |
| NFR-3 | **Observability:** structured logs | `slog` + tint; slow claim logs. |
| NFR-4 | **Reliability:** DB migrations versioned | `server/migrations`. |
| NFR-5 | **Performance:** indexed hot paths | pending task partial indexes, issue workspace indexes. |
| NFR-6 | **DX:** single dev entry | `make dev` per `CLAUDE.md`. |

---

## 7. Data model summary

See [database-schema.md](./database-schema.md). PRD-level invariants:

- **Agents** bind to **runtimes**; **tasks** bind to **runtimes** for claim routing.
- **Issues** optionally belong to **projects**; **autopilot** may create issues with **origin** metadata.
- **Chat** tasks nullable `issue_id` with `chat_session_id` set.

---

## 8. API and protocol contracts

- **REST:** Chi routes in `server/cmd/server/router.go`.
- **WS events:** constants in `server/pkg/protocol/events.go` — treat additions as **semver-sensitive** for clients.
- **Daemon protocol:** mirror endpoints under `/api/daemon` for claim/progress/complete and runtime maintenance.

---

## 9. Metrics and success measures (suggested)

The codebase includes usage endpoints and analytics hooks; product metrics should include:

- **Activation:** first runtime online + first completed task per workspace.
- **Reliability:** task failure rate by `failure_reason`; orphan recovery frequency.
- **Engagement:** issues updated by agents vs humans; chat sessions per week.
- **Automation:** autopilot runs succeeded / skipped / failed.

Exact instrumentation lives in `internal/analytics` and frontend Posthog — align PRD KPIs with deployed environment.

---

## 10. Risks and open questions

| Risk | Mitigation / note |
|------|-------------------|
| WS hub not sharded | Document scale limits; consider Redis/NATS for multi-instance. |
| Synchronous event bus | Keep listeners lean; measure publish latency. |
| Optional `pg_bigm` | Align staging/prod extension set with search expectations. |
| Agent CLI drift | Version detection endpoints; daemon update/ping flows. |
| Task vs issue status gap | UX education; future automation policies if desired. |

---

## 11. Release and compatibility

- **Server:** Go **1.26.1** (`go.mod`).
- **Frontend:** Node **22** in CI (`CLAUDE.md`).
- **Database:** PostgreSQL **17** with optional **pgvector** image for dev/CI.

---

## 12. Glossary

| Term | Meaning |
|------|---------|
| **Workspace** | Tenant container for issues, agents, skills. |
| **Runtime** | Connected execution endpoint (usually one daemon installation). |
| **Agent** | Logical teammate profile + configuration; consumes tasks. |
| **Task** | Row in `agent_task_queue` representing one execution unit. |
| **Daemon** | Local process bridging server to OS + agent CLIs. |
| **Skill** | Workspace-level reusable instruction/asset bundle. |
| **Autopilot** | Scheduled or triggered automation creating runs/issues/tasks. |

---

## 13. Related documentation

- [architecture.md](./architecture.md) — system decomposition.
- [features.md](./features.md) — feature-to-route map.
- [algorithms-and-dependencies.md](./algorithms-and-dependencies.md) — claiming, scheduling, dependencies.
- Repository guides: `CLAUDE.md`, `README.md`, `SELF_HOSTING.md`, `CONTRIBUTING.md`.

---

**Maintainers:** update this PRD when migrations or protocol constants change in ways that affect user-visible contracts or operational guarantees.
