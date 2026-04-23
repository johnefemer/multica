"use client";

import { useState, useEffect } from "react";
import {
  GitBranch,
  MessageSquare,
  FileText,
  Mail,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plug,
  Download,
  Trash2,
  RefreshCw,
  Link,
  Info,
} from "lucide-react";
import { Badge } from "@multica/ui/components/ui/badge";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent, CardHeader } from "@multica/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@multica/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@multica/ui/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { useCurrentWorkspace } from "@multica/core/paths";
import { useAuthStore } from "@multica/core/auth";
import { memberListOptions } from "@multica/core/workspace/queries";
import { api } from "@multica/core/api";
import {
  useIntegrations,
  useDisconnectIntegration,
  useGitHubRepos,
  useImportGitHubIssues,
  useRegisterGitHubWebhook,
} from "@multica/core/integrations";
import type { IntegrationConnection, GitHubRepo } from "@multica/core/types";

// ── Provider catalog definition ──────────────────────────────────────────────

type ProviderCategory = "Dev" | "Productivity" | "Communication";

interface ProviderDef {
  key: string;
  label: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  category: ProviderCategory;
  comingSoon?: boolean;
  docsUrl?: string;
  features: string[];
}

const CATALOG: ProviderDef[] = [
  {
    key: "github",
    label: "GitHub",
    tagline: "Sync issues, track PRs, monitor CI",
    description:
      "Connect your GitHub account to import issues, receive real-time webhook updates, monitor GitHub Actions runs, and manage pull requests — all from within Agenthost.",
    icon: GitBranch,
    iconBg: "bg-zinc-900 dark:bg-zinc-800",
    category: "Dev",
    docsUrl: "https://docs.github.com/en/developers/apps",
    features: [
      "Import open issues from any repo",
      "Real-time sync via webhooks (opened, closed, edited)",
      "PR merge notifications on linked issues",
      "GitHub Actions CI pass/fail activity",
      "Register webhooks automatically",
    ],
  },
  {
    key: "slack",
    label: "Slack",
    tagline: "Task notifications in your Slack workspace",
    description:
      "Get notified in Slack when issues are created, assigned, or resolved. Post agent activity updates to channels. Coming soon.",
    icon: MessageSquare,
    iconBg: "bg-[#4A154B]",
    category: "Communication",
    comingSoon: true,
    features: [
      "Issue create / assign / close notifications",
      "Agent task status updates",
      "Slash command to create issues",
    ],
  },
  {
    key: "notion",
    label: "Notion",
    tagline: "Sync pages and database rows",
    description:
      "Map Agenthost issues to Notion database rows. Keep acceptance criteria, context refs, and status in sync bidirectionally. Coming soon.",
    icon: FileText,
    iconBg: "bg-zinc-900 dark:bg-zinc-700",
    category: "Productivity",
    comingSoon: true,
    features: [
      "Import Notion database rows as issues",
      "Sync issue status back to Notion",
      "Link Notion pages as context refs on issues",
    ],
  },
  {
    key: "email",
    label: "Email",
    tagline: "Turn inbound emails into issues",
    description:
      "Forward emails to your workspace address and Agenthost creates issues automatically. Replies are threaded as comments. Coming soon.",
    icon: Mail,
    iconBg: "bg-blue-600",
    category: "Communication",
    comingSoon: true,
    features: [
      "Inbound email → issue creation",
      "Email replies threaded as comments",
      "Custom workspace email address",
    ],
  },
];

const CATEGORIES: ProviderCategory[] = ["Dev", "Productivity", "Communication"];

// ── Status helpers ────────────────────────────────────────────────────────────

function StatusBadge({ conn }: { conn?: IntegrationConnection }) {
  if (!conn) return (
    <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
      <span className="size-1.5 rounded-full bg-muted-foreground/50 inline-block" />
      Not connected
    </Badge>
  );
  if (conn.status === "active") return (
    <Badge className="text-xs gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10">
      <CheckCircle2 className="size-3" />
      Connected
    </Badge>
  );
  return (
    <Badge variant="destructive" className="text-xs gap-1">
      <AlertCircle className="size-3" />
      {conn.status === "expired" ? "Token expired" : "Error"}
    </Badge>
  );
}

// ── GitHub management panel ───────────────────────────────────────────────────

