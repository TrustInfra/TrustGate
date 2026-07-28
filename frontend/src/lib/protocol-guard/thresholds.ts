/**
 * Contextual trust thresholds (Phase 4 — INTERNAL_ROADMAP).
 * Protocol owns policy; these are recommended defaults.
 */

export type ActionContext =
  | "dex_swap"
  | "api_execution"
  | "borrow"
  | "governance_vote"
  | "treasury_control"
  | "generic"
  | "vote"; // alias for governance_vote

export interface ContextualThreshold {
  action: ActionContext;
  minTier: "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
  minScore: number;
  minConfidence: number;
  /** Flagged wallets must surface for review even if score passes */
  surfaceFlagsForReview: boolean;
  description: string;
}

const TIER_RANK: Record<string, number> = {
  BLOCKED: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  HIGH_ELITE: 4,
  ELITE: 4,
  VERIFIED: 4,
};

export const DEFAULT_THRESHOLDS: Record<string, ContextualThreshold> = {
  dex_swap: {
    action: "dex_swap",
    minTier: "BLOCKED",
    minScore: 0,
    minConfidence: 0,
    surfaceFlagsForReview: false,
    description: "DEX swap: any tier permitted",
  },
  api_execution: {
    action: "api_execution",
    minTier: "MEDIUM",
    minScore: 40,
    minConfidence: 30,
    surfaceFlagsForReview: true,
    description: "API execution: MEDIUM or above",
  },
  borrow: {
    action: "borrow",
    minTier: "HIGH",
    minScore: 60,
    minConfidence: 50,
    surfaceFlagsForReview: true,
    description: "Borrowing: HIGH or above with minimum confidence",
  },
  governance_vote: {
    action: "governance_vote",
    minTier: "HIGH",
    minScore: 60,
    minConfidence: 40,
    surfaceFlagsForReview: true,
    description: "Governance vote: HIGH or above; flagged wallets surface for review",
  },
  vote: {
    action: "vote",
    minTier: "HIGH",
    minScore: 60,
    minConfidence: 40,
    surfaceFlagsForReview: true,
    description: "Governance vote: HIGH or above; flagged wallets surface for review",
  },
  treasury_control: {
    action: "treasury_control",
    minTier: "HIGH_ELITE",
    minScore: 80,
    minConfidence: 60,
    surfaceFlagsForReview: true,
    description: "Treasury control: HIGH_ELITE required",
  },
  generic: {
    action: "generic",
    minTier: "LOW",
    minScore: 25,
    minConfidence: 20,
    surfaceFlagsForReview: true,
    description: "Generic protocol action floor",
  },
};

export function resolveThreshold(
  context: string,
  override?: Partial<ContextualThreshold>
): ContextualThreshold {
  const key = context === "vote" ? "governance_vote" : context;
  const base = DEFAULT_THRESHOLDS[key] ?? DEFAULT_THRESHOLDS.generic;
  return { ...base, ...override, action: base.action };
}

export function meetsThreshold(
  score: number,
  tier: string,
  confidence: number,
  threshold: ContextualThreshold
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const tr = TIER_RANK[tier.toUpperCase()] ?? 0;
  const need = TIER_RANK[threshold.minTier] ?? 0;
  if (tr < need) {
    reasons.push(
      `Tier ${tier} below required ${threshold.minTier} for ${threshold.action}`
    );
  }
  if (score < threshold.minScore) {
    reasons.push(
      `Score ${score} below minimum ${threshold.minScore} for ${threshold.action}`
    );
  }
  if (confidence < threshold.minConfidence) {
    reasons.push(
      `Confidence ${confidence}% below minimum ${threshold.minConfidence}% for ${threshold.action}`
    );
  }
  return { ok: reasons.length === 0, reasons };
}

/**
 * Trust Surface Area = f(tier, economic reach, coordination, capital access)
 * Higher = more potential damage if the actor is adversarial.
 * Normalized to roughly 0–100 for alert prioritization.
 */
export function computeTrustSurfaceArea(input: {
  score: number;
  tier: string;
  /** USD-ish economic reach (holdings / borrow / vote power proxy) */
  economicReachUsd?: number;
  /** 0–1 coordination intensity */
  coordinationScore?: number;
  /** 0–1 capital access (credit lines, vault roles, etc.) */
  capitalAccess?: number;
}): {
  surfaceArea: number;
  priority: "monitor" | "review" | "immediate";
  factors: {
    tierFactor: number;
    economicReach: number;
    coordinationScore: number;
    capitalAccess: number;
  };
} {
  const tier = input.tier.toUpperCase();
  // Invert trust: lower trust × higher reach = more surface
  const trustFactor = Math.max(0.1, 1 - input.score / 100);
  const tierPenalty =
    tier === "BLOCKED" ? 1.4 : tier === "LOW" ? 1.2 : tier === "MEDIUM" ? 1 : 0.7;

  const economicReach = Math.min(
    1,
    Math.log10(1 + Math.max(0, input.economicReachUsd ?? 0)) / 6
  );
  const coordinationScore = Math.max(
    0,
    Math.min(1, input.coordinationScore ?? 0)
  );
  const capitalAccess = Math.max(0, Math.min(1, input.capitalAccess ?? 0.3));

  const raw =
    trustFactor *
    tierPenalty *
    (0.35 + 0.65 * economicReach) *
    (0.5 + 0.5 * coordinationScore) *
    (0.5 + 0.5 * capitalAccess) *
    100;

  const surfaceArea = Math.round(Math.max(0, Math.min(100, raw)));
  const priority =
    surfaceArea >= 60 ? "immediate" : surfaceArea >= 30 ? "review" : "monitor";

  return {
    surfaceArea,
    priority,
    factors: {
      tierFactor: Math.round(trustFactor * tierPenalty * 100) / 100,
      economicReach: Math.round(economicReach * 100) / 100,
      coordinationScore: Math.round(coordinationScore * 100) / 100,
      capitalAccess: Math.round(capitalAccess * 100) / 100,
    },
  };
}
