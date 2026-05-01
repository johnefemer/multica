import type { Metadata } from "next";
import { LegalPageClient } from "@/features/landing/components/legal-page-client";

export const metadata: Metadata = {
  title: "Sub-processors",
  description:
    "The list of subprocessors Kensink Labs uses to provide the Agenthost cloud service.",
  openGraph: {
    title: "Sub-processors | Agenthost",
    description:
      "Subprocessors that support the Agenthost cloud service — hosting, email, observability, and billing.",
    url: "/legal/sub-processors",
  },
  alternates: {
    canonical: "/legal/sub-processors",
  },
};

export default function SubProcessorsPage() {
  return <LegalPageClient docKey="subProcessors" />;
}
