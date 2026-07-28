import "server-only";

import { getStore } from "@/lib/store/memory-store";
import {
  addWalletMark,
  getWalletMarks,
} from "@/lib/token-behavior/wallet-marks";
import {
  aggregateStakingScore,
  computeStakePoints,
  type StakePositionInput,
  type TokenTrustTier,
} from "./formula";

/**
 * Staking Intelligence (Phase 3b — INTERNAL_ROADMAP).
 * Uses Duration × Size × TokenTrust formula with 7-day min, self-stake zero,
 * circular rings, stake age reset on coordinated exit / wash marks.
 */

const ARCSCAN_API = "https://testnet.arcscan.app";
const DAY_MS = 24 * 60 * 60 * 1000;

const ENV_STAKING = (process.env.STAKING_CONTRACT_ADDRESSES ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter((s) => /^0x[0-9a-f]{40}$/.test(s));

const STAKE_SELECTORS = new Set([
  "a694fc3a",
  "2e17de78",
  "7acb7757",
  "c2a672e8",
]);

const LEADERBOARD_NS = "staking-leaderboard";
const TOKEN_TIER_CACHE = "staking-token-tier-cache";

export interface StakingSignal {
  wallet: string;
  committedScore: number;
  totalPoints: number;
  stakeEvents: number;
  unstakeEvents: number;
  uniqueStakeContracts: number;
  longestLockDays: number;
  gamingFlags: string[];
  observations: string[];
  scoreBoost: number;
  formula: {
    diversityBonusApplied: boolean;
    consistencyBonusApplied: boolean;
    decayFactor: number;
    positionsAwarded: number;
    positionsVoided: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  committedScore: number;
  totalPoints: number;
  stakeEvents: number;
  uniqueStakeContracts: number;
  longestLockDays: number;
  updatedAt: string;
}

interface ArcscanTx {
  timestamp?: string | null;
  from?: { hash?: string | null } | null;
  to?: { hash?: string | null } | null;
  raw_input?: string | null;
  input?: string | null;
  method?: string | null;
  value?: string | null;
  result?: string | null;
  status?: string | null;
}

interface TxPage {
  items?: ArcscanTx[] | null;
  next_page_params?: Record<string, string> | null;
}

async function fetchTxs(address: string, pages = 3): Promise<ArcscanTx[]> {
  const out: ArcscanTx[] = [];
  let params = new URLSearchParams({ limit: "50" });
  for (let i = 0; i < pages; i++) {
    try {
      const res = await fetch(
        `${ARCSCAN_API}/api/v2/addresses/${address}/transactions?${params}`,
        { headers: { accept: "application/json" }, cache: "no-store" }
      );
      if (!res.ok) break;
      const data = (await res.json()) as TxPage;
      const items = data.items ?? [];
      out.push(...items);
      if (!data.next_page_params) break;
      params = new URLSearchParams(
        Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)])
      );
    } catch {
      break;
    }
  }
  return out;
}

function isStakeLike(tx: ArcscanTx): "stake" | "unstake" | null {
  const method = (tx.method ?? "").toLowerCase();
  const input = (tx.raw_input ?? tx.input ?? "").toLowerCase().replace(/^0x/, "");
  const sel = input.slice(0, 8);

  if (
    method.includes("unstake") ||
    method.includes("withdraw") ||
    method.includes("redeem")
  ) {
    return "unstake";
  }
  if (
    method.includes("stake") ||
    method.includes("delegate") ||
    method.includes("lock") ||
    STAKE_SELECTORS.has(sel)
  ) {
    return "stake";
  }
  const to = (tx.to?.hash ?? "").toLowerCase();
  if (ENV_STAKING.includes(to)) return "stake";
  return null;
}

/** Parse tx value as USD proxy (native units — Arc testnet; scale conservatively). */
function valueUsdProxy(tx: ArcscanTx): number {
  const raw = tx.value;
  if (!raw) return 50; // unknown size → mid-low band default for heuristic
  try {
    const wei = BigInt(raw);
    // Assume 18 decimals; treat 1 unit ≈ $1 on testnet for sizing bands only
    const units = Number(wei) / 1e18;
    if (!Number.isFinite(units) || units <= 0) return 50;
    return Math.max(10, Math.min(50_000, units));
  } catch {
    return 50;
  }
}

