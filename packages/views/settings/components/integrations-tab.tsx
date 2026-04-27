"use client";

import { useState } from "react";
import { Plug, GitBranch, Trash2, RefreshCw, Download } from "lucide-react";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import { Badge } from "@multica/ui/components/ui/badge";
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
import { useWorkspaceId } from "@multica/core/hooks";
import { useCurrentWorkspace } from "@multica/core/paths";
import { useAuthStore } from "@multica/core/auth";
import { useQuery } from "@tanstack/react-query";
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

// ── Provider metadata ────────────────────────────────────────────────────────

interface ProviderMeta {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  comingSoon?: boolean;
}

const PROVIDERS: Record<string, ProviderMeta> = {
  github: {
    label: "GitHub",
    icon: GitBranch,
    description: "Sync issues, monitor Actions, and manage PRs from Agenthost.",
  },
  slack: {
    label: "Slack",
    icon: Plug,
    description: "Receive task notifications in your Slack workspace.",
    comingSoon: true,
  },
  notion: {
    label: "Notion",
    icon: Plug,
    description: "Sync pages and database rows with Agenthost issues.",
    comingSoon: true,
  },
};

// ── IntegrationCard ──────────────────────────────────────────────────────────

interface IntegrationCardProps {
  providerKey: string;
  meta: ProviderMeta;
  connection: IntegrationConnection | undefined;
  wsId: string;
  wsSlug: string;
  canManage: boolean;
  githubClientId: string | undefined;
}

function IntegrationCard({
  providerKey,
  meta,
  connection,
  wsId,
  wsSlug,
  canManage,
  githubClientId,
}: IntegrationCardProps) {
  const disconnect = useDisconnectIntegration(wsId);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const handleConnect = () => {
    window.location.href = api.getGitHubOAuthURL(wsSlug);
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync(providerKey);
      toast.success(`${meta.label} disconnected`);
      setDisconnectOpen(false);
    } catch {
      toast.error(`Failed to disconnect ${meta.label}`);
    }
  };

  const isConnected = !!connection && connection.status === "active";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-muted p-2">
            <meta.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{meta.label}</span>
              {meta.comingSoon ? (
                <Badge variant="secondary" className="text-xs">Coming soon</Badge>
              ) : isConnected ? (
                <Badge variant="default" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  ● Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  ○ Not connected
                </Badge>
              )}
            </div>
            {isConnected && connection ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                @{connection.provider_account_name ?? connection.provider_account_id}
                {connection.scope && ` · ${connection.scope}`}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            )}
          </div>

          {!meta.comingSoon && (
            <div className="flex gap-2 shrink-0">
              {isConnected ? (
                <>
                  {canManage && (
                    <>
                      <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setDisconnectOpen(true)}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Disconnect
                      </Button>
                      <Dialog open={disconnectOpen} onOpenChange={setDisconnectOpen}>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Disconnect {meta.label}?</DialogTitle>
                            <DialogDescription>
                              This removes the OAuth connection. Existing imported issues are kept.
                              Webhooks registered via Agenthost must be removed manually from GitHub.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setDisconnectOpen(false)}>
                              Cancel
                            </Button>
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
                    </>
                  )}
                  {providerKey === "github" && (
                    <GitHubActions wsId={wsId} canManage={canManage} />
                  )}
                </>
              ) : (
                canManage && !meta.comingSoon && providerKey === "github" && (
                  <Button
                    size="sm"
                    className="h-7"
                    onClick={handleConnect}
                    disabled={!githubClientId}
                    title={!githubClientId ? "GITHUB_CLIENT_ID not configured on server" : undefined}
                  >
                    Connect →
                  </Button>
                )
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── GitHub-specific action panel ─────────────────────────────────────────────

function GitHubActions({
  wsId,
  canManage,
}: {
  wsId: string;
  canManage: boolean;
}) {
  const [importOpen, setImportOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const { data: repos = [], isLoading: reposLoading } = useGitHubRepos(wsId, importOpen);
  const importIssues = useImportGitHubIssues(wsId);
  const registerWebhook = useRegisterGitHubWebhook(wsId);

  const handleImport = async () => {
    if (!selectedRepo) return;
    try {
      const result = await importIssues.mutateAsync(selectedRepo);
      const parts = [`${result.imported} imported`];
      if (result.skipped > 0) parts.push(`${result.skipped} already existed`);
      if (result.failed > 0) parts.push(`${result.failed} failed`);
      const summary = parts.join(" · ");
      if (result.failed > 0 && result.imported === 0) {
        toast.error(`Import failed: ${summary}`);
      } else if (result.failed > 0) {
        toast.warning(summary);
      } else {
        toast.success(summary);
      }
      setImportOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to import issues");
    }
  };

  const handleRegisterWebhook = async () => {
    if (!selectedRepo) return;
    try {
      const result = await registerWebhook.mutateAsync(selectedRepo);
      toast.success(`Webhook registered on ${result.repo} (ID: ${result.hook_id})`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to register webhook");
    }
  };

  if (!canManage) return null;

  return (
    <Dialog open={importOpen} onOpenChange={setImportOpen}>
      <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => setImportOpen(true)}>
        <Download className="h-3 w-3 mr-1" />
        Import
      </Button>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import GitHub Issues</DialogTitle>
          <DialogDescription>
            Select a repository to import open issues into this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <Select value={selectedRepo} onValueChange={(v) => setSelectedRepo(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder={reposLoading ? "Loading repos…" : "Select a repository"} />
            </SelectTrigger>
            <SelectContent>
              {repos.map((r: GitHubRepo) => (
                <SelectItem key={r.full_name} value={r.full_name}>
                  {r.full_name}
                  {r.private && (
                    <span className="ml-1 text-xs text-muted-foreground">(private)</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRepo && (
          <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground space-y-2">
            <p>
              Imports all open issues from <strong>{selectedRepo}</strong> as Agenthost issues.
              Already-imported issues are skipped.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              disabled={registerWebhook.isPending || !selectedRepo}
              onClick={handleRegisterWebhook}
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${registerWebhook.isPending ? "animate-spin" : ""}`} />
              Also register webhook for real-time sync
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setImportOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedRepo || importIssues.isPending}
          >
            {importIssues.isPending ? "Importing…" : "Import Issues"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── IntegrationsTab ──────────────────────────────────────────────────────────

export function IntegrationsTab() {
  const user = useAuthStore((s) => s.user);
  const workspace = useCurrentWorkspace();
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: connections = [] } = useIntegrations(wsId);
  const { data: config } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => api.getConfig(),
    staleTime: 5 * 60 * 1000,
  });

  const currentMember = members.find((m) => m.user_id === user?.id) ?? null;
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

  const connectionByProvider = Object.fromEntries(
    connections.map((c) => [c.provider, c]),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Integrations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external services to sync issues, get notifications, and automate workflows.
          {!canManage && " Only workspace admins and owners can connect or disconnect integrations."}
        </p>
      </div>

      <div className="space-y-3">
        {Object.entries(PROVIDERS).map(([key, meta]) => (
          <IntegrationCard
            key={key}
            providerKey={key}
            meta={meta}
            connection={connectionByProvider[key]}
            wsId={wsId}
            wsSlug={workspace?.slug ?? ""}
            canManage={canManage}
            githubClientId={config?.github_client_id}
          />
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Webhook URL for manual setup:{" "}
        <code className="bg-muted px-1 rounded">
          {typeof window !== "undefined" ? window.location.origin : ""}/webhooks/github?workspace_id={wsId}
        </code>
      </p>
    </div>
  );
}