function GitHubManagePanel({
  wsId,
  conn,
}: {
  wsId: string;
  conn: IntegrationConnection;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState("");
  const { data: repos = [], isLoading: reposLoading } = useGitHubRepos(wsId, importOpen);
  const importIssues = useImportGitHubIssues(wsId);
  const registerWebhook = useRegisterGitHubWebhook(wsId);

  const handleImport = async () => {
    if (!selectedRepo) return;
    try {
      const result = await importIssues.mutateAsync(selectedRepo);
      toast.success(`Imported ${result.imported} issues · ${result.skipped} already existed`);
      setImportOpen(false);
      setSelectedRepo("");
    } catch {
      toast.error("Failed to import issues");
    }
  };

  const handleRegisterWebhook = async () => {
    if (!selectedRepo) return;
    try {
      const r = await registerWebhook.mutateAsync(selectedRepo);
      toast.success(`Webhook registered on ${r.repo} (ID ${r.hook_id})`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to register webhook");
    }
  };

  return (
    <div className="space-y-4">
      {/* Account info */}
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
        {conn.provider_account_avatar && (
          <img
            src={conn.provider_account_avatar}
            alt={conn.provider_account_name ?? ""}
            className="size-8 rounded-full"
          />
        )}
        <div>
          <p className="text-sm font-medium">
            @{conn.provider_account_name ?? conn.provider_account_id}
          </p>
          {conn.scope && (
            <p className="text-xs text-muted-foreground">
              Scopes: {conn.scope.split(",").join(", ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Connected {new Date(conn.connected_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => setImportOpen(true)}
        >
          <Download className="size-3.5" />
          Import Issues
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => setImportOpen(true)}
        >
          <Link className="size-3.5" />
          Register Webhook
        </Button>
      </div>

      {/* Webhook URL hint */}
      <div className="rounded-md border p-3 space-y-1">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Info className="size-3" />
          Manual webhook URL
        </p>
        <code className="text-xs bg-muted px-1.5 py-0.5 rounded break-all block">
          {typeof window !== "undefined" ? window.location.origin : "https://agenthost.kensink.com"}/webhooks/github?workspace_id={wsId}
        </code>
      </div>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import GitHub Issues</DialogTitle>
            <DialogDescription>
              Select a repository to import open issues. Already-imported issues are skipped.
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedRepo} onValueChange={(v) => setSelectedRepo(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder={reposLoading ? "Loading repos…" : "Pick a repository"} />
            </SelectTrigger>
            <SelectContent>
              {repos.map((r: GitHubRepo) => (
                <SelectItem key={r.full_name} value={r.full_name}>
                  <span className="flex items-center gap-1.5">
                    {r.full_name}
                    {r.private && (
                      <span className="text-[10px] text-muted-foreground">(private)</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedRepo && (
            <div className="text-xs text-muted-foreground rounded-md bg-muted p-3 space-y-2">
              <p>
                Imports all open issues from <strong>{selectedRepo}</strong>.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                disabled={registerWebhook.isPending || !selectedRepo}
                onClick={handleRegisterWebhook}
              >
                <RefreshCw className={`size-3 mr-1 ${registerWebhook.isPending ? "animate-spin" : ""}`} />
                Also register webhook for real-time sync
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={!selectedRepo || importIssues.isPending}>
              {importIssues.isPending ? "Importing…" : "Import Issues"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Integration card ─────────────────────────────────────────────────────────

function IntegrationCard({
  def,
  conn,
  wsId,
  wsSlug,
  canManage,
  githubClientId,
}: {
  def: ProviderDef;
  conn?: IntegrationConnection;
  wsId: string;
  wsSlug: string;
  canManage: boolean;
  githubClientId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const disconnect = useDisconnectIntegration(wsId);
  const isConnected = !!conn && conn.status === "active";
  const Icon = def.icon;

  const handleConnect = () => {
    if (def.key === "github") {
      window.location.href = api.getGitHubOAuthURL(wsSlug);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync(def.key);
      toast.success(`${def.label} disconnected`);
      setDisconnectOpen(false);
      setExpanded(false);
    } catch {
      toast.error(`Failed to disconnect ${def.label}`);
    }
  };

  return (
    <Card className={`transition-shadow ${isConnected ? "ring-1 ring-emerald-500/20" : ""}`}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={`rounded-lg p-2.5 shrink-0 ${def.iconBg}`}>
            <Icon className="size-5 text-white" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{def.label}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                {def.category}
              </Badge>
              {def.comingSoon
                ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Coming soon</Badge>
                : <StatusBadge conn={conn} />
              }
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{def.tagline}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {!def.comingSoon && canManage && (
              isConnected ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setExpanded((v) => !v)}
                  >
                    {expanded ? (
                      <ChevronUp className="size-3.5 mr-1" />
                    ) : (
                      <ChevronDown className="size-3.5 mr-1" />
                    )}
                    Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDisconnectOpen(true)}
                    title="Disconnect"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleConnect}
                  disabled={def.key === "github" && !githubClientId}
                  title={def.key === "github" && !githubClientId ? "GITHUB_CLIENT_ID not configured" : undefined}
                >
                  <Plug className="size-3 mr-1" />
                  Connect
                </Button>
              )
            )}
            {def.docsUrl && (
              <a
                href={def.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Documentation"
              >
                <ExternalLink className="size-3.5" />
              </a>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Expanded management panel */}
      {isConnected && expanded && (
        <CardContent className="px-4 pb-4 pt-0 border-t">
          <div className="pt-3">
            {def.key === "github" && (
              <GitHubManagePanel wsId={wsId} conn={conn!} />
            )}
          </div>
        </CardContent>
      )}

      {/* Features list — shown when not connected */}
      {!isConnected && !def.comingSoon && (
        <CardContent className="px-4 pb-4 pt-0">
          <p className="text-xs text-muted-foreground mb-2">{def.description}</p>
          <ul className="space-y-1">
            {def.features.map((f) => (
              <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-muted-foreground/50" />
                {f}
              </li>
            ))}
          </ul>
        </CardContent>
      )}

      {/* Disconnect dialog */}
      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {def.label}?</DialogTitle>
            <DialogDescription>
              This removes the OAuth connection. Existing imported issues are kept.
              Any webhooks registered via Agenthost must be removed manually from {def.label}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={disconnect.isPending}
            >
              {disconnect.isPending ? "Disconnecting…" : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const user = useAuthStore((s) => s.user);
  const workspace = useCurrentWorkspace();
  const wsId = useWorkspaceId();
  const [filter, setFilter] = useState<ProviderCategory | "All">("All");

  // Show toast after OAuth redirect
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const connectedParam = searchParams?.get("connected");
  const errorParam = searchParams?.get("error");
  const providerParam = searchParams?.get("provider");

  useEffect(() => {
    if (connectedParam) {
      const def = CATALOG.find((d) => d.key === connectedParam);
      toast.success(`${def?.label ?? connectedParam} connected successfully`);
      // Clear the query param from the URL without navigation
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("connected");
        window.history.replaceState({}, "", url.toString());
      }
    }
    if (errorParam) {
      const def = CATALOG.find((d) => d.key === (providerParam ?? ""));
      toast.error(`Failed to connect ${def?.label ?? providerParam ?? "integration"}: ${errorParam}`);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("error");
        url.searchParams.delete("provider");
        window.history.replaceState({}, "", url.toString());
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: connections = [], isLoading } = useIntegrations(wsId);
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => api.getConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const currentMember = members.find((m) => m.user_id === user?.id) ?? null;
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

  const connectionMap = Object.fromEntries(connections.map((c) => [c.provider, c]));

  const connectedDefs = CATALOG.filter((d) => connectionMap[d.key]);
  const availableDefs = CATALOG.filter((d) => !connectionMap[d.key]);

  const filtered = (defs: ProviderDef[]) =>
    filter === "All" ? defs : defs.filter((d) => d.category === filter);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect Agenthost to your existing tools. Agents gain access to connected services automatically.
            {!canManage && (
              <span className="ml-1 text-amber-600 dark:text-amber-400">
                Only workspace admins and owners can connect or disconnect integrations.
              </span>
            )}
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {(["All", ...CATEGORIES] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Connected integrations */}
        {filtered(connectedDefs).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Connected
            </h2>
            <div className="space-y-3">
              {filtered(connectedDefs).map((def) => (
                <IntegrationCard
                  key={def.key}
                  def={def}
                  conn={connectionMap[def.key]}
                  wsId={wsId}
                  wsSlug={workspace?.slug ?? ""}
                  canManage={canManage}
                  githubClientId={config?.github_client_id}
                />
              ))}
            </div>
          </section>
        )}

        {/* Available integrations */}
        {filtered(availableDefs).length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {connectedDefs.length > 0 ? "Available" : "All Integrations"}
            </h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {filtered(availableDefs).map((def) => (
                  <IntegrationCard
                    key={def.key}
                    def={def}
                    conn={connectionMap[def.key]}
                    wsId={wsId}
                    wsSlug={workspace?.slug ?? ""}
                    canManage={canManage}
                    githubClientId={config?.github_client_id}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {filter !== "All" && filtered([...connectedDefs, ...availableDefs]).length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No integrations in this category yet.
          </div>
        )}
      </div>
    </div>
  );
}
