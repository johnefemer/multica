import type { Metadata } from "next";
import { AboutPageClient } from "@/features/landing/components/about-page-client";

export const metadata: Metadata = {
  title: "About",
  description:
    "About Agenthost — an open-source project management platform built around the idea that coding agents are real teammates, not tools.",
  openGraph: {
    title: "About Agenthost",
    description:
      "The story behind Agenthost and why we're building project management for human + agent teams.",
    url: "/about",
  },
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}
