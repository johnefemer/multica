export type IntegrationProvider = "github" | "slack" | "notion" | "email";
export type IntegrationStatus = "active" | "expired" | "error";

export interface IntegrationConnection {
  provider: IntegrationProvider;
  provider_account_id: string;
  provider_account_name: string | null;
  provider_account_avatar: string | null;
  scope: string | null;
  status: IntegrationStatus;
  error_message?: string | null;
  connected_at: string;
  connected_by: string;
}

export interface GitHubRepo {
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
}

export interface ImportIssuesResult {
  imported: number;
  skipped: number;
  failed: number;
}

export interface GitHubWebhookRegistration {
  repo: string;
  hook_id: number;
  exists_on_github?: boolean;
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_member: boolean;
}

export interface ChatChannelBinding {
  id: string;
  workspace_id: string;
  platform: "slack" | "discord" | "teams";
  external_team_id: string;
  external_channel_id: string;
  external_channel_name: string | null;
  created_at: string;
  created_by?: string;
}
