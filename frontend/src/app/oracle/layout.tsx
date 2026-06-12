import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Oracle | TrustGate",
  description:
    "Query on-chain trust scores for any wallet address. Pay-per-query reputation oracle powered by formula-based scoring on direct on-chain behavioral signals, settled in USDC via HTTP 402 on Arc.",
  openGraph: {
    title: "Oracle | TrustGate",
    description:
      "Query on-chain trust scores for any wallet address. Pay-per-query reputation oracle powered by formula-based scoring on direct on-chain behavioral signals, settled in USDC via HTTP 402 on Arc.",
    type: "website",
    url: "https://trustgated.xyz/oracle",
  },
};

export default function OracleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
