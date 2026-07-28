import type { BatchScore } from "./types";
import { reorderByTrust, type ScoreLookup } from "./reorder";

/**
 * When multiple tokens share a name/ticker, rank each group by trust.
 * Rugs sink to the bottom of their group; groups keep input order of first appearance.
 */
export function rankGroupsByTrust<T>(
  items: T[],
  getAddress: (item: T) => string,
  getGroupKey: (item: T) => string,
  scores: ScoreLookup
): T[] {
  const groups = new Map<string, T[]>();
  const order: string[] = [];

  for (const item of items) {
    const key = getGroupKey(item).toUpperCase();
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  const out: T[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    out.push(...reorderByTrust(group, getAddress, scores));
  }
  return out;
}

/** Convenience: rank a flat list where each item has symbol + address. */
export function rankSameTickerTokens(
  tokens: Array<{ symbol: string; address: string; [k: string]: unknown }>,
  scores: BatchScore[] | Record<string, BatchScore>
): typeof tokens {
  return rankGroupsByTrust(
    tokens,
    (t) => t.address,
    (t) => t.symbol,
    scores
  );
}
