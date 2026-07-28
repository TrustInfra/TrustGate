import type { IntelligenceInput } from "./types";

/**
 * Build human-readable behavioral summaries without leaking formula weights.
 * Max 5 bullets; safe for public API and audit trails.
 */
export function buildSummary(input: IntelligenceInput): string[] {
  const out: string[] = [];
  const tier = (input.tier || "").toUpperCase();
  const score = input.score;
  const conf = input.confidence;
  const flags = new Set(input.flags.map((f) => f.toUpperCase()));

  if (tier === "VERIFIED") {
    out.push("Official issuer contract — canonical ecosystem asset");
  } else if (tier === "HIGH_ELITE" || tier === "ELITE") {
    out.push("Sustained high-standing behavioral profile");
  } else if (tier === "HIGH") {
    out.push("Consistent onchain activity with credible signal density");
  } else if (tier === "MEDIUM") {
    out.push("Moderate behavioral history; treat as building track record");
  } else if (tier === "LOW") {
    out.push("Limited or concerning behavioral signals");
  } else if (tier === "BLOCKED" || score === 0) {
    out.push("Blocked or zero-trust standing based on observed behavior");
  }

  if (conf >= 80) {
    out.push("High data density behind this evaluation");
  } else if (conf >= 50) {
    out.push("Moderate data density — score is directionally useful");
  } else {
    out.push("Sparse data — interpret with caution");
  }

  if (flags.has("HONEYPOT_PATTERN")) {
    out.push("Honeypot-like transfer restrictions or trap patterns detected");
  }
  if (flags.has("WASH_TRADING") || flags.has("COORDINATED_BUY")) {
    out.push("Coordinated or circular activity patterns observed");
  }
  if (flags.has("EXIT_SYNC") || flags.has("COORDINATED_EXIT")) {
    out.push("Synchronized exit behavior among holders");
  }
  if (flags.has("LOW_HOLDER_QUALITY") || flags.has("HOLDER_CONCENTRATION")) {
    out.push("Holder base is concentrated or low quality");
  }
  if (flags.has("CREATOR_DUMPING")) {
    out.push("Creator or deployer distribution risk");
  }
  if (flags.has("SINGLE_WALLET_DOMINANCE")) {
    out.push("Single-wallet interaction dominance");
  }
  if (flags.has("UPGRADE_PATTERN_RISK")) {
    out.push("Frequent upgrade or proxy churn");
  }
  if (flags.has("VELOCITY") || flags.has("INTERACTION_VELOCITY")) {
    out.push("Abnormally high interaction velocity");
  }
  if (flags.has("STAKING_COMMITTED")) {
    out.push("Demonstrates economic commitment via staking");
  }
  if (flags.has("STAKING_GAMING")) {
    out.push("Staking pattern resembles gaming or circular locks");
  }

  for (const lim of input.limitations ?? []) {
    if (out.length >= 5) break;
    if (!out.includes(lim)) out.push(lim);
  }

  for (const obs of input.observations ?? []) {
    if (out.length >= 5) break;
    if (!out.includes(obs)) out.push(obs);
  }

  if (out.length === 0) {
    out.push("Behavioral evaluation completed from onchain observations");
  }

  return out.slice(0, 5);
}
