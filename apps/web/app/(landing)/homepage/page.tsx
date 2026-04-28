import type { Metadata } from "next";
import { AgenthostLanding } from "@/features/landing/components/agenthost-landing";

export const metadata: Metadata = {
  title: "Homepage",
  description:
    "Agenthost — open-source platform that turns coding agents into real teammates. Assign tasks, track progress, compound skills.",
  openGraph: {
    title: "Agenthost — Project Management for Human + Agent Teams",
    description:
      "Manage your human + agent workforce in one place.",
    url: "/homepage",
  },
  alternates: {
    canonical: "/homepage",
  },
};

export default function HomepagePage() {
  return <AgenthostLanding />;
}
