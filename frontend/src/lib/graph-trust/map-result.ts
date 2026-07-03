import type {
  GraphResultType,
  GraphTier,
  GraphTrust,
  GraphTrustState,
  GlobalStanding,
  PathTrust,
} from "./types";

export interface PersonalizedTrustResult {
  address?: string;
  score?: number;
  confidence?: number;
  pathCount?: number;
  sources?: string[];
}

export interface ExplainTrustResult {
  address?: string;
  compositeScore?: number;
  confidence?: number;
  verdict?: string;
  topContributors?: unknown[];
}

function maskEntity(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function normalizeConfidencePct(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw <= 1 ? raw * 100 : raw;
}

/** Normalize Intuition trust scores (0-1, 0-10, or 0-100) to a 0-100 integer. */
export function normalizeGraphScore(raw: number, pathCount: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return pathCount > 0 ? 1 : 0;
  }

  let scaled: number;
  if (raw <= 1) {
    scaled = raw * 100;
  } else if (raw <= 10) {
    scaled = raw * 10;
  } else {
    scaled = raw;
  }

  const rounded = Math.round(Math.min(100, Math.max(0, scaled)));
  if (rounded === 0 && pathCount > 0) return 1;
  return rounded;
}

export function scoreToTier(
  graphScore: number,
  confidencePct: number,
  pathCount: number
): GraphTier {
  if (pathCount === 0 && graphScore <= 0) return "UNKNOWN";
  if (confidencePct < 15 && graphScore < 20) return "UNKNOWN";
  if (graphScore >= 70) return "HIGH";
  if (graphScore >= 40) return "MEDIUM";
  if (graphScore > 0) return "LOW";
  return "UNKNOWN";
}

export function resolveGraphState(
  pathCount: number,
  sourcesCount: number,
  rawScore: number,
  confidencePct: number
): GraphTrustState {
  if (pathCount === 0 && rawScore <= 0 && sourcesCount === 0) {
    return "not_found";
  }
  if (confidencePct < 50 || pathCount < 2 || sourcesCount < 2) {
    return "sparse";
  }
  return "indexed";
}

export function hasPersonalizedPath(
  result: PersonalizedTrustResult
): boolean {
  const pathCount = typeof result.pathCount === "number" ? result.pathCount : 0;
  const rawScore = typeof result.score === "number" ? result.score : 0;
  const sources = Array.isArray(result.sources) ? result.sources : [];
  return pathCount > 0 && (rawScore > 0 || sources.length > 0);
}

export function hasGlobalComposite(result: ExplainTrustResult | null): boolean {
  if (!result) return false;
  const verdict = (result.verdict ?? "").trim().toLowerCase();
  if (verdict === "insufficient data") return false;

  const composite = result.compositeScore ?? 0;
  const confidencePct = normalizeConfidencePct(result.confidence ?? 0);

  return composite > 0 || (confidencePct > 0 && verdict.length > 0);
}

export function mapGlobalStanding(
  result: ExplainTrustResult
): GlobalStanding {
  return {
    composite: Math.round(Math.min(100, Math.max(0, result.compositeScore ?? 0))),
    confidence: Math.round(normalizeConfidencePct(result.confidence ?? 0)),
    verdict: result.verdict?.trim() || "unknown",
  };
}

export function buildPathTrust(
  result: PersonalizedTrustResult
): PathTrust {
  const pathCount = typeof result.pathCount === "number" ? result.pathCount : 0;
  const sources = Array.isArray(result.sources)
    ? result.sources.filter((s): s is string => typeof s === "string")
    : [];
  const rawScore = typeof result.score === "number" ? result.score : 0;

  return {
    score: normalizeGraphScore(rawScore, pathCount),
    pathCount,
    sources,
  };
}

function standingLabel(tier: GraphTier): string {
  switch (tier) {
    case "HIGH":
      return "Strong";
    case "MEDIUM":
      return "Reasonable";
    case "LOW":
      return "Limited";
    default:
      return "Unclear";
  }
}

