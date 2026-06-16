import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TrustGate DEX Widget | Embed Onchain Trust Scoring in Inputs",
  description:
    "One script tag to add live wallet and token trust signals to any input field. No SDK, no API key. Works on Arc testnet and beyond.",
  alternates: {
    canonical: "/docs/widget-integration",
  },
  openGraph: {
    title: "TrustGate DEX Widget | Embed Onchain Trust Scoring in Inputs",
    description:
      "One script tag to add live wallet and token trust signals to any input field. No SDK, no API key. Works on Arc testnet and beyond.",
    url: "https://www.trustgated.xyz/docs/widget-integration",
    type: "website",
  },
};

export default function WidgetIntegrationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}