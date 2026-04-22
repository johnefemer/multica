#!/usr/bin/env bash
# =============================================================================
# agenthost-setup.sh — One-time provisioning for the agenthost EC2 instance
#
# Run this ONCE on a fresh Ubuntu server:
#   ssh -i ~/.ssh/agenthost.pem ubuntu@54.82.211.103 "bash -s" < scripts/agenthost-setup.sh
#
# What it does:
#   1. Installs Docker + Docker Compose plugin
#   2. Adds the ubuntu user to the docker group
#   3. Clones this fork into /opt/multica
#   4. Creates /opt/multica/.env from .env.example with a generated JWT_SECRET
#   5. Creates a systemd service so the stack restarts on reboot
# =============================================================================
set -euo pipefail

REPO_URL="https://github.com/johnefemer/multica.git"
DEPLOY_BRANCH="kensink"
INSTALL_DIR="/opt/multica"
SERVICE_USER="ubuntu"

echo "==> Updating package index..."
sudo apt-get update -qq

echo "==> Installing dependencies..."
sudo apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  git \
  make \
  openssl

# ---------- Docker ----------------------------------------------------------
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  sudo systemctl enable docker
  sudo systemctl start docker
  sudo usermod -aG docker "$SERVICE_USER"
  echo "==> Docker installed. NOTE: log out and back in (or newgrp docker) before running docker without sudo."
else
  echo "==> Docker already installed — skipping."
fi

# ---------- Clone repo ------------------------------------------------------
if [ -d "$INSTALL_DIR/.git" ]; then
  echo "==> Repo already cloned at $INSTALL_DIR — skipping clone."
else
  echo "==> Cloning ${REPO_URL} (branch: ${DEPLOY_BRANCH}) into ${INSTALL_DIR}..."
  sudo git clone --branch "$DEPLOY_BRANCH" "$REPO_URL" "$INSTALL_DIR"
  sudo chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"
fi

# ---------- Environment file ------------------------------------------------
if [ ! -f "$INSTALL_DIR/.env" ]; then
  echo "==> Creating .env from .env.example..."
  cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
  JWT=$(openssl rand -hex 32)
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=${JWT}/" "$INSTALL_DIR/.env"
  echo ""
  echo "  ✓ .env created with a random JWT_SECRET."
  echo "  >>> Edit $INSTALL_DIR/.env before starting:"
  echo "      - RESEND_API_KEY (or leave empty for dev mode)"
  echo "      - FRONTEND_ORIGIN / MULTICA_APP_URL (set to your public domain)"
  echo "      - Any other secrets"
  echo ""
else
  echo "==> .env already exists — skipping generation."
fi

# ---------- Systemd service -------------------------------------------------
SERVICE_FILE="/etc/systemd/system/multica.service"
if [ ! -f "$SERVICE_FILE" ]; then
  echo "==> Installing systemd service..."
  sudo tee "$SERVICE_FILE" > /dev/null <<EOF
[Unit]
Description=Multica self-hosted stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/docker compose -f docker-compose.selfhost.yml up -d --build
ExecStop=/usr/bin/docker compose -f docker-compose.selfhost.yml down
TimeoutStartSec=300
User=${SERVICE_USER}

[Install]
WantedBy=multi-user.target
EOF
  sudo systemctl daemon-reload
  sudo systemctl enable multica
  echo "==> systemd service installed and enabled (multica.service)."
else
  echo "==> systemd service already exists — skipping."
fi

echo ""
echo "============================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Edit $INSTALL_DIR/.env with your real credentials"
echo "  2. Start the stack:"
echo "       sudo systemctl start multica"
echo "     OR (directly):"
echo "       cd $INSTALL_DIR && docker compose -f docker-compose.selfhost.yml up -d --build"
echo "  3. Check logs:"
echo "       docker compose -f docker-compose.selfhost.yml logs -f"
echo "============================================================"
