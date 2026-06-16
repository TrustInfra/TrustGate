import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | TrustGate",
  description:
    "Manage your TrustGate account -- view trust scores, configure agent allowances, monitor payment activity, and gate access using on-chain reputation.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Dashboard | TrustGate",
    description:
      "Manage your TrustGate account -- view trust scores, configure agent allowances, monitor payment activity, and gate access using on-chain reputation.",
    type: "website",
    url: "https://www.trustgated.xyz/dashboard",
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
