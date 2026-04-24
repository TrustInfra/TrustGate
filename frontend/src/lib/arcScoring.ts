export interface ArcScoreBreakdown {
  txPoints: number;
  usdcPoints: number;
  contractPoints: number;
  deployPoints: number;
  txCount: number;
  usdcBalance: string;
  usdcBalanceHuman: number;
  contractInteractions: number;
  contractDeployments: number;
  scannedTxs: number;
}

export interface ScoreComponent {
  label: string;
  points: number;
  note: string;
  muted?: boolean;
}

export interface ArcScoreResult {
  finalScore: number;
  rawTotal: number;
  capped: boolean;
  blocked: boolean;
  tier: "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
  breakdown: ArcScoreBreakdown;
  components: {
    transactions: ScoreComponent;
    usdcBalance: ScoreComponent;
    contractInteractions: ScoreComponent;
    contractDeployments: ScoreComponent;
  };
}

interface ApiResponse {
  score: number;
  tier: ArcScoreResult["tier"];
  blocked: boolean;
  capped: boolean;
  breakdown: ArcScoreBreakdown;
  error?: string;
}

export async function calculateArcTrustScore(
  address: string
): Promise<ArcScoreResult> {
  const res = await fetch(`/api/arc-score/${address}`, {
    cache: "no-store",
  });

  let payload: ApiResponse;
  try {
    payload = (await res.json()) as ApiResponse;
  } catch {
    throw new Error(`Arc API returned non-JSON response (status ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(payload.error ?? `Arc API error (status ${res.status})`);
  }

  const { score, tier, blocked, capped, breakdown } = payload;

  const rawTotal =
    breakdown.txPoints +
    breakdown.usdcPoints +
    breakdown.contractPoints +
    breakdown.deployPoints;

  const components: ArcScoreResult["components"] = {
    transactions: {
      label: "Transaction score",
      points: breakdown.txPoints,
      note: blocked
        ? "No transactions found — wallet is BLOCKED"
        : `${breakdown.txCount} transactions on Arc`,
      muted: breakdown.txPoints === 0 && !blocked,
    },
    usdcBalance: {
      label: "USDC balance",
      points: breakdown.usdcPoints,
      note:
        breakdown.usdcPoints > 0
          ? `${breakdown.usdcBalanceHuman.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} USDC on Arc`
          : "Below 100 USDC threshold — 0 points",
      muted: breakdown.usdcPoints === 0,
    },
    contractInteractions: {
      label: "Contract interactions",
      points: breakdown.contractPoints,
      note:
        breakdown.contractInteractions < 3
          ? "Below 3 minimum — 0 points"
          : `${breakdown.contractInteractions} contract calls`,
      muted: breakdown.contractPoints === 0,
    },
    contractDeployments: {
      label: "Contract deployments",
      points: breakdown.deployPoints,
      note:
        breakdown.deployPoints > 0
          ? `${breakdown.contractDeployments} deployment${
              breakdown.contractDeployments === 1 ? "" : "s"
            } on Arc`
          : "No deployments on Arc — 0 points",
      muted: breakdown.deployPoints === 0,
    },
  };

  return {
    finalScore: score,
    rawTotal,
    capped,
    blocked,
    tier,
    breakdown,
    components,
  };
}
