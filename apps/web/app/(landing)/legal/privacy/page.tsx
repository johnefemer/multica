import type { Metadata } from "next";
import { LegalPageClient } from "@/features/landing/components/legal-page-client";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Agenthost handles your data: what we collect, what we do not collect, and the rights you have over your information.",
  openGraph: {
    title: "Privacy Policy | Agenthost",
    description:
      "What information Agenthost collects, why we collect it, and how it is handled.",
    url: "/legal/privacy",
  },
  alternates: {
    canonical: "/legal/privacy",
  },
};

export default function PrivacyPage() {
  return <LegalPageClient docKey="privacy" />;
}
