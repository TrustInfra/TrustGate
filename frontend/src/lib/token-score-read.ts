/**
 * Decide what a paid token-oracle body means.
 * A positive score is ready even if a pending flag is still set.
 * A pending flag with no positive score means the worker has not finished.
 * Score 0 next to that flag is not a result. Score 0 without the flag is.
 */

function unwrap(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.data && typeof record.data === "object" && record.data !== null) {
    return record.data as Record<string, unknown>;
  }
  return record;
}

function flaggedPending(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.kind === "pending" || record.status === "pending") return true;
  const inner = record.data;
  if (inner && typeof inner === "object") {
    const nested = inner as Record<string, unknown>;
    if (nested.kind === "pending" || nested.status === "pending") return true;
  }
  return false;
}

function finiteScore(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export type PaidBodyState = "score" | "pending" | "unusable";

export function paidBodyState(value: unknown): PaidBodyState {
  const inner = unwrap(value);
  if (!inner) return flaggedPending(value) ? "pending" : "unusable";

  const tier =
    typeof inner.tier === "string" ? inner.tier.trim().toUpperCase() : "";
  if (tier === "VERIFIED" || tier === "TRUSTED") return "score";

  const score = finiteScore(
    inner.score ?? inner.trustScore ?? inner.trust_score
  );
  if (score !== null && score > 0) return "score";
  if (flaggedPending(value)) return "pending";
  if (score !== null) return "score";
  return "unusable";
}

/** Pending with no positive score. A real score beside that flag is ready. */
export function pendingBlocksScore(value: unknown): boolean {
  return flaggedPending(value) && paidBodyState(value) !== "score";
}

/**
 * HTTP 202 is pending only when the body has no finished score.
 * The paid handler can mark the body pending after the number is already in it.
 */
export function classifyPaidRead(status: number, body: unknown): PaidBodyState {
  const state = paidBodyState(body);
  if (status === 202 && state !== "score") return "pending";
  return state;
}
