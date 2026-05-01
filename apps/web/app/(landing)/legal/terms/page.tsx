import type { Metadata } from "next";
import { LegalPageClient } from "@/features/landing/components/legal-page-client";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Agenthost — the open-source platform that turns coding agents into real teammates, operated by Kensink Labs.",
  openGraph: {
    title: "Terms of Service | Agenthost",
    description: "How Agenthost is offered to you, and what we expect in return.",
    url: "/legal/terms",
  },
  alternates: {
    canonical: "/legal/terms",
  },
};

export default function TermsPage() {
  return <LegalPageClient docKey="terms" />;
}
