#!/usr/bin/env bash
# Agenthost by Kensink Labs — CLI installer
#
# Installs the agenthost CLI and pre-configures it to connect to
# https://agenthost.kensink.com.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AGENTHOST_SERVER_URL="https://agenthost.kensink.com"
AGENTHOST_RELEASE_URL="https://github.com/johnefemer/multica/releases/download/kensink-latest"

# Colors (disabled when not a terminal)
if [ -t 1 ] || [ -t 2 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  CYAN='\033[0;36m'
  RESET='\033[0m'
else
  BOLD='' GREEN='' YELLOW='' RED='' CYAN='' RESET=''
fi

info()  { printf "${BOLD}${CYAN}==> %s${RESET}\n" "$*"; }
ok()    { printf "${BOLD}${GREEN}✓ %s${RESET}\n" "$*"; }
warn()  { printf "${BOLD}${YELLOW}⚠ %s${RESET}\n" "$*" >&2; }
fail()  { printf "${BOLD}${RED}✗ %s${RESET}\n" "$*" >&2; exit 1; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

detect_os() {
  case "$(uname -s)" in
    Darwin) OS="darwin" ;;
    Linux)  OS="linux"  ;;
    MINGW*|MSYS*|CYGWIN*)
      fail "Windows is not supported. Use WSL2 or a Linux dev box." ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) fail "Unsupported architecture: $ARCH" ;;
  esac
}

install_cli_binary() {
  local url="$AGENTHOST_RELEASE_URL/agenthost-cli-${OS}-${ARCH}.tar.gz"
  local tmp_dir
  tmp_dir=$(mktemp -d)

  info "Downloading agenthost CLI for ${OS}/${ARCH} ..."
  curl -fsSL "$url" -o "$tmp_dir/agenthost.tar.gz" \
    || { rm -rf "$tmp_dir"; fail "Download failed. Check your network: $url"; }

  tar -xzf "$tmp_dir/agenthost.tar.gz" -C "$tmp_dir" agenthost 2>/dev/null \
    || { rm -rf "$tmp_dir"; fail "Could not extract binary from archive."; }

  chmod +x "$tmp_dir/agenthost"

  local bin_dir="/usr/local/bin"
  if [ -w "$bin_dir" ]; then
    mv "$tmp_dir/agenthost" "$bin_dir/agenthost"
  elif command_exists sudo; then
    sudo mv "$tmp_dir/agenthost" "$bin_dir/agenthost"
    sudo chmod +x "$bin_dir/agenthost"
  else
    bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    mv "$tmp_dir/agenthost" "$bin_dir/agenthost"
    export PATH="$bin_dir:$PATH"
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      [ -f "$rc" ] && ! grep -qF "$bin_dir" "$rc" && \
        printf '\n# Added by Agenthost installer\nexport PATH="%s:$PATH"\n' "$bin_dir" >> "$rc"
    done
    warn "Installed to $bin_dir — restart your shell or run: export PATH=\"$bin_dir:\$PATH\""
  fi
  rm -rf "$tmp_dir"
  ok "agenthost CLI installed → $bin_dir/agenthost"
}

install_or_upgrade_cli() {
  if command_exists agenthost; then
    local current_ver
    current_ver=$(agenthost version 2>/dev/null | awk '{print $2}' || echo "unknown")
    info "Reinstalling agenthost CLI (current: $current_ver) from kensink release..."
  fi

  install_cli_binary

  command_exists agenthost \
    || fail "'agenthost' not found on PATH. Run: export PATH=\"\$HOME/.local/bin:\$PATH\""
}

# Pre-write config so agenthost login and agenthost setup both target
# agenthost.kensink.com immediately — no extra flags needed.
# Write to both ~/.multica and ~/.agenthost to cover the installed binary
# (uses ~/.multica) and any future upgrade to our fork (uses ~/.agenthost).
write_default_config() {
  local config_json
  config_json="$(printf '{\n  "server_url": "%s",\n  "app_url": "%s"\n}\n' \
    "$AGENTHOST_SERVER_URL" "$AGENTHOST_SERVER_URL")"

  for config_dir in "$HOME/.multica" "$HOME/.agenthost"; do
    local config_file="$config_dir/config.json"
    mkdir -p "$config_dir"
    if [ ! -f "$config_file" ] || grep -q 'localhost\|multica\.ai\|api\.multica' "$config_file" 2>/dev/null; then
      printf '%s\n' "$config_json" > "$config_file"
      ok "Config written → $config_file"
    else
      ok "Existing config kept → $config_file"
    fi
  done
}

main() {
  printf "\n"
  printf "${BOLD}  Agenthost by Kensink Labs — CLI Installer${RESET}\n"
  printf "\n"

  detect_os
  install_or_upgrade_cli
  write_default_config

  printf "\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "${BOLD}${GREEN}  ✓ agenthost CLI installed!${RESET}\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  printf "  Connect to Agenthost by Kensink Labs:\n"
  printf "\n"
  printf "     ${CYAN}agenthost setup self-host${RESET}\n"
  printf "\n"
  printf "  Or log in directly if already configured:\n"
  printf "     ${CYAN}agenthost login${RESET}\n"
  printf "\n"
  printf "  ${BOLD}Requirements:${RESET}\n"
  printf "  • An AI coding tool: Claude Code, Cursor, Codex, or similar\n"
  printf "  • Network access to ${CYAN}%s${RESET}\n" "$AGENTHOST_SERVER_URL"
  printf "\n"
}

main "$@"
