// Kensink fork identity for the desktop app. Upstream call sites import these
// so each rename stays a one-line diff and future upstream syncs conflict less.

/** Product name shown in the OS (menu bar, dock, window class, dialogs). */
export const PRODUCT_NAME = "Agenthost";

/** Dev / worktree builds run side by side with an installed release. */
export const DEV_PRODUCT_NAME = `${PRODUCT_NAME} Canary`;

/** Reverse-DNS app id; must match `appId` in electron-builder.yml. */
export const APP_ID = "pro.agenthost.desktop";

/** Deep-link scheme; the web login and auth callback pages open `agenthost://`. */
export const DESKTOP_PROTOCOL = "agenthost";

/** The fork's CLI binary (built from server/cmd/multica). */
export const CLI_BINARY_NAME = "agenthost";

/** Per-user CLI state under $HOME, shared with the CLI (internal/cli CLIDirName). */
export const CLI_STATE_DIR = ".agenthost";

/** Rolling CLI release that scripts/kensink-install.sh also installs from. */
export const CLI_RELEASE_DOWNLOAD_BASE =
  "https://github.com/johnefemer/multica/releases/download/kensink-latest";

/** Public origin serving both the app and the API. */
export const PUBLIC_ORIGIN = "https://agenthost.pro";
