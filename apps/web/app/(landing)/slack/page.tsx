import type { Metadata } from "next";
import { SlackPageClient } from "@/features/landing/components/slack-page-client";

export const metadata: Metadata = {
  title: "Slack + Agenthost — assign AI agents from your Slack threads",
  description:
    "Threads become first-class agent sessions. @agenthost picks up tickets, ships code, and replies back to the same thread — without leaving Slack.",
  openGraph: {
    title: "Slack + Agenthost — assign AI agents from your Slack threads",
    description:
      "Threads become first-class agent sessions. @agenthost picks up tickets, ships code, and replies back to the same thread.",
    url: "/slack",
  },
  alternates: {
    canonical: "/slack",
  },
};

export default function SlackPage() {
  return <SlackPageClient />;
}
