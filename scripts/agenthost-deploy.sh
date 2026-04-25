#!/usr/bin/env bash
# =============================================================================
# agenthost-deploy.sh — Deploy latest kensink branch on the agenthost EC2
#
# Called by GitHub Actions (deploy.yml) or run manually on the server:
#   ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "cd /opt/multica && bash scripts/agenthost-deploy.sh"
#
# What it does:
#   1. Pulls latest changes from origin/kensink
#   2. Rebuilds and restarts Docker Compose services (zero-downtime rolling)
#   3. Waits for the backend health-check
#   4. Prints status
# =============================================================================
set -euo pipefail

INSTALL_DIR="/opt/multica"
# Respect $BRANCH from caller (deploy.yml passes it); fall back to kensink-v2
# (the active deploy line; kensink itself is held as a stable snapshot).
BRANCH="${BRANCH:-kensink-v2}"
COMPOSE_FILE="docker-compose.selfhost.yml"
HEALTH_URL="http://localhost:8080/health"
HEALTH_RETRIES=30
HEALTH_INTERVAL=3

cd "$INSTALL_DIR"

echo "==> [$(date '+%Y-%m-%d %H:%M:%S')] Starting deploy of branch ${BRANCH}..."

# ---------- Pull latest code ------------------------------------------------
echo "==> Fetching origin/${BRANCH}..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
echo "==> On commit: $(git log -1 --oneline)"

# ---------- Rebuild and restart ---------------------------------------------
echo "==> Building and restarting containers..."
docker compose -f "$COMPOSE_FILE" pull --quiet 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

# ---------- Health check ----------------------------------------------------
echo "==> Waiting for backend health check at ${HEALTH_URL}..."
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✓ Backend is healthy."
    break
  fi
  if [ "$i" -eq "$HEALTH_RETRIES" ]; then
    echo "✗ Health check timed out after $((HEALTH_RETRIES * HEALTH_INTERVAL))s."
    echo "  Check logs: docker compose -f ${COMPOSE_FILE} logs --tail=50"
    exit 1
  fi
  sleep "$HEALTH_INTERVAL"
done

# ---------- Show running containers -----------------------------------------
echo ""
echo "==> Running containers:"
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "============================================================"
echo "  Deploy complete!"
echo "  Commit: $(git log -1 --oneline)"
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
