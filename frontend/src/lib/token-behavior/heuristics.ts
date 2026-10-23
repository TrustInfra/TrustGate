/**
 * Pure temporal heuristics — no I/O, no server-only import.
 * Used by analyzeTokenTemporal and unit-tested in isolation.
 */

export interface FlowTransfer {
  from: string;
  to: string;
  amount: number;
  ts: number;
}

/** Multiplier on temporal.scoreDelta. Non-finite / missing → 0 (flags only). */
export function applyTemporalScoreDelta(
  scoreDelta: number,
  weight: number
): number {
  const w = Number.isFinite(weight) ? weight : 0;
  const d = Number.isFinite(scoreDelta) ? scoreDelta : 0;
  const n = d * w;
  return n === 0 ? 0 : n;
}

export function readTemporalScoreWeight(
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env.SCORING_TEMPORAL_SCORE_WEIGHT;
  if (raw == null || raw.trim() === "") return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Post-distribution buy vs sell volume.
 * Sell = early holder (not the primary distributor) sending to a new wallet.
 * Buy  = first-time receiver after the distribution window.
 * Excluding the primary distributor stops mint/airdrop legs from looking like exits.
 */
export function classifyPostDistributionVolume(
  transfers: FlowTransfer[],
  distPeriodMs: number
): { buyVolume: number; sellVolume: number } {
  if (transfers.length === 0 || !Number.isFinite(distPeriodMs) || distPeriodMs < 0) {
    return { buyVolume: 0, sellVolume: 0 };
  }

  const firstTs = transfers[0].ts;
  if (!firstTs) return { buyVolume: 0, sellVolume: 0 };
  const midTs = firstTs + distPeriodMs;

  const ZERO = "0x0000000000000000000000000000000000000000";
  const earlyRecipients = new Set<string>();
  const earlyInbound = new Map<string, number>();
  for (const t of transfers) {
    if (t.ts >= midTs) continue;
    if (t.to) {
      earlyRecipients.add(t.to);
      const amt = t.amount > 0 ? t.amount : 1;
      earlyInbound.set(t.to, (earlyInbound.get(t.to) ?? 0) + amt);
    }
  }

  // Treasury / minter = largest early inbound. Mint-from-zero is not a distributor.
  let primaryDistributor = "";
  let primaryIn = 0;
  for (const [addr, inn] of earlyInbound) {
    if (addr === ZERO) continue;
    if (inn > primaryIn) {
      primaryIn = inn;
      primaryDistributor = addr;
    }
  }

  let buyVolume = 0;
  let sellVolume = 0;
  for (const t of transfers) {
    if (t.ts < midTs) continue;
    const amt = t.amount > 0 ? t.amount : 1;
    const fromEarly = earlyRecipients.has(t.from);
    const toEarly = earlyRecipients.has(t.to);
    if (!toEarly) buyVolume += amt;
    if (fromEarly && !toEarly && t.from !== primaryDistributor) {
      sellVolume += amt;
    }
  }

  return { buyVolume, sellVolume };
}

/**
 * Count undirected pairs that traded in BOTH directions, repeatedly.
 * One-way flow (trader → router × N) is not wash.
 */
export function countBidirectionalWashPairs(
  transfers: Array<{ from: string; to: string }>,
  minEachDirection = 2
): number {
  const directed = new Map<string, number>();
  for (const t of transfers) {
    if (!t.from || !t.to || t.from === t.to) continue;
    const key = `${t.from}|${t.to}`;
    directed.set(key, (directed.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  let circular = 0;
  for (const [key, ab] of directed) {
    const sep = key.indexOf("|");
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    const pair = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    const ba = directed.get(`${b}|${a}`) ?? 0;
    if (ab >= minEachDirection && ba >= minEachDirection) {
      circular += 1;
    }
  }
  return circular;
}

/** Balanced inbound/outbound volume — wash, not directional trading. */
export function isWashWallet(flow: {
  buyCount: number;
  sellCount: number;
  bought: number;
  sold: number;
}): boolean {
  if (flow.buyCount < 3 || flow.sellCount < 3) return false;
  const peak = Math.max(flow.bought, flow.sold);
  if (peak <= 0) return false;
  return Math.min(flow.bought, flow.sold) / peak >= 0.7;
}

/** Last-N transfers of a large holder base are market tape, not a coordination study. */
export const ESTABLISHED_HOLDER_FLOOR = 500;
export const THIN_TRANSFER_SAMPLE = 150;

export function thinSampleIsUnrepresentative(
  holderCount: number,
  transferSample: number
): boolean {
  if (!Number.isFinite(holderCount) || !Number.isFinite(transferSample)) {
    return false;
  }
  return (
    holderCount >= ESTABLISHED_HOLDER_FLOOR &&
    transferSample <= THIN_TRANSFER_SAMPLE
  );
}

/**
 * Oracle wrote a LOW/0 fallback after failing to ingest holders, while the
 * indexer now reports a real holder base.
 */
export function isDataStarvedOracleRead(
  score: number,
  flags: readonly string[],
  holderCount: number
): boolean {
  if (!Number.isFinite(holderCount) || holderCount < 50) return false;
  if (Number.isFinite(score) && score > 10) return false;
  const codes = new Set(flags.map((f) => String(f).toUpperCase()));
  if (codes.has("HONEYPOT_PATTERN")) return false;
  return codes.has("LIQUIDITY_DATA_UNAVAILABLE");
}

export function scoreFromIndexerSignals(input: {
  holderCount: number;
  topHolderPct: number;
  transferSample: number;
  liquidityUsd: number | null;
  verified: boolean;
}): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 40;
  const holders = Math.max(0, Math.floor(input.holderCount));

  if (holders > 0 && holders < 15) {
    flags.push("LOW_HOLDER_QUALITY");
  } else if (holders >= 10_000) score += 28;
  else if (holders >= 1_000) score += 20;
  else if (holders >= 100) score += 12;
  else if (holders >= 15) score += 5;

  const top = Number.isFinite(input.topHolderPct) ? input.topHolderPct : 0;
  if (top >= 45) {
    flags.push("HOLDER_CONCENTRATION");
    score -= 15;
  } else if (top >= 25) {
    score -= 8;
  }

  const liq = input.liquidityUsd;
  if (liq == null || !Number.isFinite(liq) || liq <= 0) {
    flags.push("LIQUIDITY_DATA_UNAVAILABLE");
  } else if (liq >= 100_000) score += 10;
  else if (liq >= 10_000) score += 5;

  if (!input.verified) {
    flags.push("UNVERIFIED");
    score -= 8;
  }

  if (input.transferSample >= 50) score += 5;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    flags,
  };
}

export function tierFromNumericScore(score: number): string {
  if (score >= 80) return "HIGH_ELITE";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Replaces a data-starved oracle read with the indexer fallback score.
 * Returns null when the oracle read stands.
 */
export function recoverDataStarvedRead(
  score: number,
  flags: readonly string[],
  metrics: {
    holderCount: number;
    topHolderPct: number;
    transferSample: number;
    liquidityUsd: number | null;
    contractVerified: boolean;
  }
): { score: number; tier: string; flags: string[] } | null {
  if (!isDataStarvedOracleRead(score, flags, metrics.holderCount)) return null;
  // Holder counts are cheap to inflate with airdrops; only override when the
  // indexer confirms the liquidity the oracle failed to see
  const liq = metrics.liquidityUsd;
  if (liq == null || !Number.isFinite(liq) || liq <= 0) return null;
  const fallback = scoreFromIndexerSignals({
    holderCount: metrics.holderCount,
    topHolderPct: metrics.topHolderPct,
    transferSample: metrics.transferSample,
    liquidityUsd: metrics.liquidityUsd,
    verified: metrics.contractVerified,
  });
  // The oracle's liquidity flag came from the failed ingest
  const kept = flags.filter(
    (f) => String(f).toUpperCase() !== "LIQUIDITY_DATA_UNAVAILABLE"
  );
  return {
    score: fallback.score,
    tier: tierFromNumericScore(fallback.score),
    flags: [...new Set([...kept, ...fallback.flags])],
  };
}
