import { useState, useEffect, useCallback, useRef } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowUpCircle,
  Check,
  Lock,
  ChevronDown,
  ChevronRight,
  Copy,
  Terminal,
} from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { api } from "@multica/core/api";
import type { RuntimeUpdateStatus } from "@multica/core/types";
import { useT } from "../../i18n";

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/johnefemer/multica/releases/latest";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

let cachedLatestVersion: string | null = null;
let cachedAt = 0;

async function fetchLatestVersion(): Promise<string | null> {
  if (cachedLatestVersion && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedLatestVersion;
  }
  try {
    const resp = await fetch(GITHUB_RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    cachedLatestVersion = data.tag_name ?? null;
    cachedAt = Date.now();
    return cachedLatestVersion;
  } catch {
    return null;
  }
}

/**
 * Parses a released CLI version ("v0.4.17" / "0.4.17") into comparable parts,
 * or null when the string is not a release version.
 *
 * A daemon built from source reports a `git describe` string
 * ("v0.4.17-12-gabc1234") or the ldflags default ("dev"), and neither can be
 * ordered against a release tag. This mirrors `IsReleaseVersion` in
 * server/internal/cli/update.go, which is how the daemon's own auto-update
 * loop decides the same question.
 */
function parseReleaseVersion(v: string): number[] | null {
  const parts = v.trim().replace(/^v/, "").split(".");
  if (parts.length !== 3) return null;
  const parsed: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    parsed.push(Number(part));
  }
  return parsed;
}

/**
 * True when `latest` is strictly newer than `current`.
 *
 * An unparseable version on either side compares as "no update available".
 * Number("dev") is NaN, and every NaN comparison is false, so the old
 * component-wise scan fell through to the next component and reported an
 * upgrade for a version string it had never actually read — inviting the
 * operator to replace a locally built binary on the strength of a claim we
 * could not make.
 */
