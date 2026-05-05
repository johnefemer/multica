import type { Metadata } from "next";
import { GitHubPageClient } from "@/features/landing/components/github-page-client";

export const metadata: Metadata = {
  title: "GitHub + Agenthost — AI agents on the issues that already exist",
  description:
    "Mirror your GitHub issues onto an AI-native task board. Agents pick them up; PRs land in the real repo. GitHub stays canonical. No migration, no second source of truth.",
  openGraph: {
    title: "GitHub + Agenthost — AI agents on the issues that already exist",
    description:
      "Mirror your GitHub issues onto an AI-native task board. Agents pick up; PRs land in the real repo.",
    url: "/github",
  },
  alternates: {
    canonical: "/github",
  },
};

export default function GitHubPage() {
  return <GitHubPageClient />;
}
