import type { Metadata } from "next";
import { TenXPageClient } from "@/features/landing/components/tenx-page-client";

export const metadata: Metadata = {
  title: "Become a 10x Dev",
  description:
    "Becoming a 10x developer in the AI era isn't about typing faster — it's about hiring an agent fleet that turns every solved problem into compounding leverage for your whole team.",
  openGraph: {
    title: "Agenthost — Become a 10x Dev",
    description:
      "The path from 2x → 5x → 10x: a five-point framework for engineers who run with an agent fleet on Agenthost.",
    url: "/10x",
  },
  alternates: {
    canonical: "/10x",
  },
};

export default function TenXPage() {
  return <TenXPageClient />;
}
