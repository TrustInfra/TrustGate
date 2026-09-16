/**
 * Combine TrustGate claim conviction into the integrator score.
 * Positive people/USDC lift the score. Negative people/USDC cut it.
 * Capped so a single whale cannot buy HIGH_ELITE or dump a subject to 0 alone.
 */

export interface ConvictionInput {
  /** Quality-weighted USDC and people. Fresh wallets contribute near zero. */
  supportUsd: number;
  challengeUsd: number;
  supportPeople: number;
  challengePeople: number;
  rawStakers?: number;
  qualityMass?: number;
}

export interface ConvictionResult {
  delta: number;
  netUsd: number;
  netPeople: number;
  flags: string[];
  observations: string[];
}

const PEOPLE_WEIGHT = 2;
const PEOPLE_CAP = 12;
const USD_CAP = 8;
const DELTA_CAP = 15;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function usdComponent(netUsd: number): number {
  if (Math.abs(netUsd) < 1) return 0;
  const mag = Math.min(USD_CAP, Math.floor(Math.log10(1 + Math.abs(netUsd)) * 4));
  return netUsd > 0 ? mag : -mag;
}

export function convictionDelta(input: ConvictionInput): ConvictionResult {
  const supportUsd = Math.max(0, input.supportUsd);
  const challengeUsd = Math.max(0, input.challengeUsd);
  const supportPeople = Math.max(0, input.supportPeople);
  const challengePeople = Math.max(0, input.challengePeople);

  const netUsd = supportUsd - challengeUsd;
  const netPeople = supportPeople - challengePeople;

  const people = clamp(netPeople * PEOPLE_WEIGHT, -PEOPLE_CAP, PEOPLE_CAP);
  const usd = usdComponent(netUsd);
  const delta = clamp(Math.round(people + usd), -DELTA_CAP, DELTA_CAP);

  const flags: string[] = [];
  const observations: string[] = [];
  if (supportPeople > 0 && challengePeople > 0) {
    flags.push("CONVICTION_CONTESTED");
    observations.push("Subject has both backing and challenge");
  }
  const raw = input.rawStakers ?? 0;
  const mass = input.qualityMass ?? 0;
  if (raw >= 5 && mass / raw < 0.25) {
    flags.push("CONVICTION_SYBIL_STAKE");
    observations.push("Most stakers are new or empty wallets and were discounted");
  }
  if (delta > 0) {
    flags.push("CONVICTION_POSITIVE");
    observations.push(`Claims net +${delta} on combined score`);
  } else if (delta < 0) {
    flags.push("CONVICTION_NEGATIVE");
    observations.push(`Claims net ${delta} on combined score`);
  }

  return { delta, netUsd, netPeople, flags, observations };
}

export function applyConvictionDelta(
  score: number,
  delta: number,
  cap = 100
): number {
  return Math.max(0, Math.min(cap, Math.round(score + delta)));
}

export function mergeConvictionInputs(
  parts: ConvictionInput[]
): ConvictionInput {
  return parts.reduce(
    (acc, p) => ({
      supportUsd: acc.supportUsd + p.supportUsd,
      challengeUsd: acc.challengeUsd + p.challengeUsd,
      supportPeople: acc.supportPeople + p.supportPeople,
      challengePeople: acc.challengePeople + p.challengePeople,
      rawStakers: (acc.rawStakers ?? 0) + (p.rawStakers ?? 0),
      qualityMass: (acc.qualityMass ?? 0) + (p.qualityMass ?? 0),
    }),
    {
      supportUsd: 0,
      challengeUsd: 0,
      supportPeople: 0,
      challengePeople: 0,
      rawStakers: 0,
      qualityMass: 0,
    }
  );
}
