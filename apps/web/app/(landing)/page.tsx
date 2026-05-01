import type { Metadata } from "next";
import { OpsLanding } from "@/features/landing/components/ops/ops-landing";
import { RedirectIfAuthenticated } from "@/features/landing/components/redirect-if-authenticated";

export const metadata: Metadata = {
  title: {
    absolute: "Agenthost — Control plane for AI-augmented engineering teams",
  },
  description:
    "Assign tickets to agents. Local daemons claim work. Sessions resume. Skills compound. One board for humans + agents — same primitives.",
  openGraph: {
    title: "Agenthost — Control plane for AI-augmented engineering teams",
    description:
      "Coding agents become assignable teammates on a board your humans already live on.",
    url: "/",
  },
  alternates: {
    canonical: "/",
  },
};

export default function LandingPage() {
  return (
    <>
      <RedirectIfAuthenticated />
      <OpsLanding />
    </>
  );
}
