import type { Metadata } from "next";
import DocsSidebar from "@/components/docs/DocsSidebar";
import DocsMobileNav from "@/components/docs/DocsMobileNav";

export const metadata: Metadata = {
  title: "Docs | TrustGate",
  description:
    "Developer documentation for TrustGate -- integrate trust scoring, query the oracle, register agents, and gate access using on-chain reputation. REST, widgets, and contract references.",
  openGraph: {
    title: "Docs | TrustGate",
    description:
      "Developer documentation for TrustGate -- integrate trust scoring, query the oracle, register agents, and gate access using on-chain reputation. REST, widgets, and contract references.",
    type: "website",
    url: "https://www.trustgated.xyz/docs",
  },
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-12">
      <DocsSidebar />
      <main className="flex-1 min-w-0 py-10">
        <DocsMobileNav />
        {children}
      </main>
    </div>
  );
}
