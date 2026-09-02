import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discovery | TrustGate",
  description:
    "Live Arc Testnet tokens scored in batch. Same ticker, different contracts. TrustGate supplies the signal. Ordering by it is a choice.",
  alternates: { canonical: "/discovery" },
  openGraph: {
    title: "Discovery | TrustGate",
    description:
      "Live Arc Testnet tokens scored in batch. Same ticker, different contracts. TrustGate supplies the signal. Ordering by it is a choice.",
    type: "website",
    url: "https://www.trustgated.xyz/discovery",
  },
};

export default function DiscoveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
