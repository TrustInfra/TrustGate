/**
 * Mainnet staker quality. Every dimension must clear — a swarm of new
 * wallets funded today cannot move conviction. Fail closed on missing data.
 */

export const MIN_BALANCE_USD = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface StakerQualityInput {
  /** eth_getTransactionCount. null = lookup failed → 0. */
  txCount: number | null;
  isContract: boolean;
  isSelf: boolean;
  /** Days since first proven activity. null = unproven → 0. */
  walletAgeDays: number | null;
  /** Current native USDC in dollars. null = unproven → 0. */
  balanceUsd: number | null;
  /** Proven consecutive days the wallet has held >= $50. Unproven → 0. */
  daysHeldOver50: number | null;
}

export interface BalanceTransfer {
  /** Unix ms. Newest first when reconstructing. */
  ts: number;
  usd: number;
  inbound: boolean;
}

function txWeight(txCount: number): number {
  if (txCount <= 0) return 0;
  if (txCount <= 10) return 0.05;
  if (txCount <= 30) return 0.15;
  if (txCount <= 100) return 0.4;
  if (txCount <= 300) return 0.7;
  return 1;
}

function ageWeight(days: number): number {
  if (days < 7) return 0;
  if (days < 30) return 0.1;
  if (days < 90) return 0.35;
  if (days < 180) return 0.7;
  return 1;
}

function balanceWeight(usd: number): number {
  if (usd < MIN_BALANCE_USD) return 0;
  if (usd < 100) return 0.3;
  if (usd < 500) return 0.6;
  return 1;
}

function holdWeight(days: number): number {
  if (days < 7) return 0;
  if (days < 30) return 0.2;
  if (days < 90) return 0.5;
  return 1;
}

/**
 * Walk newest→oldest from current balance. Returns 0 unless we can prove
 * the wallet stayed at or above $50 back to some timestamp.
 */
export function daysHeldOver50(opts: {
  currentBalanceUsd: number;
  nowMs: number;
  transfers: BalanceTransfer[];
}): number {
  if (opts.currentBalanceUsd < MIN_BALANCE_USD) return 0;
  if (opts.transfers.length === 0) return 0;

  const ordered = [...opts.transfers].sort((a, b) => b.ts - a.ts);
  let balance = opts.currentBalanceUsd;
  let crossedAt: number | null = null;

  for (const t of ordered) {
    if (t.usd <= 0 || !Number.isFinite(t.ts)) continue;
    const prev = t.inbound ? balance - t.usd : balance + t.usd;
    if (balance >= MIN_BALANCE_USD && prev < MIN_BALANCE_USD) {
      crossedAt = t.ts;
      break;
    }
    balance = prev;
  }

  const start = crossedAt ?? ordered[ordered.length - 1]?.ts;
  if (start == null || start > opts.nowMs) return 0;
  return Math.max(0, (opts.nowMs - start) / DAY_MS);
}

export function stakerQualityWeight(input: StakerQualityInput): number {
  if (input.isSelf) return 0;
  if (input.isContract) return 0;
  if (input.txCount == null || input.walletAgeDays == null) return 0;
  if (input.balanceUsd == null || input.daysHeldOver50 == null) return 0;

  const parts = [
    txWeight(input.txCount),
    ageWeight(input.walletAgeDays),
    balanceWeight(input.balanceUsd),
    holdWeight(input.daysHeldOver50),
  ];
  return Math.min(...parts);
}

export function isSybilStakeCrowd(
  rawStakers: number,
  qualityMass: number
): boolean {
  if (rawStakers < 5) return false;
  return qualityMass / rawStakers < 0.25;
}
