"use client";

import { useState, useEffect } from "react";
import {
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
  X,
  FolderPlus,
  FolderOpen,
  ArrowRight,
  Plus,
  GitBranch,
} from "lucide-react";
import { GitHubLogo } from "./logos/github-logo";
import { SlackLogo } from "./logos/slack-logo";
import { NotionLogo } from "./logos/notion-logo";
import { EmailLogo } from "./logos/email-logo";
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@multica/ui/components/ui/command";
import { Checkbox } from "@multica/ui/components/ui/checkbox";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useWorkspaceId } from "@multica/core/hooks";
import { useCurrentWorkspace } from "@multica/core/paths";
import { useAuthStore } from "@multica/core/auth";
import { memberListOptions } from "@multica/core/workspace/queries";
import { projectListOptions, useCreateProject, useUpdateProject } from "@multica/core/projects";
import { api } from "@multica/core/api";
import { useWorkspacePaths } from "@multica/core/paths";
import { AppLink } from "../navigation";
import {
  useIntegrations,
  useDisconnectIntegration,
  useGitHubRepos,
  useGitHubWebhooks,
  useImportGitHubIssues,
  useRegisterGitHubWebhook,
  useRemoveGitHubWebhook,
  useSlackChannels,
  useSlackBindings,
  useCreateSlackBinding,
  useUpdateSlackBinding,
  useDeleteSlackBinding,
  useSlackNotifyEventTypes,
} from "@multica/core/integrations";
import type {
  IntegrationConnection,
  GitHubRepo,
  Project,
  ChatChannelBinding,
  SlackNotifyEventType,
} from "@multica/core/types";

// ── Provider catalog definition ──────────────────────────────────────────────

type ProviderCategory = "Dev" | "Productivity" | "Communication";

