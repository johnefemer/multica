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

That's it for 95% of cases. A GitHub Actions workflow rebuilds the backend and/or frontend images, pushes them to GHCR, SSHes to the EC2 server, pulls the new images, and restarts. Backend migrations apply automatically on container start.

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

| File changed | Workflow | Effect |
|---|---|---|
| `server/**`, `Dockerfile` | `build-kensink-images.yml` | Rebuilds **both** images, redeploys both |
| `apps/web/**`, `packages/**`, `Dockerfile.web` | `build-kensink-images.yml` | Rebuilds **both** images, redeploys both |
| `docker-compose.selfhost*.yml` | `build-kensink-images.yml` | Rebuilds both |
| Anything outside the path filter | None | No deploy — merge safely |

The workflow rebuilds both services on any match because the path filter is a single union; if you want to save ~2 min on a frontend-only change, the logic in [`build-kensink-images.yml`](../.github/workflows/build-kensink-images.yml) would need per-service path filters.

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

## Three ways to deploy

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

---

## Checklist before pushing a non-trivial change

- [ ] Migrations have a working `.down.sql`
- [ ] New env vars added to `docker-compose.selfhost.yml` (interpolate from `.env`)
- [ ] New env vars added to `/opt/multica/.env` on server *before* deploying code that needs them
- [ ] Go code compiles (`cd server && go build ./...`)
- [ ] If touching the frontend, `NEXT_PUBLIC_*` vars don't need rebuild args unless added to `build-args:` in [`build-kensink-images.yml`](../.github/workflows/build-kensink-images.yml)
- [ ] DB backup taken if the migration is destructive
