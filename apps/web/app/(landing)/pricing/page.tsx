import type { Metadata } from "next";
import { PricingPageClient } from "@/features/landing/components/pricing-page-client";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Agenthost pricing for solo founders, software teams, and frontier firms. One-time setup, BYOK tokens, no per-agent tax.",
  openGraph: {
    title: "Agenthost — Pricing",
    description:
      "Three ways to run with Agenthost: solo founder pay-as-you-go, team workspace flat-rate, or a fully AI-driven frontier pipeline.",
    url: "/pricing",
  },
  alternates: {
    canonical: "/pricing",
  },
};

export default function PricingPage() {
  return <PricingPageClient />;
}
