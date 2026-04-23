#!/usr/bin/env bash
# Agenthost by Kensink Labs — CLI installer
#
# Installs the Multica CLI and pre-configures it to connect to
# the Agenthost self-hosted server at https://agenthost.kensink.com.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
#
# After installation, run the printed setup command to authenticate.
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AGENTHOST_SERVER_URL="https://agenthost.kensink.com"
AGENTHOST_APP_URL="https://agenthost.kensink.com"

# The CLI binary comes from the upstream Multica releases (same binary,
# works with any self-hosted backend).
UPSTREAM_REPO_WEB_URL="https://github.com/multica-ai/multica"
BREW_PACKAGE="multica-ai/tap/multica"

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
      fail "Windows is not supported by this script. Use WSL2 or a Linux dev box." ;;
    *) fail "Unsupported OS: $(uname -s)" ;;
  esac
  ARCH="$(uname -m)"
  case "$ARCH" in
    x86_64)  ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) fail "Unsupported architecture: $ARCH" ;;
  esac
}

get_latest_version() {
  curl -sI "$UPSTREAM_REPO_WEB_URL/releases/latest" 2>/dev/null \
    | grep -i '^location:' | sed 's/.*tag\///' | tr -d '\r\n' || true
}

install_cli_binary() {
  info "Installing Multica CLI from upstream releases..."
  local latest
  latest=$(get_latest_version)
  [ -n "$latest" ] || fail "Could not fetch latest release. Check your network connection."

  local version="${latest#v}"
  local url="$UPSTREAM_REPO_WEB_URL/releases/download/${latest}/multica-cli-${version}-${OS}-${ARCH}.tar.gz"
  local tmp_dir
  tmp_dir=$(mktemp -d)

  info "Downloading $url ..."
  curl -fsSL "$url" -o "$tmp_dir/multica.tar.gz" \
    || { rm -rf "$tmp_dir"; fail "Download failed."; }
  tar -xzf "$tmp_dir/multica.tar.gz" -C "$tmp_dir" agenthost 2>/dev/null \
    || tar -xzf "$tmp_dir/multica.tar.gz" -C "$tmp_dir" multica 2>/dev/null \
    || { rm -rf "$tmp_dir"; fail "Could not extract binary from archive."; }

  # Support both agenthost and multica binary names in the archive
  local extracted="$tmp_dir/agenthost"
  [ -f "$extracted" ] || extracted="$tmp_dir/multica"

  local bin_dir="/usr/local/bin"
  if [ -w "$bin_dir" ]; then
    mv "$extracted" "$bin_dir/agenthost"
  elif command_exists sudo; then
    sudo mv "$extracted" "$bin_dir/agenthost"
  else
    bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    mv "$extracted" "$bin_dir/agenthost"
    chmod +x "$bin_dir/agenthost"
    export PATH="$bin_dir:$PATH"
    for rc in "$HOME/.bashrc" "$HOME/.zshrc"; do
      [ -f "$rc" ] && ! grep -qF "$bin_dir" "$rc" && \
        printf '\n# Added by Agenthost installer\nexport PATH="%s:$PATH"\n' "$bin_dir" >> "$rc"
    done
  fi
  rm -rf "$tmp_dir"
  ok "Agenthost CLI installed to $bin_dir/agenthost"
}

install_cli_brew() {
  info "Installing Multica CLI via Homebrew..."
  brew tap multica-ai/tap 2>/dev/null || fail "Failed to add Homebrew tap."
  brew install "$BREW_PACKAGE" 2>/dev/null \
    || brew list "$BREW_PACKAGE" >/dev/null 2>&1 \
    || fail "Homebrew install failed."
  ok "Multica CLI installed via Homebrew"
}

install_or_upgrade_cli() {
  if command_exists agenthost; then
    local current_ver latest_ver
    current_ver=$(agenthost version 2>/dev/null | awk '{print $2}' || echo "unknown")
    latest_ver=$(get_latest_version)
    local cur="${current_ver#v}" lat="${latest_ver#v}"
    if [ -z "$latest_ver" ] || [ "$cur" = "$lat" ]; then
      ok "Agenthost CLI is up to date ($current_ver)"
      return 0
    fi
    info "Upgrading $current_ver → $latest_ver ..."
    if command_exists brew && brew list "$BREW_PACKAGE" >/dev/null 2>&1; then
      brew upgrade "$BREW_PACKAGE" 2>/dev/null || ok "Already up to date"
    else
      install_cli_binary
    fi
    ok "Upgraded to $(agenthost version 2>/dev/null | awk '{print $2}' || echo '?')"
    return 0
  fi

  if command_exists brew; then
    install_cli_brew
  else
    install_cli_binary
  fi

  command_exists agenthost \
    || fail "'agenthost' not found on PATH after install. Restart your shell and try again."
}

main() {
  printf "\n"
  printf "${BOLD}  Agenthost by Kensink Labs — CLI Installer${RESET}\n"
  printf "\n"

  detect_os
  install_or_upgrade_cli

  printf "\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "${BOLD}${GREEN}  ✓ CLI ready! Connect to Agenthost:${RESET}\n"
  printf "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
  printf "\n"
  printf "  Run this to authenticate and start the daemon:\n"
  printf "\n"
  printf "     ${CYAN}agenthost setup self-host${RESET}\n"
  printf "\n"
  printf "  To use a different server:\n"
  printf "     ${CYAN}agenthost setup self-host --server-url <url>${RESET}\n"
  printf "\n"
  printf "  ${BOLD}Requirements on this machine:${RESET}\n"
  printf "  • An AI coding tool: Claude Code, Cursor, Codex, or similar\n"
  printf "  • Network access to ${CYAN}%s${RESET}\n" "$AGENTHOST_SERVER_URL"
  printf "\n"
}

main "$@"
