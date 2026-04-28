"use client";

import { useEffect, useRef, useState } from "react";
import { Save, Plus, Trash2, GitBranch } from "lucide-react";
import { Input } from "@multica/ui/components/ui/input";
import { Button } from "@multica/ui/components/ui/button";
import { Card, CardContent } from "@multica/ui/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { useCurrentWorkspace, useWorkspacePaths } from "@multica/core/paths";
import { memberListOptions, workspaceKeys } from "@multica/core/workspace/queries";
import { useIntegration, useGitHubRepos } from "@multica/core/integrations";
import { api } from "@multica/core/api";
import type { GitHubRepo, Workspace, WorkspaceRepo } from "@multica/core/types";
import { AppLink } from "../../navigation";

/** Normalize repo URL for deduplication (https vs .git, case). */
export function workspaceRepoDedupeKey(url: string): string {
  const u = url.trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    let path = parsed.pathname.replace(/^\/+/, "").replace(/\.git$/i, "");
    return `${parsed.hostname.toLowerCase()}/${path.toLowerCase()}`;
  } catch {
    return u.toLowerCase().replace(/\.git$/i, "");
  }
}

function githubHttpsCloneUrl(fullName: string): string {
  return `https://github.com/${fullName}.git`;
}

export function RepositoriesTab() {
  const user = useAuthStore((s) => s.user);
  const workspace = useCurrentWorkspace();
  const paths = useWorkspacePaths();
  const wsId = useWorkspaceId();
  const qc = useQueryClient();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const { data: githubIntegration } = useIntegration(wsId, "github");

  const [repos, setRepos] = useState<WorkspaceRepo[]>(workspace?.repos ?? []);
  const [saving, setSaving] = useState(false);
  const [githubPickerOpen, setGithubPickerOpen] = useState(false);
  const githubConnected =
    githubIntegration != null && githubIntegration.status === "active";
  const { data: ghRepos = [], isLoading: ghReposLoading } = useGitHubRepos(
    wsId,
    githubPickerOpen && githubConnected,
  );

  const reposRef = useRef(repos);
  reposRef.current = repos;

  const currentMember = members.find((m) => m.user_id === user?.id) ?? null;
  const canManageWorkspace = currentMember?.role === "owner" || currentMember?.role === "admin";

  useEffect(() => {
    setRepos(workspace?.repos ?? []);
  }, [workspace]);

  const handleSave = async () => {
    if (!workspace) return;
    setSaving(true);
    try {
      const updated = await api.updateWorkspace(workspace.id, { repos });
      qc.setQueryData(workspaceKeys.list(), (old: Workspace[] | undefined) =>
        old?.map((ws) => (ws.id === updated.id ? updated : ws)),
      );
      toast.success("Repositories saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save repositories");
    } finally {
      setSaving(false);
    }
  };

  const handleAddRepo = () => {
    setRepos([...repos, { url: "", description: "" }]);
  };

  const handleRemoveRepo = (index: number) => {
    setRepos(repos.filter((_, i) => i !== index));
  };

  const handleRepoChange = (index: number, field: keyof WorkspaceRepo, value: string) => {
    setRepos(repos.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addGitHubRepo = (r: GitHubRepo) => {
    const url = githubHttpsCloneUrl(r.full_name);
    const key = workspaceRepoDedupeKey(url);
    const keys = new Set(
      reposRef.current.map((x) => workspaceRepoDedupeKey(x.url)).filter(Boolean),
    );
    if (keys.has(key)) {
      toast.message("Already in list", { description: r.full_name });
      return;
    }
    const description =
      (r.description && r.description.trim()) || r.full_name + (r.private ? " (private)" : "");
    setRepos((prev) => [...prev, { url, description }]);
    toast.success(`Added ${r.full_name}`);
  };

  if (!workspace) return null;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Repositories</h2>

        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Git repositories associated with this workspace. Agents use these URLs as an allowlist
              for <code className="text-[11px]">repo checkout</code>; clone auth uses the GitHub
              token on the <strong>runtime</strong> (or daemon env / <code className="text-[11px]">gh</code> on the host), not the workspace OAuth integration.
            </p>

            {canManageWorkspace && (
              <div className="flex flex-wrap items-center gap-2">
                {githubConnected ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setGithubPickerOpen(true)}
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    Add from GitHub
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <AppLink
                      href={paths.integrations()}
                      className="text-foreground underline underline-offset-2 hover:text-foreground/90"
                    >
                      Connect GitHub
                    </AppLink>{" "}
                    under Integrations to pick repos from your account without pasting URLs by hand.
                  </p>
                )}
              </div>
            )}

            {repos.map((repo, index) => (
              <div key={index} className="flex gap-2">
                <div className="flex-1 space-y-1.5">
                  <Input
                    type="url"
                    value={repo.url}
                    onChange={(e) => handleRepoChange(index, "url", e.target.value)}
                    disabled={!canManageWorkspace}
                    placeholder="https://git.example.com/org/repo.git"
                    className="text-sm"
                  />
                  <Input
                    type="text"
                    value={repo.description}
                    onChange={(e) => handleRepoChange(index, "description", e.target.value)}
                    disabled={!canManageWorkspace}
                    placeholder="Description (e.g. Go backend + Next.js frontend)"
                    className="text-sm"
                  />
                </div>
                {canManageWorkspace && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveRepo(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            {canManageWorkspace && (
              <div className="flex items-center justify-between pt-1">
                <Button variant="outline" size="sm" onClick={handleAddRepo}>
                  <Plus className="h-3 w-3" />
                  Add repository
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <Save className="h-3 w-3" />
                  {saving ? "Saving..." : "Save"}
                </Button>
              </div>
            )}

            {!canManageWorkspace && (
              <p className="text-xs text-muted-foreground">
                Only admins and owners can manage repositories.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      <Dialog open={githubPickerOpen} onOpenChange={setGithubPickerOpen}>
        <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Add from GitHub</DialogTitle>
            <DialogDescription>
              Repositories you can access with the connected GitHub account. Choosing one appends
              an HTTPS clone URL to the list (you still need to Save).
            </DialogDescription>
          </DialogHeader>
          <Command className="border-t">
            <CommandInput placeholder="Search by name…" />
            <CommandList className="max-h-[min(50vh,320px)]">
              {ghReposLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
              ) : (
                <>
                  <CommandEmpty>No matching repositories.</CommandEmpty>
                  <CommandGroup heading="Your GitHub repositories">
                    {ghRepos.map((r) => (
                      <CommandItem
                        key={r.full_name}
                        value={`${r.full_name} ${r.description ?? ""}`}
                        onSelect={() => {
                          addGitHubRepo(r);
                          setGithubPickerOpen(false);
                        }}
                      >
                        <span className="truncate font-medium">{r.full_name}</span>
                        {r.private && (
                          <span className="ml-2 shrink-0 text-xs text-muted-foreground">Private</span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </div>
  );
}
