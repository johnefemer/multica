"use client";

import { useState } from "react";
import { Trash2, GitBranch, Eye, EyeOff, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { AgentRuntime } from "@multica/core/types";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { memberListOptions } from "@multica/core/workspace/queries";
import { useDeleteRuntime, useUpdateRuntimeSettings } from "@multica/core/runtimes/mutations";
import { Button } from "@multica/ui/components/ui/button";
import { Input } from "@multica/ui/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@multica/ui/components/ui/alert-dialog";
import { ActorAvatar } from "../../common/actor-avatar";
import { formatLastSeen, getMulticaCliVersion } from "../utils";
import { StatusBadge, InfoField } from "./shared";
import { ProviderLogo } from "./provider-logo";
import { PingSection } from "./ping-section";
import { UpdateSection } from "./update-section";
import { UsageSection } from "./usage-section";

function getLaunchedBy(metadata: Record<string, unknown>): string | null {
  if (
    metadata &&
    typeof metadata.launched_by === "string" &&
    metadata.launched_by
  ) {
    return metadata.launched_by;
  }
  return null;
}

function getGHAvailable(metadata: Record<string, unknown>): boolean {
  return metadata?.gh_available === true;
}

function getGHUser(metadata: Record<string, unknown>): string | null {
  return typeof metadata?.gh_user === "string" ? metadata.gh_user : null;
}

function GitHubTokenSection({
  runtime,
  wsId,
}: {
  runtime: AgentRuntime;
  wsId: string;
}) {
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const updateSettings = useUpdateRuntimeSettings(wsId, runtime.id);

  const isSet = runtime.settings?.github_token_set === true;
  const preview = runtime.settings?.github_token_preview;
  const ghAvailable = getGHAvailable(runtime.metadata);
  const ghUser = getGHUser(runtime.metadata);

  const handleSave = () => {
    if (!token.trim()) return;
    updateSettings.mutate(
      { github_token: token.trim() },
      {
        onSuccess: () => {
          toast.success("GitHub token saved");
          setToken("");
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to save token");
        },
      },
    );
  };

  const handleClear = () => {
    updateSettings.mutate(
      { github_token: null },
      {
        onSuccess: () => {
          toast.success("GitHub token cleared");
          setClearConfirmOpen(false);
        },
        onError: (e) => {
          toast.error(e instanceof Error ? e.message : "Failed to clear token");
          setClearConfirmOpen(false);
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      {/* gh CLI status */}
      <div className="flex items-center gap-2 text-sm">
        {ghAvailable ? (
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        <span className="text-muted-foreground">
          {ghAvailable
            ? ghUser
              ? `gh CLI authenticated as ${ghUser}`
              : "gh CLI available (not authenticated)"
            : "gh CLI not detected on this runtime"}
        </span>
      </div>

      {/* Stored PAT */}
      {isSet && preview && (
        <div className="flex items-center gap-2 text-sm rounded-md border bg-muted/30 px-3 py-2">
          <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-mono text-xs flex-1">{preview}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-destructive hover:text-destructive"
            onClick={() => setClearConfirmOpen(true)}
            disabled={updateSettings.isPending}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Token input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showToken ? "text" : "password"}
            placeholder={isSet ? "Enter new token to replace..." : "ghp_xxxx or github_pat_xxxx"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="pr-8 text-xs font-mono"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowToken((v) => !v)}
          >
            {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!token.trim() || updateSettings.isPending}
        >
          {updateSettings.isPending ? "Saving..." : isSet ? "Replace" : "Save"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Stored tokens are used by the daemon for private repo access and{" "}
        <code className="font-mono">gh</code> CLI calls. Generate a token at{" "}
        <a
          href="https://github.com/settings/tokens"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          github.com/settings/tokens
        </a>{" "}
        with <code className="font-mono">repo</code> scope.
      </p>

      {/* Clear confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={(v) => { if (!v) setClearConfirmOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear GitHub Token</AlertDialogTitle>
            <AlertDialogDescription>
              Remove the stored GitHub token from this runtime? The daemon will fall back to
              the local <code>gh</code> CLI or environment variables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleClear}
              disabled={updateSettings.isPending}
            >
              Clear Token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function RuntimeDetail({ runtime }: { runtime: AgentRuntime }) {
  const cliVersion =
    runtime.runtime_mode === "local" ? getMulticaCliVersion(runtime.metadata) : null;
  const launchedBy =
    runtime.runtime_mode === "local" ? getLaunchedBy(runtime.metadata) : null;

  const user = useAuthStore((s) => s.user);
  const wsId = useWorkspaceId();
  const { data: members = [] } = useQuery(memberListOptions(wsId));
  const deleteMutation = useDeleteRuntime(wsId);

  const [deleteOpen, setDeleteOpen] = useState(false);

  // Resolve owner info
  const ownerMember = runtime.owner_id
    ? members.find((m) => m.user_id === runtime.owner_id) ?? null
    : null;

  // Permission check for delete
  const currentMember = user
    ? members.find((m) => m.user_id === user.id)
    : null;
  const isAdmin = currentMember
    ? currentMember.role === "owner" || currentMember.role === "admin"
    : false;
  const isRuntimeOwner = user && runtime.owner_id === user.id;
  const canDelete = isAdmin || isRuntimeOwner;

  const handleDelete = () => {
    deleteMutation.mutate(runtime.id, {
      onSuccess: () => {
        toast.success("Runtime deleted");
        setDeleteOpen(false);
      },
      onError: (e) => {
        toast.error(e instanceof Error ? e.message : "Failed to delete runtime");
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center">
            <ProviderLogo provider={runtime.provider} className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate">{runtime.name}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={runtime.status} />
          {canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          <InfoField label="Runtime Mode" value={runtime.runtime_mode} />
          <InfoField label="Provider" value={runtime.provider} />
          <InfoField label="Status" value={runtime.status} />
          <InfoField
            label="Last Seen"
            value={formatLastSeen(runtime.last_seen_at)}
          />
          {ownerMember && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Owner</div>
              <div className="flex items-center gap-2">
                <ActorAvatar
                  actorType="member"
                  actorId={ownerMember.user_id}
                  size={20}
                />
                <span className="text-sm">{ownerMember.name}</span>
              </div>
            </div>
          )}
          {runtime.device_info && (
            <InfoField label="Device" value={runtime.device_info} />
          )}
          {runtime.daemon_id && (
            <InfoField label="Daemon ID" value={runtime.daemon_id} mono />
          )}
        </div>

        {/* CLI Version & Update */}
        {runtime.runtime_mode === "local" && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-3">
              CLI Version
            </h3>
            <UpdateSection
              runtimeId={runtime.id}
              currentVersion={cliVersion}
              isOnline={runtime.status === "online"}
              launchedBy={launchedBy}
            />
          </div>
        )}

        {/* Connection Test */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Connection Test
          </h3>
          <PingSection runtimeId={runtime.id} />
        </div>

        {/* GitHub Integration */}
        {runtime.runtime_mode === "local" && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-3">
              GitHub Integration
            </h3>
            <GitHubTokenSection runtime={runtime} wsId={wsId} />
          </div>
        )}

        {/* Usage */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground mb-3">
            Token Usage
          </h3>
          <UsageSection runtimeId={runtime.id} />
        </div>

        {/* Metadata */}
        {runtime.metadata && Object.keys(runtime.metadata).length > 0 && (
          <div>
            <h3 className="text-xs font-medium text-muted-foreground mb-2">
              Metadata
            </h3>
            <div className="rounded-lg border bg-muted/30 p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(runtime.metadata, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <InfoField
            label="Created"
            value={new Date(runtime.created_at).toLocaleString()}
          />
          <InfoField
            label="Updated"
            value={new Date(runtime.updated_at).toLocaleString()}
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={(v) => { if (!v) setDeleteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Runtime</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{runtime.name}&rdquo;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
