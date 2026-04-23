#!/usr/bin/env bash
# Agenthost by Kensink Labs — CLI installer
#
# Installs the agenthost CLI and pre-configures it to connect to
# the Agenthost self-hosted server at https://agenthost.kensink.com.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/johnefemer/multica/kensink/scripts/kensink-install.sh | bash
#
# After installation the config is pre-written; just run:
#   agenthost login
#
set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
AGENTHOST_SERVER_URL="https://agenthost.kensink.com"

# The CLI binary comes from the upstream Multica releases (same binary,
# works with any self-hosted backend). We install it as "agenthost".
UPSTREAM_REPO_WEB_URL="https://github.com/multica-ai/multica"

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

# Always install from the upstream binary release so we fully control the
# output binary name ("agenthost"). Homebrew installs it as "multica" and
# we have no way to rename that, so we skip Homebrew entirely.
install_cli_binary() {
  info "Downloading agenthost CLI from upstream releases..."
  local latest
  latest=$(get_latest_version)
  [ -n "$latest" ] || fail "Could not fetch latest release. Check your network connection."

  local version="${latest#v}"
  local url="$UPSTREAM_REPO_WEB_URL/releases/download/${latest}/multica-cli-${version}-${OS}-${ARCH}.tar.gz"
  local tmp_dir
  tmp_dir=$(mktemp -d)

  info "Downloading ${latest} for ${OS}/${ARCH} ..."
  curl -fsSL "$url" -o "$tmp_dir/multica.tar.gz" \
    || { rm -rf "$tmp_dir"; fail "Download failed. Check your network connection."; }

  # Archive may contain binary named "multica" or "agenthost" depending on release
  tar -xzf "$tmp_dir/multica.tar.gz" -C "$tmp_dir" agenthost 2>/dev/null \
    || tar -xzf "$tmp_dir/multica.tar.gz" -C "$tmp_dir" multica 2>/dev/null \
    || { rm -rf "$tmp_dir"; fail "Could not extract binary from archive."; }

  local extracted="$tmp_dir/agenthost"
  [ -f "$extracted" ] || extracted="$tmp_dir/multica"
  chmod +x "$extracted"

  # Install to /usr/local/bin (preferred) or ~/.local/bin as fallback
  local bin_dir="/usr/local/bin"
  if [ -w "$bin_dir" ]; then
    mv "$extracted" "$bin_dir/agenthost"
  elif command_exists sudo; then
    sudo mv "$extracted" "$bin_dir/agenthost"
    sudo chmod +x "$bin_dir/agenthost"
  else
    bin_dir="$HOME/.local/bin"
    mkdir -p "$bin_dir"
    mv "$extracted" "$bin_dir/agenthost"
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
    local current_ver latest_ver
    current_ver=$(agenthost version 2>/dev/null | awk '{print $2}' || echo "unknown")
    latest_ver=$(get_latest_version)
    local cur="${current_ver#v}" lat="${latest_ver#v}"
    if [ -z "$latest_ver" ] || [ "$cur" = "$lat" ]; then
      ok "agenthost CLI is already up to date ($current_ver)"
      return 0
    fi
    info "Upgrading $current_ver → $latest_ver ..."
    install_cli_binary
    ok "Upgraded to $(agenthost version 2>/dev/null | awk '{print $2}' || echo '?')"
    return 0
  fi

  install_cli_binary

  command_exists agenthost \
    || fail "'agenthost' not found on PATH. If you see this, run: export PATH=\"\$HOME/.local/bin:\$PATH\""
}

# Pre-write config so that agenthost login / agenthost setup self-host
# immediately targets agenthost.kensink.com instead of localhost.
#
# The upstream binary (which we rename to agenthost) stores config in
# ~/.multica/config.json — our fork changes it to ~/.agenthost, but that
# change only lives in the server Docker image, not in the released binary.
# We write BOTH paths so whichever config dir the binary actually reads, it
# finds the right URL, and a future binary upgrade to our fork also works.
write_default_config() {
  local config_json
  config_json="$(printf '{\n  "server_url": "%s",\n  "app_url": "%s"\n}\n' \
    "$AGENTHOST_SERVER_URL" "$AGENTHOST_SERVER_URL")"

  for config_dir in "$HOME/.multica" "$HOME/.agenthost"; do
    local config_file="$config_dir/config.json"
    mkdir -p "$config_dir"
    # Only overwrite if no existing config, or if it still points at localhost
    if [ ! -f "$config_file" ] || grep -q 'localhost' "$config_file" 2>/dev/null; then
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
  printf "  Log in and start the daemon:\n"
  printf "\n"
  printf "     ${CYAN}agenthost setup self-host --server-url %s${RESET}\n" "$AGENTHOST_SERVER_URL"
  printf "\n"
  printf "  Or if your shell config was just updated, restart it first:\n"
  printf "     ${CYAN}source ~/.zshrc   # or ~/.bashrc${RESET}\n"
  printf "\n"
  printf "  ${BOLD}Requirements on this machine:${RESET}\n"
  printf "  • An AI coding tool: Claude Code, Cursor, Codex, or similar\n"
  printf "  • Network access to ${CYAN}%s${RESET}\n" "$AGENTHOST_SERVER_URL"
  printf "\n"
}

main "$@"
