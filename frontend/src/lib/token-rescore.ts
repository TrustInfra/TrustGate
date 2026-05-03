// Post-processing layer that re-applies our token formula on top of whatever
// raw score the upstream oracle returns. Mirrors the caps and bot-signal
// thresholds defined in oracle/token-scoring.ts so the public proxy is the
// final authority regardless of upstream behavior.

const ARCSCAN_API_URL = "https://testnet.arcscan.app";

const BOT_FLAG_PENALTY = 0;
const VELOCITY_TXS_PER_HOUR = 0;
const INTERVAL_PATTERN_MIN_SAMPLE = 0;
const INTERVAL_PATTERN_TOLERANCE = 0;
const INTERVAL_PATTERN_DOMINANCE = 0;
const SELF_INTERACTION_THRESHOLD = 0;
const CLEAN_HISTORY_MIN_TXS = 50;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const SIGNALS_TTL_MS = 5 * 60 * 1000;
const TRANSFERS_MAX_PAGES = 5;
const CONTRACT_TXS_MAX_PAGES = 3;
const DEPLOYER_DEPLOYMENTS_MAX_PAGES = 5;

export type TokenTier = "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";

type BotFlag =
  | "velocity"
  | "interval-pattern"
  | "self-interaction"
  | "clean-history";

interface Signals {
  deployerDeployments: number;
  tokenAgeDays: number;
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
  created_contract?: { hash?: string } | null;
}

interface ArcscanTransfer {
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  timestamp?: string;
}

