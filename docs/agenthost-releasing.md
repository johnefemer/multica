# Releasing to agenthost — Build & Deploy Process

> **Audience:** Anyone shipping a code change to `https://agenthost.kensink.com`.
>
> **Companion docs:**
> - [kensink-deploy.md](./kensink-deploy.md) — server topology, env vars, nginx, day-to-day ops
> - [kensink-runtime.md](./kensink-runtime.md) — CLI/daemon architecture (not the server)
>
> This doc is the *how* of shipping. Read `kensink-deploy.md` first for the *what* and *where*.

---

## TL;DR

```
git push origin kensink
```

That's it for 95% of cases. Two workflows fan out from the push:

1. **`build-kensink-images.yml`** — rebuilds the backend/frontend Docker images, pushes to GHCR, SSHes to EC2, pulls, restarts. Backend migrations apply automatically on container start.
2. **`release-cli.yml`** — rebuilds the `agenthost` CLI binary (4 platforms), replaces the rolling `kensink-latest` GitHub Release. [`kensink-install.sh`](../scripts/kensink-install.sh) downloads from that URL, so anyone running the install command gets the new CLI immediately.

Both fire in parallel on `server/**` changes. One push ships backend + CLI together.

> **Note:** The "Stack" section of [kensink-deploy.md](./kensink-deploy.md#L70-L79) mentions *upstream* `ghcr.io/multica-ai/*` images. That statement is outdated — the server now runs **kensink-forked** images from `ghcr.io/johnefemer/*:kensink`. This doc is authoritative on the release pipeline; update `kensink-deploy.md` when convenient.

---

## Release Pipeline (the one path to prod)

```
┌──────────────────────────────────────────────────────────────┐
│  Developer's machine                                         │
│  git push origin kensink                                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  GitHub — johnefemer/multica@kensink                         │
│  Triggers: .github/workflows/build-kensink-images.yml        │
│    • path filter: server/**, apps/web/**, packages/**,       │
│      Dockerfile, Dockerfile.web, docker-compose.selfhost*    │
└───────────────────────────┬──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│  Job: build-backend      │   │  Job: build-frontend     │
│  docker buildx push →    │   │  docker buildx push →    │
│  ghcr.io/johnefemer/     │   │  ghcr.io/johnefemer/     │
│    multica-backend:      │   │    multica-web:          │
│    {kensink, latest}     │   │    {kensink, latest}     │
└──────────────┬───────────┘   └──────────────┬───────────┘
               └──────────────┬───────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Job: deploy  (needs: [build-backend, build-frontend])       │
│  SSH → ubuntu@54.82.211.103                                  │
│  cd /opt/multica                                             │
│  docker compose -f docker-compose.selfhost.yml pull backend  │
│  docker compose ... up -d --no-deps backend                  │
│  docker compose ... pull frontend                            │
│  docker compose ... up -d --no-deps frontend                 │
│  docker image prune -f                                       │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Backend container startup                                   │
│  docker/entrypoint.sh                                        │
│    1. ./migrate up   ← applies any new migrations            │
│    2. exec ./server  ← starts the API                        │
└──────────────────────────────────────────────────────────────┘
```

### Trigger rules (which workflow fires when)

| File changed | `build-kensink-images.yml` (Docker → EC2) | `release-cli.yml` (GitHub Release) |
|---|:---:|:---:|
| `server/**` | ✓ rebuilds both images | ✓ republishes `kensink-latest` |
| `Dockerfile` | ✓ | — |
| `apps/web/**`, `packages/**`, `Dockerfile.web` | ✓ (rebuilds both, even though only web changed) | — |
| `docker-compose.selfhost*.yml` | ✓ | — |
| `scripts/kensink-install.sh` | — | ✓ |
| `docker-compose.datadog.yml`, docs, other scripts | — | — |

Key observations:
- `build-kensink-images.yml` rebuilds **both** services on any match because the path filter is a single union. For per-service filtering you'd need to split the workflow.
- `docker-compose.datadog.yml` is **not** in any path filter, so changes to it don't trigger a rebuild — intentional, since the Datadog agent is an independent container (see [Datadog agent deploy](#datadog-agent-deploy)).

---

## Image naming

Both images live in **GHCR under `johnefemer`**, not upstream `multica-ai`:

| Image | Registry path | Tags |
|---|---|---|
| Backend (Go) | `ghcr.io/johnefemer/multica-backend` | `:kensink`, `:latest` |
| Frontend (Next.js) | `ghcr.io/johnefemer/multica-web` | `:kensink`, `:latest` |

The server's `/opt/multica/.env` pins the image references:

```dotenv
MULTICA_BACKEND_IMAGE=ghcr.io/johnefemer/multica-backend
MULTICA_WEB_IMAGE=ghcr.io/johnefemer/multica-web
MULTICA_IMAGE_TAG=kensink
```

The compose file interpolates these into the `image:` field of each service ([docker-compose.selfhost.yml:32,66](../docker-compose.selfhost.yml#L32)). Never hard-code an image in the compose file; always use env indirection.

---

## Migrations

Migrations run **automatically** on backend container start via [docker/entrypoint.sh](../docker/entrypoint.sh):

```sh
#!/bin/sh
set -e
echo "Running database migrations..."
./migrate up
echo "Starting server..."
exec ./server
```

- You do **not** need to run `make migrate-up` against production.
- You do **not** need to SSH and trigger anything separately.
- Just include your `.up.sql` / `.down.sql` files in `server/migrations/` and push — they'll apply on the next backend restart.
- Rule of thumb: never push a migration in one commit and the Go code that depends on it in a later commit. Either bundle them or order the migration first so intermediate deploys don't crash.

### Verifying a migration applied

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker exec multica-postgres-1 psql -U multica -d multica \
     -c "SELECT version FROM schema_migrations;"'
```

Or check a specific constraint/column directly:

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker exec multica-postgres-1 psql -U multica -d multica \
     -c "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = '"'"'issue_origin_type_check'"'"';"'
```

---

## Three ways to deploy the app (backend/frontend)

> The Datadog agent and CLI have their own flows — see [Agenthost CLI release](#agenthost-cli-release) and [Datadog agent deploy](#datadog-agent-deploy) below.

| # | Flow | When to use |
|---|---|---|
| 1 | **Push to `origin/kensink`** → GHA auto-deploys | Default for every change |
| 2 | **Manually trigger `Deploy to agenthost` workflow** (`deploy.yml`) | Re-deploy without pushing new code — runs `scripts/agenthost-deploy.sh` on the server |
| 3 | **SSH + build on server** with the build override | Emergency hotfix, GHA broken, iterating on a Docker/infra change |

### Flow 1 — Standard (push)

```bash
git push origin kensink
# Watch the run:
gh run watch -R johnefemer/multica
```

Nothing else. If the workflow is green, prod is updated.

### Flow 2 — Re-deploy without a code change

Use the manual workflow from GitHub → Actions → **Deploy to agenthost** → Run workflow → type `deploy`. This runs [`scripts/agenthost-deploy.sh`](../scripts/agenthost-deploy.sh) which:

1. Pulls the latest `kensink` branch (already on the server)
2. Runs `docker compose ... up -d --build --remove-orphans`

⚠️ Note: that script's `--build` is a no-op for backend/frontend because `docker-compose.selfhost.yml` has no `build:` directive on those services — it only re-pulls the existing GHCR tag. So this flow is useful for restarting with the *current* image, not for shipping code.

### Flow 3 — On-server build (emergency only)

Use this when you need a deploy but can't/won't go through GHA. This is what builds from the `/opt/multica` checkout on EC2 instead of pulling from GHCR.

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 '
  set -e
  cd /opt/multica
  git fetch origin kensink
  git reset --hard origin/kensink

  docker compose \
    -f docker-compose.selfhost.yml \
    -f docker-compose.selfhost.build.yml \
    up -d --build backend

  # Wait for health
  for i in $(seq 1 30); do
    curl -sf http://localhost:8080/health >/dev/null 2>&1 && break
    sleep 2
  done

  docker logs multica-backend-1 --tail=40
'
```

Key detail: the extra `-f docker-compose.selfhost.build.yml` override adds a `build:` directive that retags the local build as `multica-backend:dev`. Without the override, `--build` has no effect.

**Caveat:** an on-server build produces a `:dev`-tagged image that lives only on that box. The next GHA deploy will overwrite it with the GHCR `:kensink` tag — which is fine and usually what you want. Don't rely on the on-server image surviving long-term.

---

## Agenthost CLI release

The `agenthost` CLI is the binary that developers install on their local machines to connect as a runtime (see [kensink-runtime.md](./kensink-runtime.md)). It ships as a **rolling GitHub Release** — `kensink-latest` — which is deleted and recreated on every push that changes `server/**` or `scripts/kensink-install.sh`.

### Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  git push origin kensink                                     │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  .github/workflows/release-cli.yml                           │
│    Matrix: {darwin, linux} × {amd64, arm64}                  │
│    Build: cd server && go build -o agenthost ./cmd/multica   │
│    Pack:  tar -czf agenthost-cli-<os>-<arch>.tar.gz          │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  release job                                                 │
│    gh release delete kensink-latest                          │
│    git push origin :refs/tags/kensink-latest                 │
│    gh release create kensink-latest --prerelease             │
│      --target kensink (points at current HEAD)               │
│      dist/*.tar.gz                                           │
└───────────────────────────┬──────────────────────────────────┘
                            │ downloads from
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  https://github.com/johnefemer/multica/releases/             │
│    download/kensink-latest/agenthost-cli-<os>-<arch>.tar.gz  │
└───────────────────────────┬──────────────────────────────────┘
                            │ referenced by
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  scripts/kensink-install.sh  (raw.githubusercontent.com URL) │
│    Detects OS/arch, downloads the matching tarball,          │
│    extracts `agenthost` to /usr/local/bin (or ~/.local/bin), │
│    writes ~/.multica/config.json pointing at                 │
│      https://agenthost.kensink.com                           │
└──────────────────────────────────────────────────────────────┘
```

### Binary name

The upstream CLI is called `multica`. The kensink build renames it to **`agenthost`** via `go build -o agenthost ./cmd/multica`. Both binaries share the same source at [`server/cmd/multica/`](../server/cmd/multica/). The rename is the only kensink customization — everything else is upstream code.

### User-facing install

From the onboarding flow (and [kensink-runtime.md § Installation](./kensink-runtime.md#installation-for-runtime-operators)):

```bash
curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
agenthost setup self-host --server-url https://agenthost.kensink.com
```

The install script uses a *fixed* URL — `kensink-latest` never changes. Every push that lands on kensink with a backend change silently upgrades every future install to the new binary. Existing installs need to re-run the install command to pick up the new version.

### Versioning model

There is **no** semver tagging of the kensink CLI. It's one rolling tag. Pros: zero ceremony, always "what's on kensink". Cons: no way for a client to pin to a specific build; no changelog beyond the commit log; every push overwrites the download URL.

If you ever need pinned builds:
1. Create a second workflow that fires on `v*-kensink` tags and publishes a non-rolling release (e.g. `v0.2.3-kensink`).
2. Point a separate install script (`kensink-install-pinned.sh`) at that tag.
3. Keep `kensink-latest` for the onboarding flow.

### Manually triggering a release

If you want to re-release without a code change (e.g. workflow fix, bumping the default server URL in `kensink-install.sh`):

**GitHub UI:** Actions → **Release CLI (kensink)** → Run workflow → branch `kensink` → Run.

**CLI:**
```bash
gh workflow run release-cli.yml -R johnefemer/multica --ref kensink
gh run watch -R johnefemer/multica
```

### Verifying a CLI release

```bash
# Latest release exists and points at the right commit
gh release view kensink-latest -R johnefemer/multica

# Direct download test (arm64 mac)
curl -fsSL -o /tmp/agenthost.tar.gz \
  https://github.com/johnefemer/multica/releases/download/kensink-latest/agenthost-cli-darwin-arm64.tar.gz
tar -tzf /tmp/agenthost.tar.gz   # should list "agenthost"

# End-to-end installer test
bash <(curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh)
agenthost version
```

### Upstream vs kensink CLI — don't confuse them

| | Upstream (`multica`) | Kensink (`agenthost`) |
|---|---|---|
| Source | `multica-ai/multica@main` | `johnefemer/multica@kensink` |
| Binary name | `multica` | `agenthost` |
| Release workflow | [`release.yml`](../.github/workflows/release.yml) | [`release-cli.yml`](../.github/workflows/release-cli.yml) |
| Trigger | `v*.*.*` tag on main | any push touching `server/**` |
| GitHub Release | `v0.1.23`, immutable | `kensink-latest`, rolling |
| Archive name | `multica-cli-<version>-<os>-<arch>.tar.gz` | `agenthost-cli-<os>-<arch>.tar.gz` |
| Distribution | GitHub Releases + `multica-ai/homebrew-tap` | GitHub Releases only |
| Install | `install.sh` or `brew install multica-ai/tap/multica` | `kensink-install.sh` |
| Default server | None (user configures) | `https://agenthost.kensink.com` prewired |

`CLAUDE.md` still describes the upstream tag-and-release flow ("A CLI release must accompany every Production deployment"). That doesn't apply to kensink — our CLI releases automatically on every relevant push.

---

## Datadog agent deploy

The Datadog agent (`dd-agent` container) runs alongside the main stack but is managed by a **separate** compose file, [`docker-compose.datadog.yml`](../docker-compose.datadog.yml). It is **not** covered by the main release pipeline, by design: the Datadog agent image (`gcr.io/datadoghq/agent:7`) is a third-party image, not built from our source.

### What triggers a Datadog agent change

Nothing automatic. Edits to `docker-compose.datadog.yml` are **not** in the path filter of `build-kensink-images.yml`, so a push won't redeploy it. You must SSH and apply the change manually. Most common reasons to redeploy:

- Rotating `DD_API_KEY`
- Changing `DD_SITE` (e.g. us5 → us1)
- Toggling features like `DD_SYSTEM_PROBE_ENABLED`
- Updating the agent major version in the `image:` tag

### Configuration split

- **Secrets** → `/opt/multica/.env` on the server (not in git). Currently: `DD_API_KEY`.
- **Non-secret config** → committed in `docker-compose.datadog.yml` (site, tags, log collection flags). Compose reads secrets via `${VAR:?...}` interpolation, which errors loudly if the `.env` var is missing — prevents a silent empty-key ship.

### Rotating `DD_API_KEY`

1. Generate a new key in Datadog → Organization Settings → API Keys.
2. Update `.env` on the server (don't echo the key in shell history):
   ```bash
   ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 bash << 'EOF'
   cd /opt/multica
   if grep -q '^DD_API_KEY=' .env; then
     sed -i "s|^DD_API_KEY=.*|DD_API_KEY=<NEW_KEY_HERE>|" .env
   else
     printf '\nDD_API_KEY=<NEW_KEY_HERE>\n' >> .env
   fi
   docker compose -f docker-compose.datadog.yml up -d --force-recreate datadog-agent
   EOF
   ```
3. Verify the new key is valid:
   ```bash
   ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
     'docker exec dd-agent agent status 2>&1 | grep -E "API key ending|API Key valid"'
   ```
   Expected: `API key ending with <last4>: API Key valid`.
4. **Revoke the old key** in Datadog UI. Until you do this, the old key is still a valid auth credential to Datadog and sits in your shell / git history.

### Restarting the agent (no config change)

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker compose -f /opt/multica/docker-compose.datadog.yml restart datadog-agent'
```

### Updating the agent major version

Edit the `image:` tag in `docker-compose.datadog.yml` (currently `gcr.io/datadoghq/agent:7`), commit, push. **Then** SSH and recreate:

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 '
  cd /opt/multica
  git pull origin kensink
  docker compose -f docker-compose.datadog.yml pull datadog-agent
  docker compose -f docker-compose.datadog.yml up -d --force-recreate datadog-agent
'
```

Because the compose file isn't in any workflow's path filter, the `git pull` is required — GHA will not bring the new tag down for you.

### Service vs container naming

A common trip-hazard: the **compose service name** is `datadog-agent`, but the **container name** is `dd-agent` (set via `container_name:` in the compose file). Use `datadog-agent` when issuing compose commands (`docker compose ... restart datadog-agent`) and `dd-agent` when issuing direct Docker commands (`docker logs dd-agent`, `docker exec dd-agent ...`).

### Verifying agent health

```bash
# Container is healthy
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker ps --filter name=dd-agent --format "{{.Names}}\t{{.Status}}"'

# Forwarder is shipping (not stuck/backoff)
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker exec dd-agent agent status 2>&1 | grep -E "API key ending|Transactions successfully"'

# No auth errors in recent logs
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker logs dd-agent --since 5m 2>&1 | grep -iE "forbidden|unauthori|invalid.key|401|403" || echo "clean"'
```

---

## Verifying a deploy

```bash
# Health endpoint
curl -sf https://agenthost.kensink.com/health

# Container status
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker compose -f /opt/multica/docker-compose.selfhost.yml ps'

# Backend logs (recent)
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker logs multica-backend-1 --tail=50'

# Which commit is deployed
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'cd /opt/multica && git log -1 --oneline'

# Which image digest is running
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker inspect multica-backend-1 --format "{{.Image}} {{.Config.Image}}"'
```

---

## Rollback

Two options depending on blast radius.

### Option A — redeploy a prior tag

Images are tagged `:kensink` (moving) and `:latest` (moving). Neither pins to a commit. To roll back, either:

- **Revert the bad commit**, push, and wait for GHA to rebuild (~2 min). This is the safest path — Git history stays linear.
- **Retag an older image in GHCR** to `:kensink` using `docker buildx imagetools create`, then run Flow 2 to pull it. Use only when you can't afford the build wait.

### Option B — rollback a migration

Migrations are **not** auto-reverted. If a migration breaks things:

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'docker exec -it multica-backend-1 ./migrate down 1'
```

Then redeploy the previous backend image (Option A). Every migration **must** ship with a working `.down.sql` — enforce in review.

---

## Backups

No automation yet. Before any risky migration (DDL that alters constraints, drops columns, etc.):

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  docker exec multica-postgres-1 \
    pg_dump -U multica multica | gzip > ~/multica-backup-\$(date +%Y%m%d-%H%M).sql.gz
"
```

Then `scp` it down if you want a local copy. See [kensink-deploy.md § Database backup](./kensink-deploy.md#L332-L341).

---

## Disk management

From [kensink-deploy.md:349](./kensink-deploy.md#L349) the EBS root was ~74% full at doc time. The GHA deploy job runs `docker image prune -f` after each release to reap dangling layers. If disk ever climbs past 85%:

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  'df -h / && docker system df && docker system prune -af --volumes'
```

⚠️ `--volumes` would wipe `multica_pgdata` and `multica_backend_uploads`. Use `docker system prune -af` (no `--volumes`) unless you've confirmed what will be deleted.

---

## Secrets & GHA setup

The auto-deploy step needs two GitHub Actions secrets on `johnefemer/multica`:

| Secret | Value |
|---|---|
| `AGENTHOST_SSH_KEY` | Contents of `~/.ssh/agenthost.pem` (the entire PEM, including header/footer) |
| `AGENTHOST_IP` | `54.82.211.103` |

Plus `GITHUB_TOKEN` (auto-provided) with `packages: write` — granted via the job's `permissions:` block.

---

## Common failure modes

| Symptom | Likely cause | Fix |
|---|---|---|
| GHA build succeeds, server still shows old code | `.env` on server has wrong image/tag | `ssh ... grep MULTICA_ /opt/multica/.env` — verify values match [kensink images](#image-naming) |
| Migration error on boot, backend crash-loops | Bad `.up.sql` or conflicting schema | `docker logs multica-backend-1` to see the Postgres error; if safe, `./migrate down 1` and redeploy a fix |
| Disk full mid-deploy | Layer accumulation | `docker system prune -af` then re-run deploy |
| Health stays unhealthy after deploy | App-level crash after migrations | Tail logs — usually an env var missing (`GITHUB_CLIENT_ID`, etc.) |
| `connection refused` on SSH from GHA | EC2 restarted, fresh fingerprint | The workflow does `ssh-keyscan` fresh each run, so this is rare. If persistent, check AWS Security Group still allows GHA runner IPs (they're wide) |
| `kensink-install.sh` gives `Download failed` | `release-cli.yml` didn't run or failed | Check `gh run list --workflow=release-cli.yml -R johnefemer/multica`; re-run it manually if needed |
| `agenthost version` shows an old build after install | User already had a binary, `install_or_upgrade_cli` path only reinstalls current — but install was successful. | Usually nothing — the script always overwrites. If truly stuck, `which agenthost` and remove stale copies in `~/.local/bin` and `/usr/local/bin` |
| `dd-agent` restarts in a loop, log says `You must set an DD_API_KEY` | `.env` on server missing/empty `DD_API_KEY` after a compose file change | `grep ^DD_API_KEY= /opt/multica/.env` — if empty, populate and `docker compose -f docker-compose.datadog.yml up -d --force-recreate datadog-agent` |
| Compose errors with `DD_API_KEY must be set in /opt/multica/.env` | Intended guardrail — no key set | Add `DD_API_KEY=<key>` to `.env`, then recreate the agent |

---

## Checklist before pushing a non-trivial change

- [ ] Migrations have a working `.down.sql`
- [ ] New env vars added to `docker-compose.selfhost.yml` (interpolate from `.env`)
- [ ] New env vars added to `/opt/multica/.env` on server *before* deploying code that needs them
- [ ] Go code compiles (`cd server && go build ./...`)
- [ ] If touching the frontend, `NEXT_PUBLIC_*` vars don't need rebuild args unless added to `build-args:` in [`build-kensink-images.yml`](../.github/workflows/build-kensink-images.yml)
- [ ] DB backup taken if the migration is destructive
- [ ] If the change affects CLI behavior (`server/cmd/multica/`, `server/internal/daemon/`), remember `release-cli.yml` will auto-publish the new binary — existing installs need `kensink-install.sh` re-run to pick it up
- [ ] If touching `docker-compose.datadog.yml`, remember no workflow will redeploy it — you must SSH and `docker compose ... up -d --force-recreate datadog-agent` manually
