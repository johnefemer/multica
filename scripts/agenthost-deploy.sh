#!/usr/bin/env bash
# =============================================================================
# agenthost-deploy.sh — Deploy the latest main branch on an agenthost host
#
# Run manually over SSH. The checkout path and compose file list come from the
# host, so the same script serves both boxes:
#   ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 'bash /opt/multica/scripts/agenthost-deploy.sh'
#   ssh -i ~/.ssh/betopia.pem  root@162.4.35.231    'bash /opt/apps/agenthost/scripts/agenthost-deploy.sh'
#
# What it does:
#   1. Pulls latest changes from origin/main (or $BRANCH if overridden)
#   2. Rebuilds and restarts Docker Compose services (zero-downtime rolling)
#   3. Waits for the backend health-check
#   4. Prints status
# =============================================================================
set -euo pipefail

# Resolve the checkout from this script's own location, so the same script
# works on a host that installs to /opt/multica and one that uses
# /opt/apps/agenthost. $INSTALL_DIR still wins if the caller sets it.
INSTALL_DIR="${INSTALL_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

cd "$INSTALL_DIR"

# Per-host deploy settings (BRANCH, COMPOSE_FILES, HEALTH_URL). Untracked, so
# the `git reset --hard` below leaves it in place. A host fronted by a shared
# nginx-proxy sets:
#   COMPOSE_FILES="docker-compose.selfhost.yml docker-compose.proxy.yml"
if [ -f .deploy.env ]; then
  # shellcheck disable=SC1091
  . ./.deploy.env
fi

# Respect $BRANCH from caller (deploy.yml passes it); fall back to main
# (the active deploy line; kensink itself is held as a stable snapshot).
BRANCH="${BRANCH:-main}"
COMPOSE_FILES="${COMPOSE_FILES:-docker-compose.selfhost.yml}"
HEALTH_URL="${HEALTH_URL:-http://localhost:8080/health}"
HEALTH_RETRIES=30
HEALTH_INTERVAL=3

# Expand the file list once into repeated -f flags.
COMPOSE_ARGS=()
for f in $COMPOSE_FILES; do
  COMPOSE_ARGS+=(-f "$f")
done

echo "==> [$(date '+%Y-%m-%d %H:%M:%S')] Starting deploy of branch ${BRANCH}..."
echo "==> Checkout: ${INSTALL_DIR}  Compose: ${COMPOSE_FILES}"

# ---------- Pull latest code ------------------------------------------------
echo "==> Fetching origin/${BRANCH}..."
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"
echo "==> On commit: $(git log -1 --oneline)"

# ---------- Rebuild and restart ---------------------------------------------
echo "==> Building and restarting containers..."
docker compose "${COMPOSE_ARGS[@]}" pull --quiet 2>/dev/null || true
docker compose "${COMPOSE_ARGS[@]}" up -d --build --remove-orphans

# ---------- Health check ----------------------------------------------------
echo "==> Waiting for backend health check at ${HEALTH_URL}..."
for i in $(seq 1 "$HEALTH_RETRIES"); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "✓ Backend is healthy."
    break
  fi
  if [ "$i" -eq "$HEALTH_RETRIES" ]; then
    echo "✗ Health check timed out after $((HEALTH_RETRIES * HEALTH_INTERVAL))s."
    echo "  Check logs: docker compose ${COMPOSE_ARGS[*]} logs --tail=50"
    exit 1
  fi
  sleep "$HEALTH_INTERVAL"
done

# ---------- Show running containers -----------------------------------------
echo ""
echo "==> Running containers:"
docker compose "${COMPOSE_ARGS[@]}" ps

echo ""
echo "============================================================"
echo "  Deploy complete!"
echo "  Commit: $(git log -1 --oneline)"
echo "  Time:   $(date '+%Y-%m-%d %H:%M:%S UTC')"
echo "============================================================"
