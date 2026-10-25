// Maps the public /api/arc-score payload into the fields the wallet scan shows.
// The paid oracle is a separate service. This view does not require a payment.

export interface PublicScoreBody {
  score: number;
  tier: string;
  blocked?: boolean;
  capped?: boolean;
  breakdown?: {
    txPoints?: number;
    usdcPoints?: number;
    contractPoints?: number;
    deployPoints?: number;
    txCount?: number;
    usdcBalanceHuman?: number;
    contractInteractions?: number;
    contractDeployments?: number;
  };
  error?: string;
}

export interface PublicScoreView {
  address: string;
  score: number;
  tier: string;
  recommendation: string;
  txCount: number;
  deployments: number;
  summary: string[];
  breakdown: {
    txPoints: number;
    usdcPoints: number;
    contractPoints: number;
    deploymentPoints: number;
    txCount: number;
    usdcBalance: number;
    contractInteractions: number;
    deployments: number;
  };
}

function recommendationFor(tier: string, blocked: boolean): string {
  if (blocked || tier === "BLOCKED") return "No onchain history";
  if (tier === "LOW") return "Thin history";
  if (tier === "MEDIUM") return "Active history";
  if (tier === "HIGH") return "Established history";
  if (tier === "HIGH_ELITE") return "Deep history";
  return tier;
}

export function toPublicScoreView(
  address: string,
  body: PublicScoreBody
): PublicScoreView {
  const b = body.breakdown ?? {};
  const txCount = b.txCount ?? 0;
  const deployments = b.contractDeployments ?? 0;
  const interactions = b.contractInteractions ?? 0;
  const usdc = b.usdcBalanceHuman ?? 0;
  const blocked = body.blocked === true || body.score === 0;
  const summary = [
    blocked
      ? "No transactions on Arc."
      : `${txCount.toLocaleString()} transactions on Arc.`,
    `${usdc.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC balance.`,
    `${interactions.toLocaleString()} contract interactions.`,
  ];
  if (body.capped) {
    summary.push("Score capped. Contract interaction history is thin.");
  }
  return {
    address,
    score: body.score,
    tier: body.tier,
    recommendation: recommendationFor(body.tier, blocked),
    txCount,
    deployments,
    summary,
    breakdown: {
      txPoints: b.txPoints ?? 0,
      usdcPoints: b.usdcPoints ?? 0,
      contractPoints: b.contractPoints ?? 0,
      deploymentPoints: b.deployPoints ?? 0,
      txCount,
      usdcBalance: usdc,
      contractInteractions: interactions,
      deployments,
    },
  };
}
