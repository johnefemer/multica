# Kensink Deployment — agenthost

This document covers the production deployment of Multica (kensink fork) on the
`agenthost` EC2 instance. It is the authoritative reference for how the stack is
deployed, how to access it, and how to operate it day-to-day.

---

## Server

| Property | Value |
|----------|-------|
| **Name** | agenthost |
| **Provider** | AWS EC2 |
| **IP** | `54.82.211.103` |
| **Domain** | `agenthost.kensink.com` |
| **OS** | Ubuntu 24.04 LTS (kernel 6.17.0-aws) |
| **SSH user** | `ubuntu` |
| **PEM key** | `~/.ssh/agenthost.pem` |
| **Install dir** | `/opt/multica` |
| **Git branch** | `kensink` (fork of `multica-ai/multica`) |

### SSH access

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103
# or via domain
ssh -i ~/.ssh/agenthost.pem ubuntu@agenthost.kensink.com
```

---

## Access URLs

| Service | URL |
|---------|-----|
| **Web app** | http://agenthost.kensink.com:3000 |
| **Backend API** | http://agenthost.kensink.com:8080 |
| **API health** | http://agenthost.kensink.com:8080/health |
| **WebSocket** | `ws://agenthost.kensink.com:8080/ws` |

### AWS Security Group — open ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP | SSH |
| 3000 | TCP | Next.js frontend |
| 8080 | TCP | Go backend API + WebSocket |
| 80 | TCP | Reserved for future reverse proxy (nginx/caddy) |
| 443 | TCP | Reserved for TLS termination |
| 5432 | TCP | PostgreSQL — **consider restricting to VPC only** |

---

## Stack

The stack runs via Docker Compose using pre-built upstream images from the
GitHub Container Registry. No local build is required on the server.

| Container | Image | Port |
|-----------|-------|------|
| `multica-postgres-1` | `pgvector/pgvector:pg17` | 5432 |
| `multica-backend-1` | `ghcr.io/multica-ai/multica-backend:latest` | 8080 |
| `multica-frontend-1` | `ghcr.io/multica-ai/multica-web:latest` | 3000 |

### Docker volumes (persistent data)

| Volume | Contents |
|--------|---------|
| `multica_pgdata` | PostgreSQL data directory |
| `multica_backend_uploads` | File uploads (`/app/data/uploads`) |

---

## Environment File

Location on server: `/opt/multica/.env`

```dotenv
# ── Database ─────────────────────────────────────────────────
POSTGRES_DB=multica
POSTGRES_USER=multica
POSTGRES_PASSWORD=multica
POSTGRES_PORT=5432
DATABASE_URL=postgres://multica:multica@localhost:5432/multica?sslmode=disable

# ── Server ───────────────────────────────────────────────────
APP_ENV=production
PORT=8080
JWT_SECRET=<generate with: openssl rand -hex 32>

# ── App URLs (domain-specific) ───────────────────────────────
MULTICA_APP_URL=http://agenthost.kensink.com:3000
FRONTEND_ORIGIN=http://agenthost.kensink.com:3000
CORS_ALLOWED_ORIGINS=http://agenthost.kensink.com:3000
NEXT_PUBLIC_API_URL=http://agenthost.kensink.com:8080
NEXT_PUBLIC_WS_URL=ws://agenthost.kensink.com:8080/ws
MULTICA_SERVER_URL=ws://localhost:8080/ws

# ── Email (Resend) ────────────────────────────────────────────
RESEND_API_KEY=<set on server — not committed>
RESEND_FROM_EMAIL=noreply@multica.ai

# ── Google OAuth (optional) ───────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://agenthost.kensink.com:3000/auth/callback
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# ── Storage (local upload mode) ───────────────────────────────
LOCAL_UPLOAD_DIR=./data/uploads
LOCAL_UPLOAD_BASE_URL=http://localhost:8080
S3_BUCKET=
S3_REGION=us-west-2

# ── Docker images ─────────────────────────────────────────────
MULTICA_IMAGE_TAG=latest
MULTICA_BACKEND_IMAGE=ghcr.io/multica-ai/multica-backend
MULTICA_WEB_IMAGE=ghcr.io/multica-ai/multica-web

# ── Signup controls ───────────────────────────────────────────
ALLOW_SIGNUP=true
ALLOWED_EMAIL_DOMAINS=
ALLOWED_EMAILS=

# ── Analytics (optional) ──────────────────────────────────────
POSTHOG_API_KEY=
ANALYTICS_DISABLED=

# ── Daemon defaults ───────────────────────────────────────────
MULTICA_DAEMON_POLL_INTERVAL=3s
MULTICA_DAEMON_HEARTBEAT_INTERVAL=15s
MULTICA_CODEX_PATH=codex
MULTICA_CODEX_TIMEOUT=20m
```