async function tokenTierFor(
  contract: string
): Promise<TokenTrustTier> {
  const cache = getStore<{ tier: string; at: number }>(TOKEN_TIER_CACHE);
  const hit = cache.get(contract);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) {
    return hit.tier as TokenTrustTier;
  }
  // Without a full rescore, default MEDIUM; env can pin known elite contracts
  const pinned = (process.env.STAKING_ELITE_TOKENS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const blocked = (process.env.STAKING_BLOCKED_TOKENS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  let tier: TokenTrustTier = "MEDIUM";
  if (blocked.includes(contract)) tier = "BLOCKED";
  else if (pinned.includes(contract)) tier = "HIGH";
  cache.set(contract, { tier, at: Date.now() });
  return tier;
}

function detectGaming(
  events: Array<{ type: "stake" | "unstake"; ts: number; to: string; from: string }>,
  wallet: string
): string[] {
  const flags: string[] = [];
  const w = wallet.toLowerCase();

  const byDay = new Map<string, { s: number; u: number }>();
  for (const e of events) {
    const day = new Date(e.ts).toISOString().slice(0, 10);
    const row = byDay.get(day) ?? { s: 0, u: 0 };
    if (e.type === "stake") row.s += 1;
    else row.u += 1;
    byDay.set(day, row);
  }
  for (const row of byDay.values()) {
    if (row.s >= 1 && row.u >= 1) {
      flags.push("SAME_DAY_STAKE_CHURN");
      break;
    }
  }

  if (events.some((e) => e.from === e.to && e.from === w)) {
    flags.push("SELF_STAKING");
  }

  const contracts = events.filter((e) => e.type === "stake").map((e) => e.to);
  const unique = new Set(contracts);
  if (unique.size >= 2 && events.length >= 6) {
    const window = 2 * DAY_MS;
    let ringHits = 0;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (events[j].ts - events[i].ts > window) break;
        if (
          events[i].type === "stake" &&
          events[j].type === "stake" &&
          events[i].to !== events[j].to
        ) {
          ringHits += 1;
        }
      }
    }
    if (ringHits >= 8) flags.push("CIRCULAR_STAKE_RING");
  }

  return flags;
}