function isNewer(latest: string, current: string): boolean {
  const l = parseReleaseVersion(latest);
  const c = parseReleaseVersion(current);
  if (!l || !c) return false;
  for (const [i, lv] of l.entries()) {
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

const statusConfig: Record<
  RuntimeUpdateStatus,
  { icon: typeof Loader2; color: string }
> = {
  pending: { icon: Loader2, color: "text-muted-foreground" },
  running: { icon: Loader2, color: "text-info" },
  completed: { icon: CheckCircle2, color: "text-success" },
  failed: { icon: XCircle, color: "text-destructive" },
  timeout: { icon: XCircle, color: "text-warning" },
};

// Manual update commands shown when in-app self-update fails (commonly: the
// daemon process can't write to the binary's install dir without sudo) or
// when the user just prefers to run the upgrade themselves.
const MANUAL_BREW_CMD = "brew upgrade multica-ai/tap/multica";
const MANUAL_UNIX_CMD = `OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=amd64
LATEST=$(curl -sI https://github.com/johnefemer/multica/releases/latest \\
  | grep -i '^location:' | sed 's/.*tag\\///' | tr -d '\\r\\n')
curl -sL "https://github.com/johnefemer/multica/releases/download/\${LATEST}/agenthost-cli-\${OS}-\${ARCH}.tar.gz" \\
  -o /tmp/multica.tar.gz
tar -xzf /tmp/multica.tar.gz -C /tmp multica
sudo mv /tmp/multica /usr/local/bin/multica && rm /tmp/multica.tar.gz`;
const MANUAL_WINDOWS_CMD =
  "irm https://raw.githubusercontent.com/johnefemer/multica/main/scripts/install.ps1 | iex";

function CopyCmdButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      aria-label="Copy command"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function ManualCmd({ label, cmd }: { label: string; cmd: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-foreground">{label}</p>
      <div className="flex items-start gap-2 rounded-md bg-muted px-2.5 py-2 font-mono text-xs">
        <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <code className="min-w-0 flex-1 whitespace-pre-wrap break-all">
          {cmd}
        </code>
        <CopyCmdButton text={cmd} />
      </div>
    </div>
  );
}

function ManualUpdateGuide({ openByDefault }: { openByDefault: boolean }) {
  const [open, setOpen] = useState(openByDefault);
  // Re-open if the parent flips to a failure state after the user had it closed.
  useEffect(() => {
    if (openByDefault) setOpen(true);
  }, [openByDefault]);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        Update manually
      </button>

      {open && (
        <div className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            In-app update writes the new binary next to the installed CLI. If
            that directory needs sudo (e.g. <code>/usr/local/bin</code>) or
            the running build is a local <code>dev</code> build, run one of
            these on the daemon machine instead:
          </p>
          <ManualCmd label="Homebrew (macOS / Linux)" cmd={MANUAL_BREW_CMD} />
          <ManualCmd
            label="Direct download (macOS / Linux, no Homebrew)"
            cmd={MANUAL_UNIX_CMD}
          />
          <ManualCmd label="Windows (PowerShell)" cmd={MANUAL_WINDOWS_CMD} />
          <p className="text-xs text-muted-foreground">
            After upgrading, restart the daemon: <code>agenthost daemon stop &amp;&amp; agenthost daemon start</code>
          </p>
        </div>
      )}
    </div>
  );
}

interface UpdateSectionProps {
  /** Null for a read-only viewer who cannot use a runtime as the command channel. */
  runtimeId: string | null;
  currentVersion: string | null;
  isOnline: boolean;
  /**
   * Non-null when the daemon process was spawned by a managed launcher
   * (e.g. "desktop" for the Electron app). In that case the CLI binary
   * is shipped and upgraded by the launcher itself, so in-app self-update
   * is disabled — upgrading would be clobbered on the next launch anyway.
   */
  launchedBy?: string | null;
}

export function UpdateSection({
  runtimeId,
  currentVersion,
  isOnline,
  launchedBy,
}: UpdateSectionProps) {
  const { t } = useT("runtimes");
  const isManaged = launchedBy === "desktop";
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<RuntimeUpdateStatus | null>(null);
  const [error, setError] = useState("");
  const [output, setOutput] = useState("");
  const [updating, setUpdating] = useState(false);
  const [targetVersion, setTargetVersion] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Fetch latest version on mount.
  useEffect(() => {
    fetchLatestVersion().then(setLatestVersion);
  }, []);

  const markCompleted = useCallback(
    (message: string) => {
      setStatus("completed");
      setOutput(message);
      setUpdating(false);
      setTargetVersion(null);
      cleanup();
      // Auto-clear status after a few seconds so the UI refreshes to show the
      // new version from the re-fetched runtime data.
      setTimeout(() => setStatus(null), 5000);
    },
    [cleanup],
  );

  useEffect(() => {
    if (!updating || !targetVersion || !currentVersion) return;
    if (!isNewer(targetVersion, currentVersion)) {
      markCompleted(`Updated to ${targetVersion}`);
    }
  }, [currentVersion, markCompleted, targetVersion, updating]);

  const handleUpdate = async () => {
    if (!latestVersion || !runtimeId) return;
    cleanup();
    setUpdating(true);
    setTargetVersion(latestVersion);
    setStatus("pending");
    setError("");
    setOutput("");

    try {
      const update = await api.initiateUpdate(runtimeId, latestVersion);

      pollRef.current = setInterval(async () => {
        try {
          const result = await api.getUpdateResult(runtimeId, update.id);
          setStatus(result.status as RuntimeUpdateStatus);

          if (result.status === "completed") {
            markCompleted(
              result.output ?? `Updated to ${targetVersion ?? latestVersion}`,
            );
          } else if (
            result.status === "failed" ||
            result.status === "timeout"
          ) {
            setError(result.error ?? t(($) => $.update.unknown_error));
            setUpdating(false);
            setTargetVersion(null);
            cleanup();
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } catch {
      setStatus("failed");
      setError(t(($) => $.update.initiate_failed));
      setUpdating(false);
      setTargetVersion(null);
    }
  };

  const hasUpdate =
    currentVersion &&
    latestVersion &&
    isNewer(latestVersion, currentVersion);

  // A source build cannot be ordered against a release tag, so neither
  // "update available" nor "Latest" is a claim we can make. Say that, rather
  // than defaulting to "Latest" and telling the operator their local binary is
  // up to date when we never parsed its version.
  const isLocalBuild =
    !!currentVersion && parseReleaseVersion(currentVersion) === null;

  const config = status ? statusConfig[status] : null;
  const Icon = config?.icon;
  const isActive = status === "pending" || status === "running";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-caption text-muted-foreground">{t(($) => $.update.cli_version_label)}</span>
        <span className="text-caption font-mono">
          {currentVersion ?? t(($) => $.update.version_unknown)}
        </span>

        {isManaged ? (
          <span
            className="inline-flex items-center gap-1 text-caption text-muted-foreground"
            title={t(($) => $.update.managed_by_desktop_title)}
          >
            {t(($) => $.update.managed_by_desktop)}
          </span>
        ) : (
          <>
            {isLocalBuild && !status && (
              <span
                className="inline-flex items-center gap-1 text-caption text-muted-foreground"
                title={t(($) => $.update.local_build_title)}
              >
                {t(($) => $.update.local_build)}
              </span>
            )}

            {!isLocalBuild &&
              !hasUpdate &&
              currentVersion &&
              latestVersion &&
              !status && (
                <span className="inline-flex items-center gap-1 text-caption text-success">
                  <Check className="h-3 w-3" />
                  {t(($) => $.update.latest)}
                </span>
              )}

            {hasUpdate && !status && (
              <>
                <span className="text-caption text-muted-foreground">→</span>
                <span className="text-caption font-mono text-info">
                  {latestVersion}
                </span>
                <span className="text-caption text-muted-foreground">{t(($) => $.update.available)}</span>
              </>
            )}

            {hasUpdate && !runtimeId && (
              <span
                className="inline-flex items-center gap-1 text-caption text-muted-foreground"
                title={t(($) => $.update.read_only_title)}
              >
                <Lock className="h-3 w-3" />
                {t(($) => $.update.read_only)}
              </span>
            )}

            {hasUpdate && runtimeId && isOnline && !status && (
              <Button
                variant="outline"
                size="xs"
                onClick={handleUpdate}
                disabled={updating}
              >
                <ArrowUpCircle className="h-3 w-3" />
                {t(($) => $.update.action)}
              </Button>
            )}
          </>
        )}

        {config && Icon && status && (
          <span
            className={`inline-flex items-center gap-1 text-caption ${config.color}`}
          >
            <Icon className={`h-3 w-3 ${isActive ? "animate-spin" : ""}`} />
            {t(($) => $.update.status[status])}
          </span>
        )}
      </div>

      {status === "completed" && output && (
        <div className="rounded-lg border bg-success/5 px-3 py-2">
          <p className="text-caption text-success">{output}</p>
        </div>
      )}

      {(status === "failed" || status === "timeout") && error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          <p className="text-caption text-destructive">{error}</p>
          {status === "failed" && (
            <Button
              variant="ghost"
              size="xs"
              className="mt-1"
              onClick={handleUpdate}
            >
              {t(($) => $.update.retry)}
            </Button>
          )}
        </div>
      )}

      {!isManaged && hasUpdate && !isActive && (
        <ManualUpdateGuide openByDefault={status === "failed"} />
      )}
    </div>
  );
}
