import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";

export const integrationKeys = {
  all: (wsId: string) => ["integrations", wsId] as const,
  provider: (wsId: string, provider: string) => ["integrations", wsId, provider] as const,
  githubRepos: (wsId: string) => ["integrations", wsId, "github", "repos"] as const,
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

export function useDisconnectIntegration(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => api.disconnectIntegration(wsId, provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.all(wsId) });
    },
  });
}

export function useImportGitHubIssues(wsId: string) {
  return useMutation({
    mutationFn: (repo: string) => api.importGitHubIssues(wsId, repo),
  });
}

export function useRegisterGitHubWebhook(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (repo: string) => api.registerGitHubWebhook(wsId, repo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: integrationKeys.provider(wsId, "github") });
    },
  });
}
