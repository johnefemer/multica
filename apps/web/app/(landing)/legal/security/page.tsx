import type { Metadata } from "next";
import { LegalPageClient } from "@/features/landing/components/legal-page-client";

export const metadata: Metadata = {
  title: "Security",
  description:
    "An overview of the security architecture, controls, and disclosure process behind Agenthost.",
  openGraph: {
    title: "Security | Agenthost",
    description:
      "How Agenthost keeps your workspace and your code safe — architecture, encryption, isolation, and disclosure.",
    url: "/legal/security",
  },
  alternates: {
    canonical: "/legal/security",
  },
};

export default function SecurityPage() {
  return <LegalPageClient docKey="security" />;
}
