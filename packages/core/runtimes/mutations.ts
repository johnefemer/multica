import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { runtimeKeys } from "./queries";

export function useDeleteRuntime(wsId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runtimeId: string) => api.deleteRuntime(runtimeId),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: runtimeKeys.all(wsId) });
    },
  });
}

export type RuntimeSettingsPatch = {
  github_token?: string | null;
  github_token_user?: string | null;
  github_token_scopes?: string | null;
  github_token_validated_at?: string | null;
};

export function useUpdateRuntimeSettings(wsId: string, runtimeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: RuntimeSettingsPatch) =>
      api.updateRuntimeSettings(runtimeId, settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: runtimeKeys.all(wsId) });
    },
  });
}
