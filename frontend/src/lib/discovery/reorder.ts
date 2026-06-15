import type { BatchScore, Tier } from "./types";

// ============================================================================
// reorderByTrust: the optional, opt-in reorder helper (Layer 3).
//
// A partner calls this on THEIR OWN list IF they choose to order by trust. It
// is pure: it never mutates the input and returns a new array. It is never
// auto-applied anywhere. The trust-ordered discovery outcome happens only
// because the partner decided to call this, not because we imposed it.
//
// Ranking:
//   - Higher tier first. VERIFIED and ELITE rise; LOW and BLOCKED sink to the
//     bottom, marked not hidden. Nothing is removed.
//   - Same tier: a graduated (fully scored) token outranks a mining
//     (deployer-only) token, since there is more signal behind it.
//   - Then higher raw score first.
//   - Tokens with no score (or an error marker) sink below all scored tokens.
//     No signal is the weakest position in a trust ranking.
// ============================================================================

const TIER_RANK: Record<Tier, number> = {
  VERIFIED: 6,
  ELITE: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  BLOCKED: 1,
};

// Scores can be handed in however the partner already holds them.
export type ScoreLookup =
  | Map<string, BatchScore>
  | Record<string, BatchScore>
  | BatchScore[];

function toGetter(
  scores: ScoreLookup
): (address: string) => BatchScore | undefined {
  const m = new Map<string, BatchScore>();
  if (Array.isArray(scores)) {
    for (const s of scores) m.set(s.address.toLowerCase(), s);
  } else if (scores instanceof Map) {
    scores.forEach((v, k) => m.set(k.toLowerCase(), v));
  } else {
    for (const [k, v] of Object.entries(scores)) m.set(k.toLowerCase(), v);
  }
  return (a) => m.get(a.toLowerCase());
}

export interface ReorderOptions {
  // Treat an entry whose score carries an error marker (for example a wallet
  // that is not a token) as unscored, sinking it to the bottom. Default true.
  treatErroredAsUnscored?: boolean;
}

export function reorderByTrust<T>(
  items: T[],
  getAddress: (item: T) => string,
  scores: ScoreLookup,
  options: ReorderOptions = {}
): T[] {
  const { treatErroredAsUnscored = true } = options;
  const lookup = toGetter(scores);

  // Decorate a copy with original index for a stable final tiebreak. The input
  // array is never touched.
  const decorated = items.map((item, index) => {
    const found = lookup(getAddress(item));
    const usable = found && !(treatErroredAsUnscored && found.error);
    return { item, index, score: usable ? found : undefined };
  });

  decorated.sort((a, b) => {
    const sa = a.score;
    const sb = b.score;

    // Unscored sink to the bottom, keeping their order among themselves.
    if (!sa && !sb) return a.index - b.index;
    if (!sa) return 1;
    if (!sb) return -1;

    // Higher tier first.
    const byTier = TIER_RANK[sb.tier] - TIER_RANK[sa.tier];
    if (byTier !== 0) return byTier;

    // Same tier: graduated outranks mining.
    if (sa.state !== sb.state) {
      return sa.state === "graduated" ? -1 : 1;
    }

    // Then higher raw score first.
    if (sb.score !== sa.score) return sb.score - sa.score;

    // Stable tiebreak.
    return a.index - b.index;
  });

  return decorated.map((d) => d.item);
}
