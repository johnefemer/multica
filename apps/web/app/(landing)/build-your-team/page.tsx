import type { Metadata } from "next";
import { BuildYourTeamPageClient } from "@/features/landing/components/build-your-team-page-client";

export const metadata: Metadata = {
  title: "Build Your AI Team",
  description:
    "Plan your AI development team in 5 minutes. Chat with the Agenthost planner — we send you the architecture, the right tier, and a roadmap for your project.",
  openGraph: {
    title: "Agenthost — Build Your AI Team",
    description:
      "Plan your AI dev team in 5 minutes. The Agenthost planner emails you a tailored architecture, CI/CD posture, human-agent balance, Phase 0, and a 6-week roadmap.",
    url: "/build-your-team",
  },
  alternates: {
    canonical: "/build-your-team",
  },
};

export default function BuildYourTeamPage() {
  return <BuildYourTeamPageClient />;
}
