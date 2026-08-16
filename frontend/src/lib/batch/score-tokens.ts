import "server-only";

import {
  detectContractKind,
  isVerifiedIssuer,
  scoreContract,
} from "@/lib/contract-scoring";
import { assembleAndScoreNft } from "@/lib/nft-contract";
import { analyzeTokenTemporal } from "@/lib/token-behavior/temporal";
import {
  applyTemporalScoreDelta,
  readTemporalScoreWeight,
} from "@/lib/token-behavior/heuristics";
import {
  markCoordinatedExitParticipants,
} from "@/lib/token-behavior/wallet-marks";
import { deployerStakingBoost } from "@/lib/staking/signals";
import {
  confidenceEnumToNumber,
  recordIntelligence,
} from "@/lib/trust-intelligence/snapshots";
import { SCORING_VERSION } from "@/lib/scoring-version";
import type { BatchScore, Tier } from "@/lib/discovery/types";

const ARCSCAN_API = "https://testnet.arcscan.app";

interface ArcscanToken {
  name?: string | null;
  symbol?: string | null;
  exchange_rate?: string | null;
  holders?: string | number | null;
  holders_count?: string | number | null;
}

async function fetchTokenMeta(address: string): Promise<ArcscanToken | null> {
  try {
    const res = await fetch(`${ARCSCAN_API}/api/v2/tokens/${address}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ArcscanToken;
  } catch {
    return null;
  }
}

function mapTier(tier: string, score: number): Tier {
  const t = tier.toUpperCase();
  if (t === "VERIFIED") return "VERIFIED";
  if (t === "HIGH_ELITE" || t === "ELITE") return "ELITE";
  if (t === "HIGH") return "HIGH";
  if (t === "MEDIUM") return "MEDIUM";
  if (t === "LOW") return "LOW";
  if (t === "BLOCKED" || score === 0) return "BLOCKED";
  if (score >= 80) return "ELITE";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  if (score > 0) return "LOW";
  return "BLOCKED";
}

/**
 * Free local batch scorer for discovery (Phase 2b).
 * Does not charge x402; uses Arcscan + temporal + staking signals.
 */
export async function scoreTokenForBatch(address: string): Promise<BatchScore> {
  const lower = address.toLowerCase();

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return {
      address: lower,
      score: 0,
      tier: "BLOCKED",
      confidence: 0,
      flags: [],
      state: "graduated",
      error: "invalid_address",
    };
  }

  if (isVerifiedIssuer(address)) {
    const intel = recordIntelligence({
      subject: lower,
      subjectType: "token",
      score: 100,
      tier: "VERIFIED",
      confidence: 100,
      flags: [],
      scoringVersion: SCORING_VERSION,
      observations: ["Official issuer token"],
    });
    return {
      address: lower,
      score: 100,
      tier: "VERIFIED",
      confidence: intel.confidence,
      flags: [],
      state: "graduated",
    };
  }

  try {
    const detection = await detectContractKind(address);

    if (detection.kind === "not-contract") {
      return {
        address: lower,
        score: 0,
        tier: "BLOCKED",
        confidence: 0,
        flags: [],
        state: "graduated",
        error: "not_a_token",
      };
    }

    if (detection.kind === "fetch-failed") {
      return {
        address: lower,
        score: 0,
        tier: "BLOCKED",
        confidence: 0,
        flags: [],
        state: "graduated",
        error: "fetch_failed",
      };
    }

    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL ||
      "https://www.trustgated.xyz";
    const origin = siteOrigin.startsWith("http")
      ? siteOrigin
      : `https://${siteOrigin}`;

    if (detection.kind === "nft" && detection.info) {
      const nft = await assembleAndScoreNft(address, detection.info, origin);
      const conf = confidenceEnumToNumber(nft.confidence);
      const flags = nft.flags ?? [];
      recordIntelligence({
        subject: lower,
        subjectType: "token",
        score: nft.score,
        tier: nft.tier,
        confidence: conf,
        flags,
        scoringVersion: SCORING_VERSION,
      });
      return {
        address: lower,
        score: nft.score,
        tier: mapTier(nft.tier, nft.score),
        confidence: conf,
        flags,
        state: "graduated",
      };
    }

    if (detection.kind === "other-contract" && detection.info) {
      const scored = await scoreContract(address, detection.info, origin, {
        volumeAllTime: 0,
        volume7d: 0,
        volume30d: 0,
        usdcThroughput: 0,
      });
      const conf = confidenceEnumToNumber(scored.confidence);
      recordIntelligence({
        subject: lower,
        subjectType: "contract",
        score: scored.score,
        tier: scored.tier,
        confidence: conf,
        flags: scored.flags,
        scoringVersion: SCORING_VERSION,
      });
      return {
        address: lower,
        score: scored.score,
        tier: mapTier(scored.tier, scored.score),
        confidence: conf,
        flags: scored.flags,
        state: "graduated",
      };
    }

    // ERC-20 path: local temporal + meta + deployer staking
    const [meta, temporal, deployerBoost] = await Promise.all([
      fetchTokenMeta(address),
      analyzeTokenTemporal(address),
      deployerStakingBoost(detection.info?.creatorAddress),
    ]);

    const holders = Number(meta?.holders ?? meta?.holders_count ?? 0) || 0;
    // Mining = no meaningful holder market yet
    const state = holders < 3 ? "mining" : "graduated";

    // Base score from holders / verification / temporal
    let score = 40;
    if (detection.info?.isVerified) score += 12;
    if (holders >= 1000) score += 25;
    else if (holders >= 100) score += 18;
    else if (holders >= 20) score += 10;
    else if (holders >= 5) score += 4;

    // scoreDelta still fully computed on temporal; weight 0 suppresses published impact until calibrated
    score += applyTemporalScoreDelta(
      temporal.scoreDelta,
      readTemporalScoreWeight()
    );
    score += deployerBoost.boost;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const flags = [
      ...temporal.flags,
      ...deployerBoost.flags,
    ];

    if (flags.includes("EXIT_SYNC") && temporal.exitParticipants.length > 0) {
      markCoordinatedExitParticipants(lower, temporal.exitParticipants);
    }

    // Confidence from sample density
    let confidence = 35;
    if (temporal.metrics.transferSample >= 40 && holders >= 20) confidence = 85;
    else if (temporal.metrics.transferSample >= 15 || holders >= 10) confidence = 60;
    else if (holders >= 3) confidence = 45;

    if (state === "mining") {
      // Deployer-proxy standing: use a conservative band
      score = Math.min(score, 70);
      confidence = Math.min(confidence, 50);
    }

    const tier = mapTier("", score);
    const intel = recordIntelligence({
      subject: lower,
      subjectType: "token",
      score,
      tier,
      confidence,
      flags,
      scoringVersion: SCORING_VERSION,
      observations: [
        ...temporal.observations,
        ...deployerBoost.observations,
      ],
    });

    return {
      address: lower,
      score,
      tier,
      confidence: intel.confidence,
      flags: [...new Set(flags)],
      state,
    };
  } catch (err) {
    console.error("[batch] score failed", address, err);
    return {
      address: lower,
      score: 0,
      tier: "BLOCKED",
      confidence: 0,
      flags: [],
      state: "graduated",
      error: "score_failed",
    };
  }
}

export async function scoreTokenBatch(
  addresses: string[],
  concurrency = 4
): Promise<BatchScore[]> {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const a of addresses) {
    const k = a.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(a);
  }

  const results: BatchScore[] = new Array(unique.length);
  let idx = 0;

  async function worker() {
    while (idx < unique.length) {
      const i = idx++;
      results[i] = await scoreTokenForBatch(unique[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, unique.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}