interface ProviderDef {
  key: string;
  label: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  /** When false the icon manages its own colours (e.g. full-colour SVGs like Slack). */
  iconWhite?: boolean;
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
    icon: GitHubLogo,
    iconBg: "bg-zinc-900 dark:bg-zinc-800",
    iconWhite: true,
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
    tagline: "Chat with agents and manage issues from Slack",
    description:
      "Install the Agenthost Slack app to a Slack workspace, bind channels to Agenthost workspaces, and let your team chat with agents directly from Slack threads. See docs/slack-app-setup.md for setup.",
    icon: SlackLogo,
    iconBg: "bg-white dark:bg-zinc-800",
    category: "Communication",
    docsUrl: "https://api.slack.com/apps",
    features: [
      "Install the Agenthost bot to your Slack workspace",
      "Bind Slack channels to Agenthost workspaces (1:1)",
      "Chat with agents from Slack threads — replies stream both ways",
      "Slash commands for issue create / assign / status / dispatch",
      "Channel notifications on issue create / assign / status / task complete",
    ],
  },
  {
    key: "notion",
    label: "Notion",
    tagline: "Sync pages and database rows",
    description:
      "Map Agenthost issues to Notion database rows. Keep acceptance criteria, context refs, and status in sync bidirectionally. Coming soon.",
    icon: NotionLogo,
    iconBg: "bg-zinc-900 dark:bg-zinc-800",
    iconWhite: true,
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
    icon: EmailLogo,
    iconBg: "bg-blue-600",
    iconWhite: true,
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
  const wsPaths = useWorkspacePaths();
  const [dialogMode, setDialogMode] = useState<"import" | "webhook" | null>(null);
  const dialogOpen = dialogMode !== null;
  const [selectedRepo, setSelectedRepo] = useState("");
  const [alsoRegisterWebhook, setAlsoRegisterWebhook] = useState(false);
  const [precheck, setPrecheck] = useState<{ repo: string; existingProject: Project | null } | null>(null);
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [mappingRepo, setMappingRepo] = useState("");
  const [mappingTarget, setMappingTarget] = useState<{ kind: "existing"; id: string } | { kind: "new" } | null>(null);
  const [removeMappingTarget, setRemoveMappingTarget] = useState<Project | null>(null);
  const { data: repos = [], isLoading: reposLoading } = useGitHubRepos(wsId, dialogOpen || mappingDialogOpen);
  const { data: webhooks = [] } = useGitHubWebhooks(wsId);
  const { data: allProjects = [] } = useQuery(projectListOptions(wsId));
  const importIssues = useImportGitHubIssues(wsId);
  const registerWebhook = useRegisterGitHubWebhook(wsId);
  const removeWebhook = useRemoveGitHubWebhook(wsId);
  const updateProject = useUpdateProject();
  const createProject = useCreateProject();

  const registeredRepos = new Set(webhooks.map((w) => w.repo));
  const mappedProjects = allProjects.filter(
    (p) => p.integration_provider === "github" && p.integration_repo,
  );
  const mappedRepos = new Set(mappedProjects.map((p) => p.integration_repo));
  const unmappedProjects = allProjects.filter(
    (p) => !p.integration_repo,
  );

  // Reset transient picker state every time the dialog closes.
  useEffect(() => {
    if (!dialogOpen) {
      setSelectedRepo("");
      setAlsoRegisterWebhook(false);
    }
  }, [dialogOpen]);

  const selectedRepoMeta = repos.find((r: GitHubRepo) => r.full_name === selectedRepo);
  const isWorking = importIssues.isPending || registerWebhook.isPending;

  const fireImport = async (repo: string, projectId: string | null) => {
    try {
      const result = await importIssues.mutateAsync({ repo, projectId });
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
      if (alsoRegisterWebhook) {
        try {
          const r = await registerWebhook.mutateAsync(repo);
          toast.success(`Webhook registered on ${r.repo}`);
        } catch (e: unknown) {
          toast.error((e as Error)?.message ?? "Webhook registration failed");
        }
      }
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to import issues");
    }
  };

  const handleImport = async () => {
    if (!selectedRepo) return;
    setDialogMode(null);
    // Precheck mapping. If a project is mapped, import directly. If not,
    // open the 3-option modal so the user picks.
    let existing: Project | null = null;
    try {
      existing = await api.getProjectByIntegrationRepo("github", selectedRepo);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to look up project mapping");
      return;
    }
    if (existing) {
      await fireImport(selectedRepo, existing.id);
    } else {
      setPrecheck({ repo: selectedRepo, existingProject: null });
    }
  };

  const handleCreateProjectAndImport = async () => {
    if (!precheck) return;
    const { repo } = precheck;
    const repoName = repo.split("/").pop() || repo;
    try {
      const project = await api.createProject({
        title: repoName,
        description: `Imported from GitHub repo ${repo}`,
        integration_provider: "github",
        integration_repo: repo,
      });
      setPrecheck(null);
      await fireImport(repo, project.id);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to create project");
    }
  };

  const handleImportWithoutProject = async () => {
    if (!precheck) return;
    const { repo } = precheck;
    setPrecheck(null);
    await fireImport(repo, null);
  };

  const handleRegisterWebhookOnly = async () => {
    if (!selectedRepo) return;
    if (registeredRepos.has(selectedRepo)) {
      toast.warning("This repository already has a webhook. Remove it first to re-register.");
      return;
    }
    try {
      const r = await registerWebhook.mutateAsync(selectedRepo);
      toast.success(`Webhook registered on ${r.repo} (ID ${r.hook_id})`);
      setDialogMode(null);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to register webhook");
    }
  };

  const handleRemoveWebhook = async (repo: string) => {
    try {
      await removeWebhook.mutateAsync(repo);
      toast.success(`Webhook removed from ${repo}`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to remove webhook");
    }
  };

  const resetMappingDialog = () => {
    setMappingDialogOpen(false);
    setMappingRepo("");
    setMappingTarget(null);
  };

  const handleSaveMapping = async () => {
    if (!mappingRepo || !mappingTarget) return;
    try {
      if (mappingTarget.kind === "new") {
        const repoName = mappingRepo.split("/").pop() || mappingRepo;
        await createProject.mutateAsync({
          title: repoName,
          description: `Linked to GitHub repo ${mappingRepo}`,
          integration_provider: "github",
          integration_repo: mappingRepo,
        });
        toast.success(`Created project mapped to ${mappingRepo}`);
      } else {
        await updateProject.mutateAsync({
          id: mappingTarget.id,
          integration_provider: "github",
          integration_repo: mappingRepo,
        });
        toast.success(`Mapped ${mappingRepo} to project`);
      }
      resetMappingDialog();
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to save mapping");
    }
  };

  const handleConfirmRemoveMapping = async () => {
    if (!removeMappingTarget) return;
    try {
      await updateProject.mutateAsync({
        id: removeMappingTarget.id,
        integration_provider: null,
        integration_repo: null,
      });
      toast.success(`Removed mapping for ${removeMappingTarget.integration_repo}`);
      setRemoveMappingTarget(null);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to remove mapping");
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
          onClick={() => setDialogMode("import")}
        >
          <Download className="size-3.5" />
          Import Issues
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-start gap-2"
          onClick={() => setDialogMode("webhook")}
        >
          <Link className="size-3.5" />
          Register Webhook
        </Button>
      </div>

      {/* Repository ↔ Project mappings */}
      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Repository ↔ Project mappings</p>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => setMappingDialogOpen(true)}
          >
            <Plus className="size-3" />
            Add mapping
          </Button>
        </div>
        {mappedProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No mappings yet. Map a repo to a project so webhook events sync into the right place.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {mappedProjects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <GitBranch className="size-3 shrink-0 text-muted-foreground" />
                  <span className="font-mono truncate" title={p.integration_repo ?? ""}>
                    {p.integration_repo}
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-muted-foreground" />
                  <AppLink
                    href={wsPaths.projectDetail(p.id)}
                    className="truncate hover:underline"
                    title={p.title}
                  >
                    {p.icon ? `${p.icon} ` : ""}{p.title}
                  </AppLink>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => setRemoveMappingTarget(p)}
                  title="Remove mapping"
                >
                  <X className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Registered webhooks */}
      {webhooks.length > 0 && (
        <div className="rounded-md border p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Registered webhooks</p>
          <ul className="space-y-1.5">
            {webhooks.map((w) => (
              <li key={w.repo} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Link className="size-3 shrink-0 text-muted-foreground" />
                  <span className="font-mono truncate" title={w.repo}>{w.repo}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleRemoveWebhook(w.repo)}
                  disabled={removeWebhook.isPending}
                  title="Remove webhook"
                >
                  <X className="size-3" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Repo picker dialog — used for both Import Issues and Register Webhook */}
      <Dialog open={dialogOpen} onOpenChange={(o) => setDialogMode(o ? (dialogMode ?? "import") : null)}>
        <DialogContent className="gap-0 p-0 sm:max-w-lg overflow-hidden flex flex-col max-h-[min(85vh,640px)]">
          <DialogHeader className="p-4 pb-3">
            <DialogTitle>
              {dialogMode === "webhook" ? "Register GitHub Webhook" : "Import GitHub Issues"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "webhook"
                ? "Select a repository to register a webhook for real-time issue sync. Requires admin access on the repo."
                : "Select a repository to import its open issues. Already-imported issues are skipped."}
            </DialogDescription>
          </DialogHeader>

          <Command
            className="border-t rounded-none bg-transparent flex-1 min-h-0"
            // cmdk's built-in scoring trips on slashes; full_name includes a slash so
            // we match against owner / repo / description ourselves below.
            filter={(value, search) => {
              if (!search) return 1;
              return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput placeholder="Search repositories…" />
            <CommandList className="max-h-none flex-1">
              {reposLoading ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  Loading repositories…
                </div>
              ) : repos.length === 0 ? (
                <div className="py-10 text-center text-xs text-muted-foreground">
                  No repositories accessible with this GitHub account.
                </div>
              ) : (
                <>
                  <CommandEmpty>No matching repositories.</CommandEmpty>
                  <CommandGroup>
                    {repos.map((r: GitHubRepo) => {
                      const checked = r.full_name === selectedRepo;
                      const isRegistered = registeredRepos.has(r.full_name);
                      const blockedInWebhookMode = dialogMode === "webhook" && isRegistered;
                      return (
                        <CommandItem
                          key={r.full_name}
                          value={`${r.full_name} ${r.description ?? ""}`}
                          data-checked={checked || undefined}
                          onSelect={() => {
                            if (blockedInWebhookMode) {
                              toast.warning("This repository already has a webhook. Remove it first to re-register.");
                              return;
                            }
                            setSelectedRepo(r.full_name);
                          }}
                          className="py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate" title={r.full_name}>
                                {r.full_name}
                              </span>
                              {r.private && (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">
                                  <Lock className="size-3" /> Private
                                </span>
                              )}
                              {isRegistered && (
                                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-600 shrink-0">
                                  Registered
                                </span>
                              )}
                            </div>
                            {r.description && (
                              <p
                                className="text-xs text-muted-foreground truncate"
                                title={r.description}
                              >
                                {r.description}
                              </p>
                            )}
                          </div>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>

          {/* Selection summary + webhook toggle */}
          <div className="border-t p-4 space-y-3">
            {selectedRepo ? (
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate" title={selectedRepo}>
                    {selectedRepo}
                  </p>
                  {selectedRepoMeta?.description && (
                    <p className="text-muted-foreground truncate">{selectedRepoMeta.description}</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a repository above to continue.
              </p>
            )}

            {dialogMode === "import" && (
              <label
                className={`flex items-start gap-2 text-xs ${
                  selectedRepo ? "cursor-pointer text-foreground" : "cursor-not-allowed text-muted-foreground/60"
                }`}
              >
                <Checkbox
                  checked={alsoRegisterWebhook}
                  onCheckedChange={(c) => setAlsoRegisterWebhook(!!c)}
                  disabled={!selectedRepo || isWorking}
                  className="mt-0.5"
                />
                <span>
                  Also register webhook for real-time sync
                  <span className="block text-muted-foreground">
                    Pushes new / closed / edited issues to Agenthost as they happen.
                  </span>
                </span>
              </label>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogMode(null)}
              disabled={isWorking}
              className="sm:w-auto w-full"
            >
              Cancel
            </Button>
            {dialogMode === "webhook" ? (
              <Button
                onClick={handleRegisterWebhookOnly}
                disabled={!selectedRepo || isWorking}
                className="sm:w-auto w-full gap-1.5"
              >
                {registerWebhook.isPending ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Registering…
                  </>
                ) : (
                  <>
                    <Link className="size-3.5" />
                    Register Webhook
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={!selectedRepo || isWorking}
                className="sm:w-auto w-full gap-1.5"
              >
                {importIssues.isPending ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    Importing…
                  </>
                ) : (
                  <>
                    <Download className="size-3.5" />
                    {alsoRegisterWebhook ? "Import + register" : "Import Issues"}
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import precheck — shown when no project is mapped to the selected repo */}
      <Dialog open={precheck !== null} onOpenChange={(o) => { if (!o) setPrecheck(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No project linked to {precheck?.repo}</DialogTitle>
            <DialogDescription>
              Imported issues need to live somewhere. Choose how to handle this import — and we&apos;ll
              remember the mapping for future syncs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-auto py-3"
              onClick={handleCreateProjectAndImport}
              disabled={importIssues.isPending}
            >
              <FolderPlus className="size-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">Create project &ldquo;{precheck?.repo.split("/").pop()}&rdquo;</p>
                <p className="text-xs text-muted-foreground">
                  Mapped to {precheck?.repo}. Future webhook events sync into this project.
                </p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start gap-2 h-auto py-3"
              onClick={handleImportWithoutProject}
              disabled={importIssues.isPending}
            >
              <FolderOpen className="size-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">Import without project</p>
                <p className="text-xs text-muted-foreground">
                  Issues land at the workspace root. Webhook events for {precheck?.repo} will be dropped.
                </p>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPrecheck(null)} disabled={importIssues.isPending}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add mapping dialog */}
      <Dialog open={mappingDialogOpen} onOpenChange={(o) => { if (!o) resetMappingDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Map a repository to a project</DialogTitle>
            <DialogDescription>
              Choose a GitHub repository and the project it should sync into. Webhook events from
              this repo will land in the chosen project.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium block mb-1">Repository</label>
              <Command className="border rounded-md">
                <CommandInput placeholder="Search GitHub repos…" />
                <CommandList className="max-h-40">
                  {reposLoading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
                  ) : (
                    <>
                      <CommandEmpty>No matching repositories.</CommandEmpty>
                      <CommandGroup>
                        {repos.map((r: GitHubRepo) => {
                          const alreadyMapped = mappedRepos.has(r.full_name);
                          return (
                            <CommandItem
                              key={r.full_name}
                              value={`${r.full_name} ${r.description ?? ""}`}
                              onSelect={() => {
                                if (alreadyMapped) {
                                  toast.warning("This repository is already mapped to another project. Remove the existing mapping first.");
                                  return;
                                }
                                setMappingRepo(r.full_name);
                              }}
                              data-checked={r.full_name === mappingRepo || undefined}
                            >
                              <span className="font-mono truncate flex-1" title={r.full_name}>
                                {r.full_name}
                              </span>
                              {alreadyMapped && (
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Mapped</span>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
              {mappingRepo && (
                <p className="text-xs text-muted-foreground mt-1">
                  Selected: <span className="font-mono">{mappingRepo}</span>
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Project</label>
              <div className="border rounded-md p-1 max-h-40 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  onClick={() => mappingRepo && setMappingTarget({ kind: "new" })}
                  disabled={!mappingRepo}
                  data-checked={mappingTarget?.kind === "new" || undefined}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-accent disabled:opacity-50 data-[checked]:bg-accent"
                >
                  <FolderPlus className="size-3.5 shrink-0" />
                  <span>
                    Create new project
                    {mappingRepo && (
                      <span className="text-muted-foreground"> &ldquo;{mappingRepo.split("/").pop()}&rdquo;</span>
                    )}
                  </span>
                </button>
                {unmappedProjects.length > 0 && (
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 pt-2 pb-0.5">
                    Existing projects
                  </div>
                )}
                {unmappedProjects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setMappingTarget({ kind: "existing", id: p.id })}
                    data-checked={mappingTarget?.kind === "existing" && mappingTarget.id === p.id || undefined}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-left hover:bg-accent data-[checked]:bg-accent"
                  >
                    <FolderOpen className="size-3.5 shrink-0" />
                    <span className="truncate">{p.icon ? `${p.icon} ` : ""}{p.title}</span>
                  </button>
                ))}
                {unmappedProjects.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1.5">
                    No unmapped projects available — pick &ldquo;Create new&rdquo; above.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetMappingDialog} disabled={createProject.isPending || updateProject.isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveMapping}
              disabled={!mappingRepo || !mappingTarget || createProject.isPending || updateProject.isPending}
              className="gap-1.5"
            >
              {(createProject.isPending || updateProject.isPending) ? (
                <><RefreshCw className="size-3.5 animate-spin" /> Saving…</>
              ) : (
                "Save mapping"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove mapping confirmation */}
      <Dialog open={removeMappingTarget !== null} onOpenChange={(o) => { if (!o) setRemoveMappingTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove mapping?</DialogTitle>
            <DialogDescription>
              This unlinks <span className="font-mono">{removeMappingTarget?.integration_repo}</span>
              {" "}from <strong>{removeMappingTarget?.title}</strong>. Webhook events for this repo will
              be dropped until you create a new mapping. Existing issues stay where they are.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMappingTarget(null)} disabled={updateProject.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmRemoveMapping} disabled={updateProject.isPending}>
              {updateProject.isPending ? "Removing…" : "Remove mapping"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Slack management panel ───────────────────────────────────────────────────
//
// Phase 2 ships channel binding. A workspace admin picks a Slack channel from
// the picker; the binding row tells later phases (events / notifications) which
// workspace context that channel routes to. Slash commands, mirroring, and
// outbound notifications land in subsequent phases.

function SlackManagePanel({
  wsId,
  conn,
  canManage,
}: {
  wsId: string;
  conn: IntegrationConnection;
  canManage: boolean;
}) {
  const scopes = conn.scope ? conn.scope.split(",").filter(Boolean) : [];
  // Open the Slack workspace itself, not the admin "manage apps" console —
  // that page 404s for anyone who isn't a Slack workspace admin.
  const slackAppsURL = conn.provider_account_id
    ? `https://app.slack.com/client/${conn.provider_account_id}`
    : "https://app.slack.com";

  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: bindings = [] } = useSlackBindings(wsId);
  const {
    data: channels = [],
    isLoading: channelsLoading,
    isFetching: channelsFetching,
    isError: channelsError,
    refetch: refetchChannels,
  } = useSlackChannels(wsId, pickerOpen);
  const createBinding = useCreateSlackBinding(wsId);
  const updateBinding = useUpdateSlackBinding(wsId);
  const deleteBinding = useDeleteSlackBinding(wsId);
  const { data: eventTypes = [] } = useSlackNotifyEventTypes(wsId);

  const boundChannelIds = new Set(bindings.map((b) => b.external_channel_id));

  // `is_member` says whether the bot has joined the channel, and membership is
  // what makes a binding actually work: app_mention only fires and
  // chat.postMessage only succeeds in channels the bot is in.
  //
  // With the channels:join scope the server joins public channels for us
  // during the bind, so non-member public channels are offered normally.
  // Without it (connections installed before that scope existed) only channels
  // someone already invited the bot to can be bound, so we filter and explain.
  const canAutoJoin = scopes.includes("channels:join");
  const availableChannels = channels
    .filter((c) => !boundChannelIds.has(c.id))
    .filter((c) => c.is_member || (canAutoJoin && !c.is_private))
    .sort(
      (a, b) =>
        Number(b.is_member) - Number(a.is_member) || a.name.localeCompare(b.name),
    );
  // Public channels we could offer if the connection were re-authorized.
  const joinableAfterReconnect = canAutoJoin
    ? 0
    : channels.filter(
        (c) => !c.is_member && !c.is_private && !boundChannelIds.has(c.id),
      ).length;

  const handleBind = async (channelId: string, channelName: string) => {
    try {
      await createBinding.mutateAsync({
        external_channel_id: channelId,
        external_channel_name: channelName,
      });
      toast.success(`Bound #${channelName}`);
      setPickerOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to bind channel");
    }
  };

  const handleUnbind = async (bindingId: string, channelName: string | null) => {
    try {
      await deleteBinding.mutateAsync(bindingId);
      toast.success(`Unbound ${channelName ? `#${channelName}` : "channel"}`);
    } catch (e: unknown) {
      toast.error((e as Error)?.message ?? "Failed to unbind channel");
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
            className="size-8 rounded"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {conn.provider_account_name ?? conn.provider_account_id}
          </p>
          <p className="text-xs text-muted-foreground">
            Team ID: <code className="font-mono">{conn.provider_account_id}</code>
            {" · "}Connected {new Date(conn.connected_at).toLocaleDateString()}
          </p>
        </div>
        <a
          href={slackAppsURL}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Open in Slack"
        >
          Open in Slack <ExternalLink className="size-3" />
        </a>
      </div>

      {/* Bindings */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">
            Bound channels ({bindings.length})
          </p>
          {canManage && (
            <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPickerOpen(true)}
              >
                <Plus className="size-3 mr-1" />
                Bind channel
              </Button>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <DialogTitle>Bind a Slack channel</DialogTitle>
                      <DialogDescription>
                        {canAutoJoin ? (
                          <>
                            Routes messages from this channel to the current
                            workspace. The bot joins public channels automatically
                            when you bind them. Private channels need{" "}
                            <code>/invite @agenthost</code> in Slack first.
                          </>
                        ) : (
                          <>
                            Routes messages from this channel to the current
                            workspace. Only channels the bot has already been added
                            to can be bound. Run <code>/invite @agenthost</code> in
                            the channel, then click ↻ to refresh.
                          </>
                        )}
                      </DialogDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => refetchChannels()}
                      disabled={channelsFetching}
                      title="Refresh channel list"
                    >
                      <RefreshCw
                        className={`size-3.5 ${channelsFetching ? "animate-spin" : ""}`}
                      />
                    </Button>
                  </div>
                </DialogHeader>
                <div className="py-2 max-h-80 overflow-y-auto">
                  {joinableAfterReconnect > 0 && (
                    <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">
                        {joinableAfterReconnect} more channel
                        {joinableAfterReconnect === 1 ? "" : "s"} available after
                        reconnecting
                      </p>
                      <p className="mt-1">
                        This connection was installed before the{" "}
                        <code className="font-mono">channels:join</code> scope, so the
                        bot can&apos;t add itself to channels. Disconnect and
                        reconnect Slack to bind any public channel in one click.
                      </p>
                    </div>
                  )}
                  {channelsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading channels…</p>
                  ) : channelsError ? (
                    <p className="text-sm text-destructive">Failed to load channels.</p>
                  ) : availableChannels.length === 0 ? (
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p>No channels available to bind.</p>
                      <p className="text-xs">
                        {channels.length === 0
                          ? "The bot can't see any channels in this Slack workspace yet."
                          : canAutoJoin
                            ? "Every channel the bot can see is already bound to a workspace. Private channels need /invite @agenthost in Slack before they show up here."
                            : "Open Slack, run /invite @agenthost in the channel you want, then click ↻ to refresh this list."}
                      </p>
                    </div>
                  ) : (
                    <Command>
                      <CommandInput placeholder="Search channels…" />
                      <CommandList>
                        <CommandEmpty>No matches.</CommandEmpty>
                        <CommandGroup>
                          {availableChannels.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => handleBind(c.id, c.name)}
                              disabled={createBinding.isPending}
                            >
                              <span className="font-mono text-xs mr-2 text-muted-foreground">
                                {c.is_private ? <Lock className="size-3 inline" /> : "#"}
                              </span>
                              <span className="truncate">{c.name}</span>
                              <span className="ml-auto flex items-center gap-1 shrink-0">
                                {c.is_private && (
                                  <Badge variant="outline" className="text-[10px]">
                                    private
                                  </Badge>
                                )}
                                {!c.is_member && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] text-muted-foreground"
                                    title="The bot will join this channel when you bind it"
                                  >
                                    bot will join
                                  </Badge>
                                )}
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {bindings.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No channels bound yet. Bind a channel to route Slack messages to this workspace.
          </p>
        ) : (
          <div className="space-y-2">
            {bindings.map((b) => (
              <BoundChannelRow
                key={b.id}
                binding={b}
                eventTypes={eventTypes}
                canManage={canManage}
                onUnbind={() => handleUnbind(b.id, b.external_channel_name)}
                onToggleEvent={(value, enabled) =>
                  updateBinding.mutate({
                    bindingId: b.id,
                    args: {
                      event_filters: enabled
                        ? [...b.event_filters, value]
                        : b.event_filters.filter((f) => f !== value),
                    },
                  })
                }
                unbindPending={deleteBinding.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Granted scopes */}
      {scopes.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1.5">
            Granted bot scopes ({scopes.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {scopes.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-mono">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Capability summary */}
      <div className="rounded-lg border p-3 space-y-2 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What&apos;s wired up</p>
        <ul className="space-y-1">
          {SLACK_CAPABILITIES.map((c) => (
            <li key={c} className="flex items-start gap-1.5">
              <CheckCircle2 className="size-3 mt-0.5 shrink-0 text-emerald-500" />
              <span>{c}</span>
            </li>
          ))}
        </ul>
        <p className="pt-1">
          In a bound channel, mention <code className="font-mono">@agenthost</code> to start a
          thread, or run <code className="font-mono">/agenthost help</code> for the full command
          list.
        </p>
      </div>
    </div>
  );
}

// SLACK_CAPABILITIES is prose, not a feature flag: keep it honest about what
// the server actually does, since a settings panel that overstates the surface
// is how users end up reporting "notifications are broken" for something that
// was never switched on.
const SLACK_CAPABILITIES = [
  "OAuth install — the bot joins your Slack workspace",
  "Channel binding — bound channels route to this workspace",
  "@agenthost mentions start an agent chat thread, replies stream both ways",
  "/agenthost slash commands for issue create, show, assign, status, and dispatch",
  "Per-channel notifications on the events you pick below",
];

// ── Bound channel row ────────────────────────────────────────────────────────

function BoundChannelRow({
  binding,
  eventTypes,
  canManage,
  onUnbind,
  onToggleEvent,
  unbindPending,
}: {
  binding: ChatChannelBinding;
  eventTypes: SlackNotifyEventType[];
  canManage: boolean;
  onUnbind: () => void;
  onToggleEvent: (value: string, enabled: boolean) => void;
  unbindPending: boolean;
}) {
  const enabled = new Set(binding.event_filters);

  return (
    <div className="rounded-md border text-sm">
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-muted-foreground">#</span>
        <span className="flex-1 truncate">
          {binding.external_channel_name ?? binding.external_channel_id}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {binding.external_channel_id}
        </span>
        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive shrink-0"
            onClick={onUnbind}
            disabled={unbindPending}
            title="Unbind"
          >
            <Trash2 className="size-3" />
          </Button>
        )}
      </div>

      {eventTypes.length > 0 && (
        <div className="border-t px-2 py-2 space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Post to this channel when
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {eventTypes.map((et) => (
              <label
                key={et.value}
                className={`flex items-center gap-1.5 text-xs ${
                  canManage ? "cursor-pointer" : "cursor-default opacity-70"
                }`}
              >
                <Checkbox
                  checked={enabled.has(et.value)}
                  disabled={!canManage}
                  onCheckedChange={(checked) => onToggleEvent(et.value, checked === true)}
                />
                <span>{et.label}</span>
              </label>
            ))}
          </div>
          {enabled.size === 0 && (
            <p className="text-[11px] text-muted-foreground italic">
              Nothing selected, so this channel only receives chat replies.
            </p>
          )}
        </div>
      )}
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
  slackClientId,
}: {
  def: ProviderDef;
  conn?: IntegrationConnection;
  wsId: string;
  wsSlug: string;
  canManage: boolean;
  githubClientId?: string;
  slackClientId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const disconnect = useDisconnectIntegration(wsId);
  const isConnected = !!conn && conn.status === "active";
  const Icon = def.icon;

  const handleConnect = () => {
    if (def.key === "github") {
      window.location.href = api.getGitHubOAuthURL(wsSlug);
    } else if (def.key === "slack") {
      window.location.href = api.getSlackOAuthURL(wsSlug);
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
            <Icon className={`size-5 ${def.iconWhite ? "text-white" : ""}`} />
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
                  disabled={
                    (def.key === "github" && !githubClientId) ||
                    (def.key === "slack" && !slackClientId)
                  }
                  title={
                    def.key === "github" && !githubClientId
                      ? "GITHUB_CLIENT_ID not configured"
                      : def.key === "slack" && !slackClientId
                      ? "SLACK_CLIENT_ID not configured"
                      : undefined
                  }
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
            {def.key === "slack" && (
              <SlackManagePanel wsId={wsId} conn={conn!} canManage={canManage} />
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
                  slackClientId={config?.slack_client_id}
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
                    slackClientId={config?.slack_client_id}
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
