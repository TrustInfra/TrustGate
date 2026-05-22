import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Shield | TrustGate",
  description:
    "Score any token contract for risk before you trade. Token Shield analyzes deployment history, contract behavior, and on-chain signals to flag scams, honeypots, and high-risk assets in real time.",
  openGraph: {
    title: "Token Shield | TrustGate",
    description:
      "Score any token contract for risk before you trade. Token Shield analyzes deployment history, contract behavior, and on-chain signals to flag scams, honeypots, and high-risk assets in real time.",
    type: "website",
    url: "https://trustgated.xyz/token-shield",
  },
};

export default function TokenShieldLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
