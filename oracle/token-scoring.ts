import axios from 'axios';
import { getAddress } from 'viem';
import { publicClient, scoreAddress, ScoreResult, Tier } from './scoring';

const ARCSCAN_API_URL = process.env.ARCSCAN_API_URL || 'https://testnet.arcscan.app';

const HOLDER_ANALYSIS_CAP = 100;

// Coordinated buyer detection (kept from prior version, treated as one bot flag)
const COORDINATED_WINDOW_MS = 3 * 60 * 60 * 1000;
const COORDINATED_THRESHOLD = 0.8;
const COORDINATED_BUYER_WEIGHT_PENALTY = 0.1;

// Per-flag score deduction (user spec: 10–15 minimum). Settled at 12.
const BOT_FLAG_PENALTY = 12;

// Bot-signal thresholds
const VELOCITY_TXS_PER_HOUR = 50;
const INTERVAL_PATTERN_MIN_SAMPLE = 8;
const INTERVAL_PATTERN_TOLERANCE = 0.1; // ±10% groups as "identical"
const INTERVAL_PATTERN_DOMINANCE = 0.5; // 50%+ of intervals
const SELF_INTERACTION_THRESHOLD = 5;
const CLEAN_HISTORY_MIN_TXS = 50;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Per-tier weight for purchased holders (BLOCKED ignored)
const BUYER_WEIGHTS: Record<Tier, number> = {
  BLOCKED: 0,
  LOW: 1,
  MEDIUM: 4,
  HIGH: 7,
  HIGH_ELITE: 10,
};

