/**
 * Two-tier explainability (Phase 3 — INTERNAL_ROADMAP).
 * Public: simple, fast, emotional. Protocol: structured, machine-readable.
 * Never exposes formula weights or thresholds that enable gaming.
 */

export interface PublicExplain {
  headline: string;
  lines: string[];
  tone: "positive" | "neutral" | "caution" | "danger";
}

export interface ProtocolExplain {
  confidence: number;
  riskCategories: string[];
  temporalSignals: string[];
  clusteringFlags: string[];
  stakingIndicators: string[];
  governanceRiskFlags: string[];
  limitations: string[];
  scoreStability?: string;
  directionDrivers?: string[];
}

export interface ExplainInput {
  score: number;
  tier: string;
  confidence: number;
  flags: string[];
  limitations?: string[];
  observations?: string[];
  scoreStability?: string;
  directionDrivers?: string[];
  subjectType?: "wallet" | "token" | "contract";
}

function tierHeadline(tier: string, confidence: number): {
  headline: string;
  tone: PublicExplain["tone"];
} {
  const t = tier.toUpperCase();
  if (t === "VERIFIED") {
    return { headline: "Verified issuer", tone: "positive" };
  }
  if (t === "BLOCKED" || t === "LOW") {
    return {
      headline: t === "BLOCKED" ? "Blocked — high risk" : "Low trust",
      tone: "danger",
    };
  }
  if (t === "MEDIUM") {
    return { headline: "Medium trust — building track record", tone: "neutral" };
  }
  if (confidence < 40) {
    return {
      headline: `${t === "HIGH_ELITE" || t === "ELITE" ? "Elite" : "High"} trust — low confidence`,
      tone: "caution",
    };
  }
  if (t === "HIGH_ELITE" || t === "ELITE") {
    return { headline: "Elite trust", tone: "positive" };
  }
  return { headline: "High trust", tone: "positive" };
}

/** Retail / DEX layer — plain language only. */
export function buildPublicExplain(input: ExplainInput): PublicExplain {
  const { headline, tone } = tierHeadline(input.tier, input.confidence);
  const lines: string[] = [];
  const flags = new Set(input.flags.map((f) => f.toUpperCase()));

  if (input.confidence < 40) {
    lines.push("New or sparse history — low confidence");
  }

  if (flags.has("HONEYPOT_PATTERN")) {
    lines.push("Possible honeypot pattern");
  }
  if (flags.has("EXIT_SYNC") || flags.has("COORDINATED_EXIT")) {
    lines.push("Coordinated exits detected");
  }
  if (flags.has("COORDINATED_BUY")) {
    lines.push("Coordinated buying detected");
  }
  if (flags.has("WASH_TRADING")) {
    lines.push("Wash-like trading activity");
  }
  if (
    flags.has("LOW_HOLDER_QUALITY") ||
    flags.has("HOLDER_CONCENTRATION")
  ) {
    lines.push("Weak or concentrated holder base");
  }
  if (flags.has("CREATOR_DUMPING") || flags.has("COORDINATED_EXIT_HISTORY")) {
    lines.push("Suspicious deployer or dump history");
  }
  if (flags.has("STAKING_GAMING")) {
    lines.push("Staking gaming risk");
  }
  if (flags.has("STAKING_COMMITTED") && tone === "positive") {
    lines.push("Shows economic commitment via staking");
  }

  if (lines.length === 0) {
    if (tone === "positive") lines.push("No major risk flags on this sample");
    else if (tone === "neutral") lines.push("Limited signal — proceed carefully");
    else lines.push("Elevated risk signals present");
  }

  return { headline, lines: lines.slice(0, 4), tone };
}

/** Protocol / DAO layer — structured, no formula leakage. */
export function buildProtocolExplain(input: ExplainInput): ProtocolExplain {
  const flags = input.flags.map((f) => f.toUpperCase());
  const riskCategories: string[] = [];
  const temporalSignals: string[] = [];
  const clusteringFlags: string[] = [];
  const stakingIndicators: string[] = [];
  const governanceRiskFlags: string[] = [];

  for (const f of flags) {
    if (
      f.includes("HONEYPOT") ||
      f.includes("EXIT") ||
      f.includes("WASH") ||
      f.includes("COORDINATED_BUY") ||
      f.includes("HOLDER")
    ) {
      temporalSignals.push(f);
    }
    if (
      f.includes("COORDINATED") ||
      f.includes("EXIT_SYNC") ||
      f.includes("CLUSTER") ||
      f.includes("RING")
    ) {
      clusteringFlags.push(f);
    }
    if (f.includes("STAKING") || f.includes("STAKE")) {
      stakingIndicators.push(f);
    }
    if (f.includes("GOVERNANCE") || f.includes("VOTE")) {
      governanceRiskFlags.push(f);
    }
    if (
      f.includes("VELOCITY") ||
      f.includes("SELF_INTERACTION") ||
      f.includes("BOT") ||
      f.includes("ANOMALY")
    ) {
      riskCategories.push("activity_pattern");
    }
    if (f.includes("EXIT") || f.includes("DUMP")) {
      riskCategories.push("exit_risk");
    }
    if (f.includes("WASH") || f.includes("HONEYPOT")) {
      riskCategories.push("market_manipulation");
    }
    if (f.includes("STAKING_GAMING")) {
      riskCategories.push("commitment_gaming");
    }
  }

  if (input.confidence < 40) riskCategories.push("sparse_data");
  if (input.score < 40) riskCategories.push("low_standing");

  for (const obs of input.observations ?? []) {
    if (/hold|exit|wash|honeypot|coordinat/i.test(obs)) {
      temporalSignals.push(obs);
    }
  }

  return {
    confidence: input.confidence,
    riskCategories: [...new Set(riskCategories)],
    temporalSignals: [...new Set(temporalSignals)].slice(0, 8),
    clusteringFlags: [...new Set(clusteringFlags)],
    stakingIndicators: [...new Set(stakingIndicators)],
    governanceRiskFlags: [...new Set(governanceRiskFlags)],
    limitations: (input.limitations ?? []).slice(0, 6),
    scoreStability: input.scoreStability,
    directionDrivers: input.directionDrivers,
  };
}

export function buildExplainability(input: ExplainInput): {
  public: PublicExplain;
  protocol: ProtocolExplain;
} {
  return {
    public: buildPublicExplain(input),
    protocol: buildProtocolExplain(input),
  };
}