> **Never commit `.env`** — it contains `JWT_SECRET` and `RESEND_API_KEY`.
> Edit it directly on the server at `/opt/multica/.env`.

---

## How It Was Deployed

### One-time setup (already done)

Docker was pre-installed on the EC2 instance. The repo was cloned and `.env`
configured manually:

```bash
# 1. Clone kensink branch
sudo git clone --branch kensink https://github.com/johnefemer/multica.git /opt/multica
sudo chown -R ubuntu:ubuntu /opt/multica

# 2. Create .env
cd /opt/multica
cp .env.example .env
# Set JWT_SECRET, RESEND_API_KEY, domain URLs — see Environment File section above

# 3. Start the stack
docker compose -f docker-compose.selfhost.yml up -d

# 4. Install systemd service (auto-start on reboot)
sudo systemctl enable multica
```

### Systemd service

The `multica.service` systemd unit ensures the stack comes back up after a
reboot. Service file: `/etc/systemd/system/multica.service`

```bash
sudo systemctl status multica    # check status
sudo systemctl start multica     # start manually
sudo systemctl stop multica      # stop manually
sudo systemctl restart multica   # restart
```

---

## Docker Container Health Checks

### Quick status

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "docker compose -f /opt/multica/docker-compose.selfhost.yml ps"
```

### Full health check (all services)

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  echo '── Containers ──'
  docker compose -f /opt/multica/docker-compose.selfhost.yml ps

  echo ''
  echo '── Backend health ──'
  curl -sf http://localhost:8080/health && echo ' OK' || echo ' FAIL'

  echo ''
  echo '── Frontend health ──'
  curl -sf -o /dev/null -w 'HTTP %{http_code}\n' http://localhost:3000

  echo ''
  echo '── Postgres health ──'
  docker exec multica-postgres-1 pg_isready -U multica && echo 'OK' || echo 'FAIL'
"
```

### View logs

```bash
# All services
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "docker compose -f /opt/multica/docker-compose.selfhost.yml logs --tail=50"

# Backend only (most useful for debugging auth/API issues)
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "docker logs multica-backend-1 --tail=50 -f"

# Frontend only
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "docker logs multica-frontend-1 --tail=50 -f"
```

---

## Day-to-Day Operations

### Deploy latest kensink changes

**Via GitHub Actions (recommended):**
1. Go to **Actions → Deploy to agenthost → Run workflow**
2. Branch: `kensink`, type `deploy` → Run

**Manually from your machine:**
```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 \
  "bash /opt/multica/scripts/agenthost-deploy.sh"
```

### Update a single env var

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  sed -i 's/^RESEND_API_KEY=.*/RESEND_API_KEY=your-new-key/' /opt/multica/.env
  docker compose -f /opt/multica/docker-compose.selfhost.yml restart backend
"
```

### Restart the stack

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  docker compose -f /opt/multica/docker-compose.selfhost.yml restart
"
```

### Full stop and start

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  cd /opt/multica
  docker compose -f docker-compose.selfhost.yml down
  docker compose -f docker-compose.selfhost.yml up -d
"
```

### Pull latest upstream images

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  cd /opt/multica
  docker compose -f docker-compose.selfhost.yml pull
  docker compose -f docker-compose.selfhost.yml up -d
"
```

### Database backup

```bash
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "
  docker exec multica-postgres-1 \
    pg_dump -U multica multica | gzip > ~/multica-backup-\$(date +%Y%m%d).sql.gz
"
# Copy backup locally
scp -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103:~/multica-backup-*.sql.gz .
```

---

## Disk & Resource Usage

| Metric | Value (at deploy time) |
|--------|----------------------|
| Disk used | 5.0 GB / 6.8 GB (74%) |
| Disk free | ~1.8 GB |
| Backend image | 72 MB |
| Frontend image | 357 MB |

> **Disk is 74% full.** Consider resizing the EBS volume or cleaning up Docker
> build cache (`docker system prune`) if it gets above 85%.

```bash
# Check current disk
ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "df -h / && docker system df"
```

---

## Known Limitations

- **`NEXT_PUBLIC_WS_URL` is baked into the upstream pre-built image** at build
  time. If the WebSocket connection from the browser fails, you'll need to build
  the frontend image locally from source (using `Dockerfile.web`) so the
  kensink domain compiles in. See `scripts/agenthost-deploy.sh` for a
  `--build` flag option.
- **No TLS yet.** All traffic runs over plain HTTP. Add a reverse proxy
  (nginx/caddy) on ports 80/443 with Let's Encrypt to enable HTTPS.
- **No automated backups.** Set up a cron job or AWS Backup for the
  `multica_pgdata` volume.