const DEX_WHITELIST: Set<string> = new Set(
  (process.env.KNOWN_DEX_ADDRESSES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
);

interface ArcscanHolder {
  address: { hash: string };
  value: string;
}

interface ArcscanTransfer {
  from: { hash: string };
  to: { hash: string };
  total: { value: string; decimals?: string };
  timestamp: string;
  block_number: number;
  transaction_hash: string;
}

interface ArcscanTokenInfo {
  address: string;
  total_supply: string;
  decimals: string;
  type: string;
  holders?: string;
  symbol?: string;
}

interface ArcscanContractTx {
  result?: string;
  status?: string;
  timestamp?: string;
  created_contract?: { hash?: string } | null;
}

export type TokenTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'HIGH_ELITE';
export type Trend = 'rising' | 'stable' | 'falling';
export type BotFlag =
  | 'velocity'
  | 'interval-pattern'
  | 'self-interaction'
  | 'clean-history'
  | 'coordinated-buying';

export interface TokenScoreResult {
  address: string;
  score: number;
  tier: TokenTier;
  trend: Trend;
  last_updated: string;
  next_refresh: string;
}

// ----- helpers -----

async function fetchTokenInfo(address: string): Promise<ArcscanTokenInfo | null> {
  try {
    const url = `${ARCSCAN_API_URL}/api/v2/tokens/${address}`;
    const res = await axios.get<ArcscanTokenInfo>(url, { timeout: 8000 });
    return res.data;
  } catch (err) {
    console.error(`[token-scoring] token info failed: ${(err as Error).message}`);
    return null;
  }
}

async function fetchHolders(address: string): Promise<ArcscanHolder[]> {
  try {
    const url = `${ARCSCAN_API_URL}/api/v2/tokens/${address}/holders`;
    const res = await axios.get<{ items?: ArcscanHolder[] }>(url, { timeout: 10_000 });
    return res.data.items || [];
  } catch (err) {
    console.error(`[token-scoring] holders fetch failed: ${(err as Error).message}`);
    return [];
  }
}

async function fetchAllTransfers(address: string, maxPages = 5): Promise<ArcscanTransfer[]> {
  const out: ArcscanTransfer[] = [];
  let nextParams = '';
  for (let page = 0; page < maxPages; page++) {
    try {
      const url: string = `${ARCSCAN_API_URL}/api/v2/tokens/${address}/transfers${nextParams ? `?${nextParams}` : ''}`;
      const res = await axios.get<{ items?: ArcscanTransfer[]; next_page_params?: Record<string, unknown> }>(
        url,
        { timeout: 10_000 }
      );
      const items = res.data.items || [];
      out.push(...items);
      const np = res.data.next_page_params;
      if (!np || items.length === 0) break;
      const tuples: [string, string][] = Object.entries(np).map(([k, v]) => [k, String(v)]);
      nextParams = new URLSearchParams(tuples).toString();
    } catch (err) {
      console.error(`[token-scoring] transfers fetch failed: ${(err as Error).message}`);
      break;
    }
  }
  return out;
}

async function fetchTokenContractTxs(
  address: string,
  maxPages = 3
): Promise<ArcscanContractTx[]> {
  const out: ArcscanContractTx[] = [];
  let nextParams = '';
  for (let page = 0; page < maxPages; page++) {
    try {
      const url = `${ARCSCAN_API_URL}/api/v2/addresses/${address}/transactions${nextParams ? `?${nextParams}` : ''}`;
      const res = await axios.get<{
        items?: ArcscanContractTx[];
        next_page_params?: Record<string, unknown>;
      }>(url, { timeout: 10_000 });
      const items = res.data.items || [];
      out.push(...items);
      const np = res.data.next_page_params;
      if (!np || items.length === 0) break;
      const tuples: [string, string][] = Object.entries(np).map(([k, v]) => [k, String(v)]);
      nextParams = new URLSearchParams(tuples).toString();
    } catch (err) {
      console.error(`[token-scoring] contract tx fetch failed: ${(err as Error).message}`);
      break;
    }
  }
  return out;
}

async function fetchDeployerDeployments(deployer: string, maxPages = 5): Promise<number> {
  let count = 0;
  let nextParams = 'filter=from';
  for (let page = 0; page < maxPages; page++) {
    try {
      const url = `${ARCSCAN_API_URL}/api/v2/addresses/${deployer}/transactions?${nextParams}`;
      const res = await axios.get<{
        items?: Array<{ created_contract?: { hash?: string } | null }>;
        next_page_params?: Record<string, unknown>;
      }>(url, { timeout: 10_000 });
      const items = res.data.items || [];
      for (const tx of items) {
        if (tx.created_contract?.hash) count++;
      }
      const np = res.data.next_page_params;
      if (!np || items.length === 0) break;
      const tuples: [string, string][] = Object.entries(np).map(([k, v]) => [k, String(v)]);
      tuples.push(['filter', 'from']);
      nextParams = new URLSearchParams(tuples).toString();
    } catch (err) {
      console.error(`[token-scoring] deployer deployments fetch failed: ${(err as Error).message}`);
      break;
    }
  }
  return count;
}

async function isContract(address: string): Promise<boolean> {
  try {
    const code = await publicClient.getCode({ address: address as `0x${string}` });
    return !!code && code !== '0x';
  } catch {
    return false;
  }
}

async function fetchDeployer(tokenAddress: string): Promise<string | null> {
  try {
    const url = `${ARCSCAN_API_URL}/api/v2/addresses/${tokenAddress}`;
    const res = await axios.get<{ creator_address_hash?: string; creation_tx_hash?: string }>(url, {
      timeout: 8000,
    });
    return res.data.creator_address_hash || null;
  } catch (err) {
    console.error(`[token-scoring] deployer fetch failed: ${(err as Error).message}`);
    return null;
  }
}

interface AddressCounters {
  transactionsCount: number;
  tokenTransfersCount: number;
}

async function fetchAddressCounters(address: string): Promise<AddressCounters> {
  try {
    const url = `${ARCSCAN_API_URL}/api/v2/addresses/${address}/counters`;
    const res = await axios.get<{
      transactions_count?: string | number;
      token_transfers_count?: string | number;
    }>(url, { timeout: 8000 });
    return {
      transactionsCount: Number(res.data.transactions_count || 0),
      tokenTransfersCount: Number(res.data.token_transfers_count || 0),
    };
  } catch (err) {
    console.error(`[token-scoring] counters fetch failed: ${(err as Error).message}`);
    return { transactionsCount: 0, tokenTransfersCount: 0 };
  }
}

// ----- bot signal detectors -----

function detectVelocity(transfers: ArcscanTransfer[]): boolean {
  if (transfers.length < VELOCITY_TXS_PER_HOUR) return false;
  const ms = transfers
    .map((t) => new Date(t.timestamp).getTime())
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
    .map((t) => new Date(t.timestamp).getTime())
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

function detectCleanHistoryManipulation(txs: ArcscanContractTx[]): boolean {
  if (txs.length < CLEAN_HISTORY_MIN_TXS) return false;
  for (const tx of txs) {
    const result = (tx.result || '').toLowerCase();
    const status = (tx.status || '').toLowerCase();
    const failed =
      result === 'error' ||
      result === 'failed' ||
      result === 'reverted' ||
      status === 'error' ||
      status === 'failed' ||
      status === '0';
    if (failed) return false;
  }
  return true;
}

// ----- buyer classification (kept from prior implementation) -----

interface BuyerInfo {
  address: string;
  firstReceivedAt: number;
  firstSource: string;
  isPurchased: boolean;
}

async function classifyHolders(
  holders: ArcscanHolder[],
  transfers: ArcscanTransfer[],
  deployer: string | null,
  tokenAddress: string
): Promise<BuyerInfo[]> {
  const ZERO = '0x0000000000000000000000000000000000000000';
  const deployerLower = deployer?.toLowerCase();
  const tokenLower = tokenAddress.toLowerCase();

  const firstIn: Map<string, ArcscanTransfer> = new Map();
  for (const tx of transfers) {
    const to = tx.to?.hash?.toLowerCase();
    if (!to) continue;
    const tsMs = new Date(tx.timestamp).getTime();
    if (Number.isNaN(tsMs)) continue;
    const existing = firstIn.get(to);
    if (!existing || tsMs < new Date(existing.timestamp).getTime()) {
      firstIn.set(to, tx);
    }
  }

  const topHolders = holders.slice(0, HOLDER_ANALYSIS_CAP);
  const sendersToProbe = new Set<string>();
  for (const h of topHolders) {
    const addr = h.address?.hash?.toLowerCase();
    if (!addr) continue;
    const tx = firstIn.get(addr);
    if (!tx) continue;
    const from = tx.from?.hash?.toLowerCase();
    if (!from) continue;
    if (from === ZERO) continue;
    if (from === deployerLower) continue;
    if (from === tokenLower) continue;
    if (DEX_WHITELIST.has(from)) continue;
    sendersToProbe.add(from);
  }

  const senderIsContract: Map<string, boolean> = new Map();
  const probeList = Array.from(sendersToProbe);
  const CONCURRENCY = 8;
  for (let i = 0; i < probeList.length; i += CONCURRENCY) {
    const slice = probeList.slice(i, i + CONCURRENCY);
    const codes = await Promise.all(slice.map((a) => isContract(a)));
    slice.forEach((a, idx) => senderIsContract.set(a, codes[idx]));
  }

  const results: BuyerInfo[] = [];
  for (const h of topHolders) {
    const addr = h.address?.hash?.toLowerCase();
    if (!addr) continue;
    const tx = firstIn.get(addr);
    if (!tx) continue;
    const from = tx.from?.hash?.toLowerCase() || '';
    const tsMs = new Date(tx.timestamp).getTime();

    let isPurchased = false;
    if (from === ZERO || from === deployerLower) {
      isPurchased = false;
    } else if (DEX_WHITELIST.size > 0 && DEX_WHITELIST.has(from)) {
      isPurchased = true;
    } else if (DEX_WHITELIST.size === 0 && senderIsContract.get(from)) {
      isPurchased = true;
    } else {
      isPurchased = true;
    }

    results.push({
      address: addr,
      firstReceivedAt: tsMs,
      firstSource: from,
      isPurchased,
    });
  }
  return results;
}

function detectCoordinatedBuying(buyers: BuyerInfo[]): boolean {
  const purchased = buyers.filter((b) => b.isPurchased);
  if (purchased.length < 5) return false;
  const times = purchased.map((b) => b.firstReceivedAt).sort((a, b) => a - b);
  let maxInWindow = 0;
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    while (times[right] - times[left] > COORDINATED_WINDOW_MS) left++;
    const inWin = right - left + 1;
    if (inWin > maxInWindow) maxInWindow = inWin;
  }
  return maxInWindow / purchased.length >= COORDINATED_THRESHOLD;
}

// ----- contract significance (drives precompile fallback weighting) -----

interface ContractSignificance {
  multiplier: number;
  reason: string;
}

function contractSignificance(opts: {
  holderCount: number;
  transactionsCount: number;
}): ContractSignificance {
  const reasons: string[] = [];
  let mult = 1.0;
  if (opts.transactionsCount > 10_000) {
    mult = Math.max(mult, 10);
    reasons.push('tx>10000');
  }
  if (opts.transactionsCount > 500) {
    mult = Math.max(mult, 3);
    reasons.push('tx>500');
  }
  if (opts.holderCount > 50) {
    mult = Math.max(mult, 2);
    reasons.push('holders>50');
  }
  if (mult > 10) mult = 10;
  return { multiplier: mult, reason: reasons.join(',') || 'baseline' };
}

function tierFor(score: number): TokenTier {
  if (score < 40) return 'LOW';
  if (score < 60) return 'MEDIUM';
  if (score < 80) return 'HIGH';
  return 'HIGH_ELITE';
}

export interface ComputedTokenScore {
  result: TokenScoreResult;
  // internal — not returned to API caller, used for trend on next refresh
  // and surfaced only to operators / logs.
  _internal: {
    rawBuyerScore: number;
    rawDeployerScore: number;
    deployerDeployments: number;
    tokenAgeDays: number;
    transactionsCount: number;
    botFlags: BotFlag[];
    significanceMultiplier: number;
    appliedCap: number;
  };
}

export async function computeTokenScore(
  rawAddress: string,
  prevScore: number | null,
  nextRefreshAt: Date
): Promise<ComputedTokenScore> {
  const address = getAddress(rawAddress);

  const [info, holders, transfers, deployer, counters, tokenAgeMs, contractTxs] =
    await Promise.all([
      fetchTokenInfo(address),
      fetchHolders(address),
      fetchAllTransfers(address),
      fetchDeployer(address),
      fetchAddressCounters(address),
      fetchTokenAgeMs(address),
      fetchTokenContractTxs(address),
    ]);

  const reportedHolderCount = Number(info?.holders || 0);
  const effectiveHolderCount = Math.max(reportedHolderCount, holders.length);

  const buyers = await classifyHolders(holders, transfers, deployer, address);
  const purchased = buyers.filter((b) => b.isPurchased);

  // Deployer signals
  let deployerDeployments = 0;
  let deployerScore: ScoreResult | null = null;
  if (deployer) {
    const [count, score] = await Promise.all([
      fetchDeployerDeployments(deployer),
      scoreAddress(deployer).catch(() => null as ScoreResult | null),
    ]);
    deployerDeployments = count;
    deployerScore = score;
  }

  // Bot signals
  const botFlags: BotFlag[] = [];
  if (detectVelocity(transfers)) botFlags.push('velocity');
  if (detectIntervalPattern(transfers)) botFlags.push('interval-pattern');
  if (detectSelfInteraction(transfers)) botFlags.push('self-interaction');
  if (detectCleanHistoryManipulation(contractTxs)) botFlags.push('clean-history');
  const coordinated = detectCoordinatedBuying(buyers);
  if (coordinated) botFlags.push('coordinated-buying');

  // Buyer points (with coordinated-buying weight reduction)
  const buyerScores: Array<{ tier: Tier }> = [];
  const CONCURRENCY = 6;
  for (let i = 0; i < purchased.length; i += CONCURRENCY) {
    const slice = purchased.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (b): Promise<ScoreResult | null> => {
        try {
          return await scoreAddress(b.address);
        } catch {
          return null;
        }
      })
    );
    for (const r of results) if (r) buyerScores.push({ tier: r.tier });
  }
  let buyerPoints = 0;
  for (const b of buyerScores) {
    const w = BUYER_WEIGHTS[b.tier] || 0;
    buyerPoints += coordinated ? w * COORDINATED_BUYER_WEIGHT_PENALTY : w;
  }

  // Significance + deployer points
  const sig = contractSignificance({
    holderCount: effectiveHolderCount,
    transactionsCount: counters.transactionsCount,
  });

  let deployerPoints = 0;
  if (deployerScore) {
    deployerPoints = (deployerScore.score / 100) * 30 * sig.multiplier;
  } else if (!deployer && sig.multiplier >= 3) {
    // System precompile / unindexed creation. Award based on the contract's
    // own significance — but caps below still apply, so this never alone
    // promotes a token to HIGH_ELITE without the deployment count.
    deployerPoints = 30 * sig.multiplier;
  }

  // Combine and apply bot-flag penalties (each flag deducts BOT_FLAG_PENALTY)
  let raw = buyerPoints + deployerPoints - botFlags.length * BOT_FLAG_PENALTY;
  if (raw < 0) raw = 0;

  // Hard caps per spec
  const tokenAgeDays = tokenAgeMs > 0 ? tokenAgeMs / DAY_MS : 0;
  const txCount = counters.transactionsCount;

  let cap = 100;

  // Bot-flagged tokens never reach HIGH (60+)
  if (botFlags.length > 0) cap = Math.min(cap, 59);

  // Fresh tokens (very young or low activity) capped at MEDIUM
  const isFresh = tokenAgeDays < 7 || txCount < 10;
  if (isFresh) cap = Math.min(cap, 59);

  // 0 deployments — never above 79 (no HIGH_ELITE per spec). The 85 absolute
  // ceiling in the spec is satisfied by 79 ≤ 85.
  if (deployerDeployments === 0) cap = Math.min(cap, 79);

  // HIGH_ELITE eligibility
  const eliteOk =
    deployerDeployments >= 10 &&
    tokenAgeDays > 180 &&
    txCount > 500 &&
    botFlags.length === 0;
  if (!eliteOk) cap = Math.min(cap, 79);

  // Score == 100 requires exceptional across every signal
  const perfectOk =
    eliteOk &&
    deployerDeployments >= 25 &&
    tokenAgeDays > 365 &&
    txCount > 5000;
  if (!perfectOk) cap = Math.min(cap, 99);

  let score = Math.round(raw);
  if (score > cap) score = cap;
  if (score < 0) score = 0;

  // No purchased holders and no deployer trust → hard zero
  if (purchased.length === 0 && deployerPoints === 0) score = 0;

  console.log(
    `[token-scoring] ${address} score=${score} cap=${cap} ` +
      `buyers=${buyerPoints.toFixed(1)} deployer=${deployerPoints.toFixed(1)} ` +
      `deployments=${deployerDeployments} ageDays=${tokenAgeDays.toFixed(1)} ` +
      `txs=${txCount} sig=${sig.multiplier}x flags=[${botFlags.join(',')}]`
  );

  let trend: Trend = 'stable';
  if (prevScore !== null) {
    const delta = score - prevScore;
    if (delta > 3) trend = 'rising';
    else if (delta < -3) trend = 'falling';
  }

  const now = new Date();
  return {
    result: {
      address,
      score,
      tier: tierFor(score),
      trend,
      last_updated: now.toISOString(),
      next_refresh: nextRefreshAt.toISOString(),
    },
    _internal: {
      rawBuyerScore: buyerPoints,
      rawDeployerScore: deployerPoints,
      deployerDeployments,
      tokenAgeDays,
      transactionsCount: txCount,
      botFlags,
      significanceMultiplier: sig.multiplier,
      appliedCap: cap,
    },
  };
}

export function refreshIntervalMs(tokenAgeMs: number): number {
  if (tokenAgeMs < 7 * DAY_MS) return HOUR_MS;
  if (tokenAgeMs < 30 * DAY_MS) return 6 * HOUR_MS;
  if (tokenAgeMs < 90 * DAY_MS) return 24 * HOUR_MS;
  return 72 * HOUR_MS;
}

export async function fetchTokenAgeMs(address: string): Promise<number> {
  try {
    const url = `${ARCSCAN_API_URL}/api/v2/addresses/${address}`;
    const res = await axios.get<{ creation_tx_hash?: string }>(url, { timeout: 8000 });
    if (!res.data.creation_tx_hash) return 0;
    const tx = await publicClient.getTransaction({
      hash: res.data.creation_tx_hash as `0x${string}`,
    });
    const block = await publicClient.getBlock({ blockNumber: tx.blockNumber });
    const ts = Number(block.timestamp) * 1000;
    return Date.now() - ts;
  } catch {
    return 0;
  }
}
