import type { Metadata } from "next";
import { ContactPageClient } from "@/features/landing/components/contact-page-client";

export const metadata: Metadata = {
  title: "Contact Agenthost — direct lines to founders, support, partners",
  description:
    "Direct emails for support, triage, legal, and partnerships — plus a contact form that lands in our shared founder inbox. We answer.",
  openGraph: {
    title: "Contact Agenthost — direct lines to founders, support, partners",
    description:
      "Direct emails for support, triage, legal, and partnerships. We answer.",
    url: "/contact",
  },
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