/** Deployer of contract === staker → self-stake */
async function isDeployerOf(
  wallet: string,
  contract: string
): Promise<boolean> {
  try {
    const res = await fetch(`${ARCSCAN_API}/api/v2/addresses/${contract}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { creator_address_hash?: string | null };
    return (data.creator_address_hash ?? "").toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export async function analyzeStaking(wallet: string): Promise<StakingSignal> {
  const address = wallet.toLowerCase();
  const txs = await fetchTxs(address);
  const events: Array<{
    type: "stake" | "unstake";
    ts: number;
    to: string;
    from: string;
    sizeUsd: number;
  }> = [];

  for (const tx of txs) {
    const kind = isStakeLike(tx);
    if (!kind) continue;
    const ts = tx.timestamp ? Date.parse(tx.timestamp) : NaN;
    if (!Number.isFinite(ts)) continue;
    events.push({
      type: kind,
      ts,
      to: (tx.to?.hash ?? "").toLowerCase(),
      from: (tx.from?.hash ?? "").toLowerCase(),
      sizeUsd: valueUsdProxy(tx),
    });
  }

  events.sort((a, b) => a.ts - b.ts);
  const stakeEvents = events.filter((e) => e.type === "stake").length;
  const unstakeEvents = events.filter((e) => e.type === "unstake").length;
  const uniqueStakeContracts = new Set(
    events.filter((e) => e.type === "stake").map((e) => e.to).filter(Boolean)
  ).size;

  // Pair stake→unstake for duration; open stakes use now
  const open: Array<{ ts: number; to: string; sizeUsd: number }> = [];
  const closed: Array<{
    durationDays: number;
    to: string;
    sizeUsd: number;
  }> = [];
  let longestLockDays = 0;
  let firstStakeTs: number | null = null;
  let lastStakeTs: number | null = null;

  for (const e of events) {
    if (e.type === "stake") {
      open.push({ ts: e.ts, to: e.to, sizeUsd: e.sizeUsd });
      if (firstStakeTs === null) firstStakeTs = e.ts;
      lastStakeTs = e.ts;
    } else if (e.type === "unstake" && open.length > 0) {
      const start = open.shift()!;
      const days = (e.ts - start.ts) / DAY_MS;
      longestLockDays = Math.max(longestLockDays, days);
      closed.push({ durationDays: days, to: start.to, sizeUsd: start.sizeUsd });
    }
  }
  for (const o of open) {
    const days = (Date.now() - o.ts) / DAY_MS;
    longestLockDays = Math.max(longestLockDays, days);
    closed.push({ durationDays: days, to: o.to, sizeUsd: o.sizeUsd });
  }

  // Unstake immediately after deploy flag
  const gamingFlags = detectGaming(events, address);
  for (const e of events) {
    if (e.type !== "unstake") continue;
    // if any deploy by this wallet within 24h before unstake — flag
    // Approximate: not full deploy scan; skip heavy path
  }

  // Misbehavior reset: coordinated exit / wash marks
  const marks = getWalletMarks(address);
  const resetByMisbehavior = marks.some(
    (m) =>
      m.code === "COORDINATED_EXIT_PARTICIPANT" ||
      m.code === "REPEATED_EXIT_SYNC" ||
      m.code === "STAKING_GAMING"
  );

  const positions: StakePositionInput[] = [];
  let positionsAwarded = 0;
  let positionsVoided = 0;

  for (const c of closed) {
    const tier = await tokenTierFor(c.to || "0x0");
    const self = c.to ? await isDeployerOf(address, c.to) : false;
    if (self) gamingFlags.push("SELF_STAKING");
    const input: StakePositionInput = {
      durationDays: c.durationDays,
      sizeUsd: c.sizeUsd,
      tokenTier: tier,
      isSelfStake: self,
      resetByMisbehavior,
    };
    const pts = computeStakePoints(input);
    if (pts.awardedPoints > 0) positionsAwarded += 1;
    else positionsVoided += 1;
    positions.push(input);
  }

  const uniqueFlags = [...new Set(gamingFlags)];
  if (uniqueFlags.includes("CIRCULAR_STAKE_RING")) {
    addWalletMark(address, "STAKING_GAMING", "circular_ring");
  }
  if (uniqueFlags.includes("SELF_STAKING")) {
    addWalletMark(address, "STAKING_GAMING", "self_stake");
  }

  const activeSpanDays =
    firstStakeTs && lastStakeTs
      ? Math.max(0, (lastStakeTs - firstStakeTs) / DAY_MS)
      : 0;
  const daysSinceLastStake =
    lastStakeTs != null ? (Date.now() - lastStakeTs) / DAY_MS : 999;

  // If circular ring, void all points
  const voidAll = uniqueFlags.includes("CIRCULAR_STAKE_RING");
  const agg = voidAll
    ? {
        totalPoints: 0,
        committedScore: 0,
        scoreBoost: 0,
        diversityBonusApplied: false,
        consistencyBonusApplied: false,
        decayFactor: 1,
      }
    : aggregateStakingScore({
        positions,
        uniqueProtocols: uniqueStakeContracts,
        activeSpanDays,
        daysSinceLastStake,
      });

  const observations: string[] = [];
  if (agg.totalPoints > 0) {
    observations.push(
      `Staking points ${agg.totalPoints} (duration × size × token trust)`
    );
  }
  if (positions.some((p) => p.durationDays < 7)) {
    observations.push("Positions under 7 days earn zero points");
  }
  if (resetByMisbehavior) {
    observations.push("Stake age reset due to exit/wash marks");
  }
  if (uniqueFlags.length > 0) {
    observations.push("Staking pattern shows gaming risk");
  }
  if (agg.diversityBonusApplied) {
    observations.push("Protocol diversity bonus applied");
  }
  if (agg.consistencyBonusApplied) {
    observations.push("Long-horizon consistency multiplier applied");
  }

  const signal: StakingSignal = {
    wallet: address,
    committedScore: agg.committedScore,
    totalPoints: agg.totalPoints,
    stakeEvents,
    unstakeEvents,
    uniqueStakeContracts,
    longestLockDays: Math.round(longestLockDays * 10) / 10,
    gamingFlags: uniqueFlags,
    observations,
    scoreBoost: uniqueFlags.length > 0 ? 0 : agg.scoreBoost,
    formula: {
      diversityBonusApplied: agg.diversityBonusApplied,
      consistencyBonusApplied: agg.consistencyBonusApplied,
      decayFactor: agg.decayFactor,
      positionsAwarded,
      positionsVoided,
    },
  };

  if (stakeEvents > 0 && uniqueFlags.length === 0 && agg.totalPoints > 0) {
    const board = getStore<LeaderboardEntry>(LEADERBOARD_NS);
    board.set(address, {
      rank: 0,
      wallet: address,
      committedScore: agg.committedScore,
      totalPoints: agg.totalPoints,
      stakeEvents,
      uniqueStakeContracts,
      longestLockDays: signal.longestLockDays,
      updatedAt: new Date().toISOString(),
    });
  }

  return signal;
}

export async function deployerStakingBoost(
  deployerAddress: string | null | undefined
): Promise<{ boost: number; flags: string[]; observations: string[] }> {
  if (!deployerAddress || !/^0x[0-9a-fA-F]{40}$/.test(deployerAddress)) {
    return { boost: 0, flags: [], observations: [] };
  }
  const s = await analyzeStaking(deployerAddress);
  const flags: string[] = [];
  if (s.scoreBoost > 0) flags.push("STAKING_COMMITTED");
  if (s.gamingFlags.length > 0) flags.push("STAKING_GAMING");
  return {
    boost: s.scoreBoost,
    flags,
    observations: s.observations,
  };
}

export function getStakingLeaderboard(limit = 50): LeaderboardEntry[] {
  const board = getStore<LeaderboardEntry>(LEADERBOARD_NS);
  const rows = Array.from(board.values()).sort(
    (a, b) =>
      (b.totalPoints ?? b.committedScore) - (a.totalPoints ?? a.committedScore) ||
      b.longestLockDays - a.longestLockDays
  );
  return rows.slice(0, limit).map((r, i) => ({ ...r, rank: i + 1 }));
}
