import "server-only";

import {
  detectContractKind,
  isVerifiedIssuer,
  scoreContract,
} from "@/lib/contract-scoring";
import { assembleAndScoreNft } from "@/lib/nft-contract";
import { analyzeTokenTemporal } from "@/lib/token-behavior/temporal";
import {
  markCoordinatedExitParticipants,
} from "@/lib/token-behavior/wallet-marks";
import {
  confidenceEnumToNumber,
  recordIntelligence,
} from "@/lib/trust-intelligence/snapshots";
import { SCORING_VERSION } from "@/lib/scoring-version";
import type { BatchScore, Tier } from "@/lib/discovery/types";
import { scoreErc20ViaUpstream } from "@/lib/widget-payment";
import { WidgetSpendLimitError } from "@/lib/widget-limit";

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

    // ERC-20 scores come from the same paid oracle as Token Shield and the
    // widget. Do not invent a second local number for the same address.
    if (detection.kind === "erc20") {
      try {
        const upstream = await scoreErc20ViaUpstream(address);
        const [meta, temporal] = await Promise.all([
          fetchTokenMeta(address),
          analyzeTokenTemporal(address),
        ]);
        const holders = Number(meta?.holders ?? meta?.holders_count ?? 0) || 0;
        const state = holders < 3 ? "mining" : "graduated";
        const flags = [
          ...new Set([...(upstream.flags ?? []), ...temporal.flags]),
        ];
        if (flags.includes("EXIT_SYNC") && temporal.exitParticipants.length > 0) {
          markCoordinatedExitParticipants(lower, temporal.exitParticipants);
        }
        const score = Math.max(0, Math.min(100, Math.round(upstream.score)));
        const tier = mapTier(upstream.tier, score);
        let confidence = 35;
        if (temporal.metrics.transferSample >= 40 && holders >= 20) {
          confidence = 85;
        } else if (temporal.metrics.transferSample >= 15 || holders >= 10) {
          confidence = 60;
        } else if (holders >= 3) {
          confidence = 45;
        }
        const intel = recordIntelligence({
          subject: lower,
          subjectType: "token",
          score,
          tier,
          confidence,
          flags,
          scoringVersion: SCORING_VERSION,
          observations: temporal.observations,
        });
        return {
          address: lower,
          score,
          tier,
          confidence: intel.confidence,
          flags,
          state,
        };
      } catch (err) {
        if (err instanceof WidgetSpendLimitError) {
          return {
            address: lower,
            score: 0,
            tier: "BLOCKED",
            confidence: 0,
            flags: [],
            state: "graduated",
            error: "rate_limited",
          };
        }
        throw err;
      }
    }

    return {
      address: lower,
      score: 0,
      tier: "BLOCKED",
      confidence: 0,
      flags: [],
      state: "graduated",
      error: "not_a_token",
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
