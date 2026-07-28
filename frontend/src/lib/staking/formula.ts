/**
 * Staking points formula (Phase 3b — INTERNAL_ROADMAP).
 * Staking Points = Duration Score × Size Multiplier × Token Trust Multiplier
 * Pure module — testable without Arcscan.
 */

export type TokenTrustTier =
  | "HIGH_ELITE"
  | "ELITE"
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "BLOCKED"
  | "VERIFIED"
  | string;

export interface StakePositionInput {
  /** Days the stake has been (or was) locked */
  durationDays: number;
  /** USD-notional size of stake (approx OK) */
  sizeUsd: number;
  /** Trust tier of the staked token / staking target */
  tokenTier: TokenTrustTier;
  /** Staker is also deployer of the staked token */
  isSelfStake: boolean;
  /** Stake younger than 7 days — no points */
  /** (derived from durationDays < 7) */
  /** Participated in coordinated exit / wash — age resets */
  resetByMisbehavior: boolean;
}

export interface StakePointsBreakdown {
  durationMultiplier: number;
  sizeMultiplier: number;
  tokenTrustMultiplier: number;
  basePoints: number;
  rawPoints: number;
  awardedPoints: number;
  voidReason: string | null;
}

const BASE_POINTS = 10;

/** Duration score multiplier from INTERNAL_ROADMAP */
export function durationMultiplier(days: number): number {
  if (days < 7) return 0;
  if (days < 30) return 1;
  if (days < 90) return 2;
  if (days < 180) return 3;
  return 4;
}

/** Size multiplier — hard cap 2.5× */
export function sizeMultiplier(sizeUsd: number): number {
  if (sizeUsd < 10) return 0;
  if (sizeUsd < 100) return 1;
  if (sizeUsd < 1000) return 1.5;
  if (sizeUsd < 10000) return 2;
  return 2.5;
}

/** Token trust multiplier */
export function tokenTrustMultiplier(tier: TokenTrustTier): number {
  const t = String(tier).toUpperCase();
  if (t === "BLOCKED") return 0;
  if (t === "HIGH_ELITE" || t === "ELITE" || t === "VERIFIED") return 1.5;
  if (t === "HIGH") return 1.2;
  if (t === "MEDIUM") return 1;
  if (t === "LOW") return 0.5;
  return 1;
}

export function computeStakePoints(
  input: StakePositionInput
): StakePointsBreakdown {
  if (input.isSelfStake) {
    return {
      durationMultiplier: 0,
      sizeMultiplier: 0,
      tokenTrustMultiplier: 0,
      basePoints: BASE_POINTS,
      rawPoints: 0,
      awardedPoints: 0,
      voidReason: "self_staking",
    };
  }
  if (input.resetByMisbehavior) {
    return {
      durationMultiplier: 0,
      sizeMultiplier: sizeMultiplier(input.sizeUsd),
      tokenTrustMultiplier: tokenTrustMultiplier(input.tokenTier),
      basePoints: BASE_POINTS,
      rawPoints: 0,
      awardedPoints: 0,
      voidReason: "stake_age_reset_misbehavior",
    };
  }
  if (input.durationDays < 7) {
    return {
      durationMultiplier: 0,
      sizeMultiplier: sizeMultiplier(input.sizeUsd),
      tokenTrustMultiplier: tokenTrustMultiplier(input.tokenTier),
      basePoints: BASE_POINTS,
      rawPoints: 0,
      awardedPoints: 0,
      voidReason: "below_7_day_minimum",
    };
  }

  const d = durationMultiplier(input.durationDays);
  const s = sizeMultiplier(input.sizeUsd);
  const tt = tokenTrustMultiplier(input.tokenTier);
  const raw = BASE_POINTS * d * s * tt;

  if (tt === 0) {
    return {
      durationMultiplier: d,
      sizeMultiplier: s,
      tokenTrustMultiplier: 0,
      basePoints: BASE_POINTS,
      rawPoints: 0,
      awardedPoints: 0,
      voidReason: "blocked_token",
    };
  }
  if (s === 0) {
    return {
      durationMultiplier: d,
      sizeMultiplier: 0,
      tokenTrustMultiplier: tt,
      basePoints: BASE_POINTS,
      rawPoints: 0,
      awardedPoints: 0,
      voidReason: "size_below_minimum",
    };
  }

  return {
    durationMultiplier: d,
    sizeMultiplier: s,
    tokenTrustMultiplier: tt,
    basePoints: BASE_POINTS,
    rawPoints: raw,
    awardedPoints: raw,
    voidReason: null,
  };
}

/**
 * Aggregate positions into a 0–100 commitment score and soft wallet boost.
 * Diversity: 3+ distinct protocols → +10% on total points (capped).
 * Consistency: 12+ months spanning → +15% (capped).
 * Gradual decay: if last activity days ago, apply linear decay after 30 idle days.
 */
export function aggregateStakingScore(opts: {
  positions: StakePositionInput[];
  uniqueProtocols: number;
  activeSpanDays: number;
  daysSinceLastStake: number;
}): {
  totalPoints: number;
  committedScore: number;
  scoreBoost: number;
  diversityBonusApplied: boolean;
  consistencyBonusApplied: boolean;
  decayFactor: number;
} {
  let total = 0;
  for (const p of opts.positions) {
    total += computeStakePoints(p).awardedPoints;
  }

  let diversityBonusApplied = false;
  let consistencyBonusApplied = false;
  if (opts.uniqueProtocols >= 3 && total > 0) {
    total *= 1.1;
    diversityBonusApplied = true;
  }
  if (opts.activeSpanDays >= 365 && total > 0) {
    total *= 1.15;
    consistencyBonusApplied = true;
  }

  // Gradual decay after 30 days idle (not instant drop)
  let decayFactor = 1;
  if (opts.daysSinceLastStake > 30) {
    const extra = opts.daysSinceLastStake - 30;
    decayFactor = Math.max(0.25, 1 - extra / 365);
    total *= decayFactor;
  }

  // Map points to 0–100 commitment (soft curve, not a published threshold game)
  const committedScore = Math.max(
    0,
    Math.min(100, Math.round(Math.sqrt(total) * 8))
  );

  // Soft boost into wallet score: max +8, only if commitment solid
  const scoreBoost =
    committedScore >= 40 ? Math.min(8, Math.floor(committedScore / 15)) : 0;

  return {
    totalPoints: Math.round(total * 100) / 100,
    committedScore,
    scoreBoost,
    diversityBonusApplied,
    consistencyBonusApplied,
    decayFactor,
  };
}
