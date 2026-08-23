import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ChatChannelBinding, UpdateSlackBindingArgs } from "../types/integration";

export const integrationKeys = {
  all: (wsId: string) => ["integrations", wsId] as const,
  provider: (wsId: string, provider: string) => ["integrations", wsId, provider] as const,
  githubRepos: (wsId: string) => ["integrations", wsId, "github", "repos"] as const,
  githubWebhooks: (wsId: string) => ["integrations", wsId, "github", "webhooks"] as const,
  slackChannels: (wsId: string) => ["integrations", wsId, "slack", "channels"] as const,
  slackBindings: (wsId: string) => ["integrations", wsId, "slack", "bindings"] as const,
  slackEventTypes: (wsId: string) => ["integrations", wsId, "slack", "event-types"] as const,
};

export function useIntegrations(wsId: string) {
  return useQuery({
    queryKey: integrationKeys.all(wsId),
    queryFn: () => api.listIntegrations(wsId),
    enabled: !!wsId,
  });
}

export function useIntegration(wsId: string, provider: string) {
  return useQuery({
    queryKey: integrationKeys.provider(wsId, provider),
    queryFn: () => api.getIntegration(wsId, provider),
    enabled: !!wsId && !!provider,
  });
}

export function useGitHubRepos(wsId: string, enabled: boolean) {
  return useQuery({
    queryKey: integrationKeys.githubRepos(wsId),
    queryFn: () => api.listGitHubRepos(wsId),
    enabled: !!wsId && enabled,
  });
}

export function useGitHubWebhooks(wsId: string, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.githubWebhooks(wsId),
    queryFn: () => api.listGitHubWebhooks(wsId),
    enabled: !!wsId && enabled,
  });
}

export function useDisconnectIntegration(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.disconnectIntegration(wsId, provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.all(wsId) });
    },
  });
}

export interface ImportGitHubIssuesArgs {
  repo: string;
  projectId?: string | null;
}

export function useImportGitHubIssues(wsId: string) {
  return useMutation({
    mutationFn: ({ repo, projectId }: ImportGitHubIssuesArgs) =>
      api.importGitHubIssues(wsId, repo, projectId),
  });
}

export function useRegisterGitHubWebhook(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo: string) => api.registerGitHubWebhook(wsId, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.provider(wsId, "github") });
      qc.invalidateQueries({ queryKey: integrationKeys.githubWebhooks(wsId) });
    },
  });
}

export function useRemoveGitHubWebhook(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo: string) => api.removeGitHubWebhook(wsId, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.githubWebhooks(wsId) });
    },
  });
}

// ── Slack ──────────────────────────────────────────────────────────────────

export function useSlackChannels(wsId: string, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.slackChannels(wsId),
    queryFn: () => api.listSlackChannels(wsId),
    enabled: !!wsId && enabled,
    // Channel lists are large and stable — cache for 5 minutes.
    staleTime: 5 * 60 * 1000,
  });
}

export function useSlackBindings(wsId: string, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.slackBindings(wsId),
    queryFn: () => api.listSlackBindings(wsId),
    enabled: !!wsId && enabled,
  });
}

export interface CreateSlackBindingArgs {
  external_channel_id: string;
  external_channel_name: string;
}

export function useSlackNotifyEventTypes(wsId: string, enabled = true) {
  return useQuery({
    queryKey: integrationKeys.slackEventTypes(wsId),
    queryFn: () => api.listSlackNotifyEventTypes(wsId),
    enabled: !!wsId && enabled,
    // A server-side constant; no reason to refetch it during a session.
    staleTime: Infinity,
  });
}

export interface UpdateSlackBindingVars {
  bindingId: string;
  args: UpdateSlackBindingArgs;
}

export function useUpdateSlackBinding(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bindingId, args }: UpdateSlackBindingVars) =>
      api.updateSlackBinding(wsId, bindingId, args),
    // Optimistic: toggling a notification checkbox should feel instant, and a
    // failed write rolls the checkbox back rather than leaving it half-applied.
    onMutate: async ({ bindingId, args }) => {
      const key = integrationKeys.slackBindings(wsId);
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<ChatChannelBinding[]>(key);
      qc.setQueryData<ChatChannelBinding[]>(key, (old) =>
        old?.map((b) =>
          b.id === bindingId
            ? {
                ...b,
                ...(args.event_filters !== undefined
                  ? { event_filters: args.event_filters }
                  : {}),
                ...(args.default_agent_id !== undefined
                  ? { default_agent_id: args.default_agent_id || null }
                  : {}),
              }
            : b,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(integrationKeys.slackBindings(wsId), context.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.slackBindings(wsId) });
    },
  });
}

export function useCreateSlackBinding(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: CreateSlackBindingArgs) => api.createSlackBinding(wsId, args),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.slackBindings(wsId) });
    },
  });
}

export function useDeleteSlackBinding(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bindingId: string) => api.deleteSlackBinding(wsId, bindingId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.slackBindings(wsId) });
    },
  });
}
