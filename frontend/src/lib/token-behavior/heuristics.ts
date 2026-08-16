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