interface ArcscanAddrMeta {
  creator_address_hash?: string;
  creation_tx_hash?: string;
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

async function fetchAddrMeta(address: string): Promise<ArcscanAddrMeta | null> {
  return arcscanGet<ArcscanAddrMeta>(`/api/v2/addresses/${address}`);
}

async function fetchTxAgeMs(creationTxHash: string): Promise<number> {
  const tx = await arcscanGet<{ timestamp?: string }>(
    `/api/v2/transactions/${creationTxHash}`
  );
  if (!tx?.timestamp) return 0;
  const ms = Date.parse(tx.timestamp);
  if (Number.isNaN(ms)) return 0;
  return Date.now() - ms;
}

async function fetchAddressTxCount(address: string): Promise<number> {
  const data = await arcscanGet<{ transactions_count?: string | number }>(
    `/api/v2/addresses/${address}/counters`
  );
  return Number(data?.transactions_count || 0);
}

async function fetchTransfers(address: string): Promise<ArcscanTransfer[]> {
  const out: ArcscanTransfer[] = [];
  let nextParams = "";
  for (let page = 0; page < TRANSFERS_MAX_PAGES; page++) {
    const path = `/api/v2/tokens/${address}/transfers${
      nextParams ? `?${nextParams}` : ""
    }`;
    const data = await arcscanGet<{
      items?: ArcscanTransfer[];
      next_page_params?: Record<string, unknown>;
    }>(path);
    if (!data) break;
    const items = data.items ?? [];
    out.push(...items);
    if (!data.next_page_params || items.length === 0) break;
    const tuples: [string, string][] = Object.entries(data.next_page_params).map(
      ([k, v]) => [k, String(v)]
    );
    nextParams = new URLSearchParams(tuples).toString();
  }
  return out;
}

async function fetchContractTxs(address: string): Promise<ArcscanTx[]> {
  const out: ArcscanTx[] = [];
  let nextParams = "";
  for (let page = 0; page < CONTRACT_TXS_MAX_PAGES; page++) {
    const path = `/api/v2/addresses/${address}/transactions${
      nextParams ? `?${nextParams}` : ""
    }`;
    const data = await arcscanGet<{
      items?: ArcscanTx[];
      next_page_params?: Record<string, unknown>;
    }>(path);
    if (!data) break;
    const items = data.items ?? [];
    out.push(...items);
    if (!data.next_page_params || items.length === 0) break;
    const tuples: [string, string][] = Object.entries(data.next_page_params).map(
      ([k, v]) => [k, String(v)]
    );
    nextParams = new URLSearchParams(tuples).toString();
  }
  return out;
}

async function fetchDeployerDeployments(deployer: string): Promise<number> {
  let count = 0;
  let nextParams = "filter=from";
  for (let page = 0; page < DEPLOYER_DEPLOYMENTS_MAX_PAGES; page++) {
    const path = `/api/v2/addresses/${deployer}/transactions?${nextParams}`;
    const data = await arcscanGet<{
      items?: ArcscanTx[];
      next_page_params?: Record<string, unknown>;
    }>(path);
    if (!data) break;
    const items = data.items ?? [];
    for (const tx of items) {
      if (tx.created_contract?.hash) count++;
    }
    if (!data.next_page_params || items.length === 0) break;
    const tuples: [string, string][] = Object.entries(data.next_page_params).map(
      ([k, v]) => [k, String(v)]
    );
    tuples.push(["filter", "from"]);
    nextParams = new URLSearchParams(tuples).toString();
  }
  return count;
}

// --- bot detectors (mirror oracle/token-scoring.ts) ---

function detectVelocity(transfers: ArcscanTransfer[]): boolean {
  if (transfers.length < VELOCITY_TXS_PER_HOUR) return false;
  const ms = transfers
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

function detectIntervalPattern(transfers: ArcscanTransfer[]): boolean {
  if (transfers.length < INTERVAL_PATTERN_MIN_SAMPLE + 1) return false;
  const sorted = transfers
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

function detectSelfInteraction(transfers: ArcscanTransfer[]): boolean {
  let selfCount = 0;
  for (const t of transfers) {
    const from = t.from?.hash?.toLowerCase();
    const to = t.to?.hash?.toLowerCase();
    if (from && to && from === to) selfCount++;
  }
  return selfCount >= SELF_INTERACTION_THRESHOLD;
}

function detectCleanHistoryManipulation(txs: ArcscanTx[]): boolean {
  if (txs.length < CLEAN_HISTORY_MIN_TXS) return false;
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

export function tierFor(score: number): TokenTier {
  if (score < 40) return "LOW";
  if (score < 60) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "HIGH_ELITE";
}

function applyFormula(
  rawScore: number,
  signals: Signals
): { score: number; tier: TokenTier } {
  const { deployerDeployments, tokenAgeDays, txCount, botFlags } = signals;

  let raw = rawScore - botFlags.length * BOT_FLAG_PENALTY;
  if (raw < 0) raw = 0;

  let cap = 100;
  if (botFlags.length > 0) cap = Math.min(cap, 59);
  const isFresh = tokenAgeDays < 7 || txCount < 10;
  if (isFresh) cap = Math.min(cap, 59);
  if (deployerDeployments === 0) cap = Math.min(cap, 79);

  const eliteOk =
    deployerDeployments >= 10 &&
    tokenAgeDays > 180 &&
    txCount > 500 &&
    botFlags.length === 0;
  if (!eliteOk) cap = Math.min(cap, 79);

  const perfectOk =
    eliteOk &&
    deployerDeployments >= 25 &&
    tokenAgeDays > 365 &&
    txCount > 5000;
  if (!perfectOk) cap = Math.min(cap, 99);

  let score = Math.round(raw);
  if (score > cap) score = cap;
  if (score < 0) score = 0;
  return { score, tier: tierFor(score) };
}

async function gatherSignals(address: string): Promise<Signals> {
  const lower = address.toLowerCase();
  const cached = signalsCache.get(lower);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.signals;
  }

  const [meta, txCount, transfers, contractTxs] = await Promise.all([
    fetchAddrMeta(address),
    fetchAddressTxCount(address),
    fetchTransfers(address),
    fetchContractTxs(address),
  ]);

  const [ageMs, deployerDeployments] = await Promise.all([
    meta?.creation_tx_hash ? fetchTxAgeMs(meta.creation_tx_hash) : Promise.resolve(0),
    meta?.creator_address_hash
      ? fetchDeployerDeployments(meta.creator_address_hash)
      : Promise.resolve(0),
  ]);

  const botFlags: BotFlag[] = [];
  if (detectVelocity(transfers)) botFlags.push("velocity");
  if (detectIntervalPattern(transfers)) botFlags.push("interval-pattern");
  if (detectSelfInteraction(transfers)) botFlags.push("self-interaction");
  if (detectCleanHistoryManipulation(contractTxs)) botFlags.push("clean-history");

  const signals: Signals = {
    deployerDeployments,
    tokenAgeDays: ageMs > 0 ? ageMs / DAY_MS : 0,
    txCount,
    botFlags,
  };

  signalsCache.set(lower, {
    expiresAt: Date.now() + SIGNALS_TTL_MS,
    signals,
  });

  console.log(
    `[token-rescore] ${address} deployments=${signals.deployerDeployments} ` +
      `ageDays=${signals.tokenAgeDays.toFixed(1)} txs=${signals.txCount} ` +
      `flags=[${signals.botFlags.join(",")}]`
  );

  return signals;
}

export async function rescoreToken(
  rawScore: number,
  address: string
): Promise<{ score: number; tier: TokenTier }> {
  const signals = await gatherSignals(address);
  return applyFormula(rawScore, signals);
}
