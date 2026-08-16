import type { LadderBand, LadderConfig, LadderEvaluation } from "./types";

/**
 * Protocol-owned ladder evaluation. Pure — TrustGate does not set bands.
 * Fail-closed: no matching band or amount over band limit → reject.
 */
export function evaluateLadder(
  score: number,
  ladder: LadderConfig,
  opts?: {
    requestedAmount?: number;
    capability?: string;
    confidence?: number;
  }
): LadderEvaluation {
  const reasons: string[] = [];
  const bands = [...ladder.bands].sort((a, b) => a.minScore - b.minScore);

  if (bands.length === 0) {
    return {
      allowed: false,
      matchedBand: null,
      reasons: ["Protocol ladder has no bands — fail-closed"],
      policyOwner: "protocol",
    };
  }

  if (
    ladder.minConfidence != null &&
    opts?.confidence != null &&
    opts.confidence < ladder.minConfidence
  ) {
    reasons.push(
      `Confidence ${opts.confidence} below protocol minimum ${ladder.minConfidence}`
    );
  }

  let matched: LadderBand | null = null;
  for (const band of bands) {
    const upper = band.maxScore ?? 100;
    if (score >= band.minScore && score <= upper) {
      matched = band;
      break;
    }
  }

  if (!matched) {
    reasons.push(`Score ${score} matches no protocol ladder band`);
    return {
      allowed: false,
      matchedBand: null,
      reasons,
      policyOwner: "protocol",
    };
  }

  if (opts?.capability && matched.capability !== opts.capability) {
    // Find a band that both covers score and capability
    const capBand = bands.find((b) => {
      const upper = b.maxScore ?? 100;
      return (
        score >= b.minScore &&
        score <= upper &&
        b.capability === opts.capability
      );
    });
    if (!capBand) {
      reasons.push(
        `Score ${score} does not unlock capability "${opts.capability}" under protocol ladder`
      );
      return {
        allowed: false,
        matchedBand: matched,
        reasons,
        policyOwner: "protocol",
      };
    }
    matched = capBand;
  }

  if (matched.maxAmount != null && matched.maxAmount <= 0) {
    reasons.push(
      `Protocol band max is ${matched.maxAmount} for score ${score} — fail-closed`
    );
    return {
      allowed: false,
      matchedBand: matched,
      reasons,
      policyOwner: "protocol",
    };
  }

  if (
    opts?.requestedAmount != null &&
    matched.maxAmount != null &&
    opts.requestedAmount > matched.maxAmount
  ) {
    reasons.push(
      `Requested amount ${opts.requestedAmount} exceeds protocol band max ${matched.maxAmount} for score ${score} (capability ${matched.capability})`
    );
    return {
      allowed: false,
      matchedBand: matched,
      reasons,
      policyOwner: "protocol",
    };
  }

  if (reasons.length > 0) {
    return {
      allowed: false,
      matchedBand: matched,
      reasons,
      policyOwner: "protocol",
    };
  }

  return {
    allowed: true,
    matchedBand: matched,
    reasons: [
      `Protocol band allows capability "${matched.capability}"` +
        (matched.maxAmount != null ? ` up to ${matched.maxAmount}` : ""),
    ],
    policyOwner: "protocol",
  };
}

/**
 * ILLUSTRATIVE lending ladder only — not TrustGate policy.
 * Protocols must supply their own ladder in production.
 */
export const EXAMPLE_LENDING_LADDER: LadderConfig = {
  protocolId: "example-lending-dao",
  minConfidence: 40,
  multiFactorAcknowledged: true,
  allowedScoringVersions: undefined, // accept current
  bands: [
    {
      minScore: 0,
      maxScore: 24,
      capability: "borrow",
      maxAmount: 0,
    },
    {
      minScore: 25,
      maxScore: 48,
      capability: "borrow",
      maxAmount: 20_000,
    },
    {
      minScore: 49,
      maxScore: 60,
      capability: "borrow",
      maxAmount: 100_000,
    },
    {
      minScore: 61,
      maxScore: 90,
      capability: "borrow",
      maxAmount: 500_000,
    },
    {
      minScore: 91,
      maxScore: 100,
      capability: "borrow",
      maxAmount: 2_000_000,
    },
  ],
};

/** Non-financial illustrative ladder */
export const EXAMPLE_GOVERNANCE_LADDER: LadderConfig = {
  protocolId: "example-dao-governance",
  minConfidence: 30,
  multiFactorAcknowledged: true,
  bands: [
    { minScore: 0, maxScore: 39, capability: "none" },
    { minScore: 40, maxScore: 74, capability: "propose_reduced_weight" },
    { minScore: 75, maxScore: 100, capability: "full_governance" },
  ],
};
