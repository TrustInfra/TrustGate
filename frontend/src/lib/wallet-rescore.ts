// Post-processing layer for the wallet oracle proxy. Mirrors the caps,
// bot detectors, and tier bands defined in oracle/token-scoring.ts so the
// public proxy is the final authority on wallet scores regardless of what
// the upstream oracle returns.

const ARCSCAN_API_URL = "https://testnet.arcscan.app";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";

const BOT_FLAG_PENALTY = 12;
const VELOCITY_TXS_PER_HOUR = 50;
const INTERVAL_PATTERN_MIN_SAMPLE = 8;
const INTERVAL_PATTERN_TOLERANCE = 0.1;
const INTERVAL_PATTERN_DOMINANCE = 0.5;
const SELF_INTERACTION_THRESHOLD = 5;
// Clean-history is a youth-of-wallet signal: a brand-new wallet with hundreds
// of perfect txs is suspicious; a mature wallet with a clean record is just
// careful. Only flag when all three hold — high volume, zero failures, fresh.
const CLEAN_HISTORY_MIN_TXS = 200;
const CLEAN_HISTORY_MAX_AGE_DAYS = 30;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SIGNALS_TTL_MS = 5 * 60 * 1000;
const TX_PAGES = 5;

export type WalletTier = "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
export type WalletRecommendation =
  | "BLOCKED"
  | "TIME_LOCKED"
  | "INSTANT"
  | "INSTANT_PRIORITY";

type BotFlag =
  | "velocity"
  | "interval-pattern"
  | "self-interaction"
  | "clean-history";

interface Signals {
  deployments: number;
  walletAgeDays: number;
  txCount: number;
  botFlags: BotFlag[];
}

interface SignalsCacheEntry {
  expiresAt: number;
  signals: Signals;
}

const signalsCache: Map<string, SignalsCacheEntry> = new Map();

interface ArcscanTx {
  result?: string;
  status?: string;
  timestamp?: string;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  created_contract?: { hash?: string } | null;
}

interface ArcscanTxPage {
  items?: ArcscanTx[];
  next_page_params?: Record<string, unknown>;
}

async function arcscanGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARCSCAN_API_URL}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function rpcCall(
  method: string,
  params: unknown[]
): Promise<string | null> {
  try {
    const res = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (data.error) return null;
    return data.result ?? null;
  } catch {
    return null;
  }
}

async function fetchTxCount(address: string): Promise<number> {
  // Prefer the Arcscan counters endpoint (consistent with the rest of the
  // pipeline). Fall back to RPC nonce if Arcscan is unavailable.
  const counters = await arcscanGet<{ transactions_count?: string | number }>(
    `/api/v2/addresses/${address}/counters`
  );
  if (counters && counters.transactions_count !== undefined) {
    const n = Number(counters.transactions_count);
    if (Number.isFinite(n)) return n;
  }
  const hex = await rpcCall("eth_getTransactionCount", [address, "latest"]);
  if (!hex) return 0;
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

async function fetchWalletTxs(address: string): Promise<ArcscanTx[]> {
  // Outgoing-only txs — these are what the wallet itself initiated, which is
  // the relevant signal for velocity / pattern / self-interaction / clean
  // history (we want to evaluate the wallet's own behavior, not noise from
  // unsolicited inbound transfers).
  const out: ArcscanTx[] = [];
  let nextParams = "filter=from";
  for (let page = 0; page < TX_PAGES; page++) {
    const path = `/api/v2/addresses/${address}/transactions?${nextParams}`;
    const data = await arcscanGet<ArcscanTxPage>(path);
    if (!data) break;
    const items = data.items ?? [];
    out.push(...items);
    if (!data.next_page_params || items.length === 0) break;
    const tuples: [string, string][] = Object.entries(data.next_page_params).map(
      ([k, v]) => [k, String(v)]
    );
    tuples.push(["filter", "from"]);
    nextParams = new URLSearchParams(tuples).toString();
  }
  return out;
}

function countDeployments(txs: ArcscanTx[]): number {
  let n = 0;
  for (const tx of txs) {
    if (tx.created_contract?.hash) n++;
  }
  return n;
}

function walletAgeDaysFrom(txs: ArcscanTx[]): number {
  // Use the oldest outgoing tx in our sample as the wallet age proxy.
  // If we couldn't fetch any txs, age is 0 and the wallet is treated as fresh.
  let oldest = Number.POSITIVE_INFINITY;
  for (const tx of txs) {
    if (!tx.timestamp) continue;
    const t = Date.parse(tx.timestamp);
    if (Number.isNaN(t)) continue;
    if (t < oldest) oldest = t;
  }
  if (!Number.isFinite(oldest)) return 0;
  return Math.max(0, (Date.now() - oldest) / DAY_MS);
}

// --- bot detectors (apply the same logic as token-scoring.ts) ---

function detectVelocity(txs: ArcscanTx[]): boolean {
  if (txs.length < VELOCITY_TXS_PER_HOUR) return false;
  const ms = txs
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  let left = 0;
  let max = 0;
  for (let right = 0; right < ms.length; right++) {
    while (ms[right] - ms[left] > HOUR_MS) left++;
    const count = right - left + 1;
    if (count > max) max = count;
  }
  return max > VELOCITY_TXS_PER_HOUR;
}

function detectIntervalPattern(txs: ArcscanTx[]): boolean {
  if (txs.length < INTERVAL_PATTERN_MIN_SAMPLE + 1) return false;
  const sorted = txs
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  const intervals: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 0) intervals.push(d);
  }
  if (intervals.length < INTERVAL_PATTERN_MIN_SAMPLE) return false;
  let bestCluster = 0;
  for (const ref of intervals) {
    let count = 0;
    for (const v of intervals) {
      if (Math.abs(v - ref) / ref <= INTERVAL_PATTERN_TOLERANCE) count++;
    }
    if (count > bestCluster) bestCluster = count;
  }
  return bestCluster / intervals.length >= INTERVAL_PATTERN_DOMINANCE;
}