export function buildExplainer(
  resultType: GraphResultType,
  graphScore: number,
  graphTier: GraphTier,
  pathTrust: PathTrust | null,
  globalStanding: GlobalStanding | null
): string {
  if (resultType === "path" && pathTrust) {
    const connections = pathTrust.pathCount;
    const linked = pathTrust.sources.length;
    const connWord = connections === 1 ? "connection" : "connections";
    const acctWord = linked === 1 ? "account" : "accounts";
    return (
      `Trusted through ${connections} ${connWord} from ${linked} linked ${acctWord}. ` +
      `${standingLabel(graphTier)} graph standing.`
    );
  }

  if (resultType === "global_only" && globalStanding) {
    const verdict = globalStanding.verdict.toLowerCase();
    return (
      `No direct trust path to this address, but its overall attestation history ` +
      `scores ${globalStanding.composite}/100 (${verdict}) at ${globalStanding.confidence}% confidence. ` +
      `Treat with caution.`
    );
  }

  return (
    "The knowledge graph has not seen this address yet. No attestations, no connections. " +
    "Unknown, not bad."
  );
}

export function mergeGraphTrustResults(
  targetAddress: string,
  personalized: PersonalizedTrustResult,
  global: ExplainTrustResult | null
): GraphTrust {
  const pathExists = hasPersonalizedPath(personalized);
  const pathTrust = pathExists ? buildPathTrust(personalized) : null;
  const globalStanding = hasGlobalComposite(global)
    ? mapGlobalStanding(global!)
    : null;

  let resultType: GraphResultType;
  if (pathExists) {
    resultType = "path";
  } else if (globalStanding) {
    resultType = "global_only";
  } else {
    resultType = "not_found";
  }

  if (resultType === "not_found") {
    const explainer = buildExplainer("not_found", 0, "UNKNOWN", null, null);
    return {
      address: targetAddress,
      graphScore: 0,
      graphTier: "UNKNOWN",
      attestationCount: 0,
      endorsements: 0,
      connectedEntities: 0,
      state: "not_found",
      pathTrust: null,
      globalStanding: null,
      resultType,
      explainer,
    };
  }

  if (resultType === "global_only" && globalStanding) {
    const graphScore = globalStanding.composite;
    const graphTier = scoreToTier(
      graphScore,
      globalStanding.confidence,
      1
    );
    const state: GraphTrustState =
      globalStanding.confidence < 50 ? "sparse" : "indexed";
    const explainer = buildExplainer(
      "global_only",
      graphScore,
      graphTier,
      null,
      globalStanding
    );

    return {
      address: targetAddress,
      graphScore,
      graphTier,
      attestationCount: 0,
      endorsements: 0,
      connectedEntities: Array.isArray(global?.topContributors)
        ? global!.topContributors!.length
        : 0,
      state,
      pathTrust: null,
      globalStanding,
      resultType,
      explainer,
    };
  }

  // resultType === "path"
  const pathResult = personalized;
  const pathCount = pathTrust!.pathCount;
  const sources = pathTrust!.sources;
  const rawScore = typeof pathResult.score === "number" ? pathResult.score : 0;
  const rawConfidence =
    typeof pathResult.confidence === "number" ? pathResult.confidence : 0;
  const confidencePct = normalizeConfidencePct(rawConfidence);

  const graphScore = pathTrust!.score;
  const graphTier = scoreToTier(graphScore, confidencePct, pathCount);
  const state = resolveGraphState(
    pathCount,
    sources.length,
    rawScore,
    confidencePct
  );

  const targetLower = targetAddress.toLowerCase();
  const uniqueSources = sources.filter(
    (s) => s.toLowerCase() !== targetLower
  );
  const topRelationships = uniqueSources.slice(0, 5).map((entity) => ({
    entity: maskEntity(entity),
    relation: "trust path source",
  }));

  const explainer = buildExplainer(
    "path",
    graphScore,
    graphTier,
    pathTrust,
    null
  );

  return {
    address: targetAddress,
    graphScore,
    graphTier,
    attestationCount: pathCount,
    endorsements: uniqueSources.length,
    connectedEntities: sources.length,
    topRelationships:
      topRelationships.length > 0 ? topRelationships : undefined,
    state,
    pathTrust,
    globalStanding,
    resultType,
    explainer,
  };
}

/** @deprecated Use mergeGraphTrustResults. Kept for mock compatibility. */
export function mapPersonalizedTrustToGraphTrust(
  targetAddress: string,
  result: PersonalizedTrustResult
): GraphTrust {
  return mergeGraphTrustResults(targetAddress, result, null);
}