import type { Metadata } from "next";
import { LegalPageClient } from "@/features/landing/components/legal-page-client";

export const metadata: Metadata = {
  title: "Data Processing Addendum",
  description:
    "Data Processing Addendum that forms part of the Agenthost Terms of Service whenever Kensink Labs processes personal data on behalf of a customer.",
  openGraph: {
    title: "Data Processing Addendum | Agenthost",
    description:
      "How Kensink Labs processes personal data on behalf of customers, including subprocessor and international transfer terms.",
    url: "/legal/dpa",
  },
  alternates: {
    canonical: "/legal/dpa",
  },
};

export default function DpaPage() {
  return <LegalPageClient docKey="dpa" />;
}