function detectSelfInteraction(
  txs: ArcscanTx[],
  walletLower: string
): boolean {
  let n = 0;
  for (const tx of txs) {
    const from = tx.from?.hash?.toLowerCase();
    const to = tx.to?.hash?.toLowerCase();
    if (from === walletLower && to === walletLower) n++;
  }
  return n >= SELF_INTERACTION_THRESHOLD;
}

function detectCleanHistoryManipulation(
  txs: ArcscanTx[],
  walletAgeDays: number
): boolean {
  if (txs.length <= CLEAN_HISTORY_MIN_TXS) return false;
  if (walletAgeDays >= CLEAN_HISTORY_MAX_AGE_DAYS) return false;
  for (const tx of txs) {
    const result = (tx.result ?? "").toLowerCase();
    const status = (tx.status ?? "").toLowerCase();
    const failed =
      result === "error" ||
      result === "failed" ||
      result === "reverted" ||
      status === "error" ||
      status === "failed" ||
      status === "0";
    if (failed) return false;
  }
  return true;
}

// --- formula ---

export function tierFor(score: number): WalletTier {
  if (score < 40) return "LOW";
  if (score < 60) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "HIGH_ELITE";
}

export function recommendationFor(score: number): WalletRecommendation {
  if (score === 0) return "BLOCKED";
  if (score < 60) return "TIME_LOCKED";
  if (score < 80) return "INSTANT";
  return "INSTANT_PRIORITY";
}

interface FormulaResult {
  score: number;
  tier: WalletTier;
  recommendation: WalletRecommendation;
}

function applyFormula(rawScore: number, signals: Signals): FormulaResult {
  const { deployments, walletAgeDays, txCount, botFlags } = signals;

  let raw = rawScore - botFlags.length * BOT_FLAG_PENALTY;
  if (raw < 0) raw = 0;

  let cap = 100;
  if (botFlags.length > 0) cap = Math.min(cap, 59);

  const isFresh = walletAgeDays < 7 || txCount < 10;
  if (isFresh) cap = Math.min(cap, 59);

  if (deployments === 0) cap = Math.min(cap, 79);

  const eliteOk =
    deployments >= 10 &&
    walletAgeDays > 180 &&
    txCount > 500 &&
    botFlags.length === 0;
  if (!eliteOk) cap = Math.min(cap, 79);

  const perfectOk =
    eliteOk &&
    deployments >= 25 &&
    walletAgeDays > 365 &&
    txCount > 5000;
  if (!perfectOk) cap = Math.min(cap, 99);

  let score = Math.round(raw);
  if (score > cap) score = cap;
  if (score < 0) score = 0;

  return {
    score,
    tier: tierFor(score),
    recommendation: recommendationFor(score),
  };
}

async function gatherSignals(address: string): Promise<Signals> {
  const lower = address.toLowerCase();
  const cached = signalsCache.get(lower);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signals;
  }

  const [txCount, walletTxs] = await Promise.all([
    fetchTxCount(address),
    fetchWalletTxs(address),
  ]);

  const deployments = countDeployments(walletTxs);
  const walletAgeDays = walletAgeDaysFrom(walletTxs);

  const botFlags: BotFlag[] = [];
  if (detectVelocity(walletTxs)) botFlags.push("velocity");
  if (detectIntervalPattern(walletTxs)) botFlags.push("interval-pattern");
  if (detectSelfInteraction(walletTxs, lower)) botFlags.push("self-interaction");
  if (detectCleanHistoryManipulation(walletTxs, walletAgeDays))
    botFlags.push("clean-history");

  const signals: Signals = {
    deployments,
    walletAgeDays,
    txCount,
    botFlags,
  };

  signalsCache.set(lower, {
    expiresAt: Date.now() + SIGNALS_TTL_MS,
    signals,
  });

  console.log(
    `[wallet-rescore] ${address} deployments=${signals.deployments} ` +
      `ageDays=${signals.walletAgeDays.toFixed(1)} txs=${signals.txCount} ` +
      `flags=[${signals.botFlags.join(",")}]`
  );

  return signals;
}

export async function rescoreWallet(
  rawScore: number,
  address: string
): Promise<FormulaResult> {
  const signals = await gatherSignals(address);
  return applyFormula(rawScore, signals);
}
