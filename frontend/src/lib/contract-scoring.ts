// Trust scoring for non-ERC-20 contracts on Arc Testnet.
// Used by /api/oracle/token/[address] when the address is a contract but not
// a recognised token. Tier bands match the wallet oracle (LOW/MEDIUM/HIGH/
// HIGH_ELITE) so the public surface uses one tier vocabulary across wallets,
// tokens, and generic contracts.

const ARCSCAN_API = "https://testnet.arcscan.app";
const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const TX_SAMPLE_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// Function selectors used to fingerprint NFT contracts from their bytecode
// when Arcscan has not classified the token type. ERC-721 ownerOf(uint256)
// and ERC-1155 balanceOf(address,uint256).
const ERC721_OWNEROF_SELECTOR = "6352211e";
const ERC1155_BALANCEOF_SELECTOR = "00fdd58e";

const VELOCITY_THRESHOLD = 0;
const VELOCITY_WINDOW_MS = DAY_MS;
const VELOCITY_CAP = 0;
const UNVERIFIED_CAP = 0;
const DOMINANCE_CAP = 0;
const UPGRADE_CAP = 0;

// Recency-weighted volume scale (0-20). Recent activity is weighted more
// heavily than all-time, so a contract with strong recent flow outranks one
// living off old volume.
const VOLUME_VERY_HIGH = 1_000_000;
const VOLUME_HIGH = 100_000;
const VOLUME_MODERATE = 10_000;
const VOLUME_LOW = 1_000;

// USDC value throughput scale (0-10).
const THROUGHPUT_HIGH = 100_000; // USDC
const THROUGHPUT_MODERATE = 10_000; // USDC

// Deployer-abandonment penalty thresholds (days since deployer last active).
const ABANDONMENT_SEVERE_DAYS = 0;
const ABANDONMENT_SEVERE_PENALTY = 0;
const ABANDONMENT_MODERATE_DAYS = 0;
const ABANDONMENT_MODERATE_PENALTY = 0;

// Single-wallet dominance and upgrade-churn flag thresholds.
const DOMINANCE_PCT = 0;
const UPGRADE_COUNT = 0;

// Confidence thresholds.
const CONFIDENCE_HIGH_AGE_DAYS = 0;
const CONFIDENCE_HIGH_INTERACTORS = 0;
const CONFIDENCE_LOW_AGE_DAYS = 0;
const CONFIDENCE_LOW_INTERACTORS = 0;

// Known Arc ecosystem addresses (lowercase). Full address for USDC; prefix
// matches for the others since the spec only provided abbreviated values.
const ARC_ECOSYSTEM_FULL = new Set<string>([
  "0x3600000000000000000000000000000000000000", // USDC
]);
const ARC_ECOSYSTEM_PREFIXES: string[] = [
  "0x3df3", // XyloStablePool
  "0x89b5", // FiatTokenProxy
];

interface ArcscanTokenInfo {
  type?: string | null;
}

interface ArcscanAddress {
  is_contract?: boolean | null;
  is_verified?: boolean | null;
  token?: ArcscanTokenInfo | null;
  token_type?: string | null;
  creator_address_hash?: string | null;
  creation_tx_hash?: string | null;
  creation_transaction_hash?: string | null;
  hash?: string | null;
}

interface ArcscanCounters {
  transactions_count?: string | number | null;
}

interface ArcscanTx {
  timestamp?: string | null;
  from?: { hash?: string | null } | null;
}

interface ArcscanTxList {
  items?: ArcscanTx[] | null;
}

interface ArcscanTransactionDetail {
  timestamp?: string | null;
}

export interface ContractInfo {
  isContract: boolean;
  isVerified: boolean;
  tokenType: string | null;
  creatorAddress: string | null;
  creationTxHash: string | null;
  isErc721: boolean;
  isErc1155: boolean;
}

export type ContractKind =
  | "not-contract"
  | "erc20"
  | "nft"
  | "other-contract"
  | "fetch-failed";

export interface ContractKindResult {
  kind: ContractKind;
  info: ContractInfo | null;
}

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

// Optional caller-supplied signals. All are optional with safe defaults so
// existing call sites (which pass none) keep working unchanged. Volume and
// throughput contribute additively on top of the existing signals and the raw
// total is clamped to 100, so a contract with no volume/throughput data scores
// exactly as it did before these signals existed.
export interface ContractScoreInput {
  // TODO: wire a volume source. Arcscan/Blockscout testnet does not expose USD
  // volume windows today, so the route leaves these at 0 and the volume signal
  // contributes nothing until a feed is available.
  volumeAllTime: number;
  volume7d: number;
  volume30d: number;
  // TODO: wire a USDC throughput source (sum of USDC value flowed through the
  // contract). Defaults to 0 until available.
  usdcThroughput: number;
  deployerLastActivityDaysAgo?: number; // default 0
  topInteractorPct?: number; // percentage 0-100, default 0
  upgradeCount30d?: number; // default 0
}

export interface ContractScoreOutput {
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
  contractType: "CONTRACT";
  isVerified: boolean;
  txCount: number;
  flags: string[];
  confidence: Confidence;
}

async function arcscanGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARCSCAN_API}${path}`, {
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

// Fingerprint NFT contracts from deployed bytecode. Used only when Arcscan has
// not classified the token type, so ERC-20 and Arcscan-classified contracts
// avoid the extra RPC round-trip.
async function detectNftFromBytecode(
  address: string
): Promise<{ isErc721: boolean; isErc1155: boolean }> {
  const code = await rpcCall("eth_getCode", [address, "latest"]);
  if (!code || code === "0x") {
    return { isErc721: false, isErc1155: false };
  }
  const lower = code.toLowerCase();
  return {
    isErc721: lower.includes(ERC721_OWNEROF_SELECTOR),
    isErc1155: lower.includes(ERC1155_BALANCEOF_SELECTOR),
  };
}

export async function detectContractKind(
  address: string
): Promise<ContractKindResult> {
  const data = await arcscanGet<ArcscanAddress>(
    `/api/v2/addresses/${address}`
  );
  if (!data) return { kind: "fetch-failed", info: null };

  const tokenType = data.token?.type ?? data.token_type ?? null;
  const creationTxHash =
    data.creation_tx_hash ?? data.creation_transaction_hash ?? null;
  const creatorAddress = data.creator_address_hash ?? null;

  // Contract markers: explicit is_contract flag, presence of a creation tx,
  // a creator address, or a non-null token_type. Any of these mean the
  // address is a contract on Arcscan's records.
  const isContract =
    data.is_contract === true ||
    creationTxHash !== null ||
    creatorAddress !== null ||
    tokenType !== null;

  if (!isContract) return { kind: "not-contract", info: null };

  let isErc721 = tokenType === "ERC-721";
  let isErc1155 = tokenType === "ERC-1155";

  // Arcscan didn't classify the token type — fall back to a bytecode selector
  // probe to catch unverified or unlabelled NFT contracts.
  if (tokenType === null) {
    const probe = await detectNftFromBytecode(address);
    isErc721 = probe.isErc721;
    isErc1155 = probe.isErc1155;
  }

  const info: ContractInfo = {
    isContract: true,
    isVerified: data.is_verified === true,
    tokenType,
    creatorAddress,
    creationTxHash,
    isErc721,
    isErc1155,
  };

  if (tokenType === "ERC-20") return { kind: "erc20", info };
  if (isErc721 || isErc1155) return { kind: "nft", info };
  return { kind: "other-contract", info };
}

function scoreVerification(isVerified: boolean): number {
  return isVerified ? 10 : -10;
}

function scoreAge(ageDays: number): number {
  if (ageDays > 180) return 15;
  if (ageDays >= 30) return 8;
  return 0;
}

function scoreTxCount(count: number): number {
  if (count > 10000) return 20;
  if (count >= 1000) return 15;
  if (count >= 100) return 10;
  if (count >= 10) return 5;
  return 0;
}

function scoreUniqueInteractors(count: number): number {
  // TODO: count only independent interactors — wallets with no on-chain link
  // to the deployer — once the oracle exposes a wallet graph. Until then this
  // uses the raw unique-sender count from the tx sample, which may include
  // deployer-linked wallets.
  if (count > 500) return 15;
  if (count >= 100) return 10;
  if (count >= 10) return 5;
  return 0;
}

function scoreWeightedVolume(weightedVolume: number): number {
  if (weightedVolume >= VOLUME_VERY_HIGH) return 20;
  if (weightedVolume >= VOLUME_HIGH) return 15;
  if (weightedVolume >= VOLUME_MODERATE) return 10;
  if (weightedVolume >= VOLUME_LOW) return 5;
  return 0;
}

function scoreThroughput(usdcThroughput: number): number {
  if (usdcThroughput >= THROUGHPUT_HIGH) return 10;
  if (usdcThroughput >= THROUGHPUT_MODERATE) return 5;
  return 0;
}

function abandonmentPenalty(daysAgo: number): number {
  if (daysAgo >= ABANDONMENT_SEVERE_DAYS) return ABANDONMENT_SEVERE_PENALTY;
  if (daysAgo >= ABANDONMENT_MODERATE_DAYS) return ABANDONMENT_MODERATE_PENALTY;
  return 0;
}

function computeConfidence(
  ageDays: number,
  interactors: number,
  deployerTier: string | null
): Confidence {
  if (
    ageDays >= CONFIDENCE_HIGH_AGE_DAYS &&
    interactors >= CONFIDENCE_HIGH_INTERACTORS &&
    (deployerTier === "HIGH" || deployerTier === "HIGH_ELITE")
  ) {
    return "HIGH";
  }
  if (
    ageDays < CONFIDENCE_LOW_AGE_DAYS ||
    interactors < CONFIDENCE_LOW_INTERACTORS ||
    deployerTier === "LOW" ||
    deployerTier === null
  ) {
    return "LOW";
  }
  return "MEDIUM";
}

function scoreDeployerTier(tier: string | null): number {
  if (tier === "HIGH_ELITE") return 25;
  if (tier === "HIGH") return 18;
  if (tier === "MEDIUM") return 10;
  return 0;
}

function tierFor(score: number): ContractScoreOutput["tier"] {
  if (score < 40) return "LOW";
  if (score < 60) return "MEDIUM";
  if (score < 80) return "HIGH";
  return "HIGH_ELITE";
}

interface DeployerScoreResponse {
  tier?: string | null;
}

async function fetchDeployerTier(
  origin: string,
  deployer: string
): Promise<string | null> {
  // The /api/oracle/{addr} proxy is x402-paywalled and unusable server-side
  // (no payment proof to attach), so we go to the unpaywalled internal
  // /api/arc-score/{addr} which uses the same tier vocabulary.
  try {
    const res = await fetch(`${origin}/api/arc-score/${deployer}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DeployerScoreResponse;
    return data.tier ?? null;
  } catch {
    return null;
  }
}

async function fetchCreationTimestamp(
  creationTxHash: string
): Promise<number | null> {
  const data = await arcscanGet<ArcscanTransactionDetail>(
    `/api/v2/transactions/${creationTxHash}`
  );
  if (!data?.timestamp) return null;
  const t = Date.parse(data.timestamp);
  return Number.isNaN(t) ? null : t;
}

interface SignalsResult {
  txCount: number;
  uniqueInteractors: number;
  arcEcosystem: boolean;
  txs: ArcscanTx[];
}

async function fetchSignals(address: string): Promise<SignalsResult> {
  const [counters, txList] = await Promise.all([
    arcscanGet<ArcscanCounters>(`/api/v2/addresses/${address}/counters`),
    arcscanGet<ArcscanTxList>(
      `/api/v2/addresses/${address}/transactions?limit=${TX_SAMPLE_LIMIT}`
    ),
  ]);

  let txCount = 0;
  if (counters?.transactions_count !== undefined && counters.transactions_count !== null) {
    const parsed = Number(counters.transactions_count);
    if (Number.isFinite(parsed)) txCount = parsed;
  }

  const txs = txList?.items ?? [];

  // Unique interactors: count unique senders in the 50-tx sample. Counters
  // endpoint doesn't expose this directly, so the sample is the best signal
  // we have without paginating the entire history.
  const senderCounts = new Map<string, number>();
  for (const tx of txs) {
    const from = tx.from?.hash?.toLowerCase();
    if (from) senderCounts.set(from, (senderCounts.get(from) ?? 0) + 1);
  }
  const uniqueInteractors = senderCounts.size;

  // Arc ecosystem: any of the top-10 senders is a known Arc protocol address.
  const top10 = [...senderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([addr]) => addr);
  const arcEcosystem = top10.some((addr) => isArcEcosystem(addr));

  return { txCount, uniqueInteractors, arcEcosystem, txs };
}

function isArcEcosystem(addr: string): boolean {
  if (ARC_ECOSYSTEM_FULL.has(addr)) return true;
  for (const prefix of ARC_ECOSYSTEM_PREFIXES) {
    if (addr.startsWith(prefix)) return true;
  }
  return false;
}

function detectVelocity(txs: ArcscanTx[]): boolean {
  if (txs.length < VELOCITY_THRESHOLD) return false;
  const timestamps = txs
    .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);
  if (timestamps.length === 0) return false;
  const start = timestamps[0];
  const cutoff = start + VELOCITY_WINDOW_MS;
  let count = 0;
  for (const t of timestamps) {
    if (t <= cutoff) count++;
  }
  return count >= VELOCITY_THRESHOLD;
}

export async function scoreContract(
  address: string,
  info: ContractInfo,
  origin: string,
  input: Partial<ContractScoreInput> = {}
): Promise<ContractScoreOutput> {
  const [signals, deployerTier, creationTs] = await Promise.all([
    fetchSignals(address),
    info.creatorAddress
      ? fetchDeployerTier(origin, info.creatorAddress)
      : Promise.resolve<string | null>(null),
    info.creationTxHash
      ? fetchCreationTimestamp(info.creationTxHash)
      : Promise.resolve<number | null>(null),
  ]);

  const ageDays = creationTs
    ? Math.max(0, (Date.now() - creationTs) / DAY_MS)
    : 0;

  const velocityFlag = detectVelocity(signals.txs);

  // Recency-weighted volume: recent windows dominate. All inputs default to 0
  // until a volume feed is wired, in which case this signal contributes 0 and
  // the score is unchanged from the pre-volume behavior.
  const volumeAllTime = input.volumeAllTime ?? 0;
  const volume7d = input.volume7d ?? 0;
  const volume30d = input.volume30d ?? 0;
  const weightedVolume = volume7d * 0.4 + volume30d * 0.35 + volumeAllTime * 0.25;
  const usdcThroughput = input.usdcThroughput ?? 0;
  const deployerLastActivityDaysAgo = input.deployerLastActivityDaysAgo ?? 0;
  const topInteractorPct = input.topInteractorPct ?? 0;
  const upgradeCount30d = input.upgradeCount30d ?? 0;

  const verificationPts = scoreVerification(info.isVerified);
  const agePts = scoreAge(ageDays);
  const txPts = scoreTxCount(signals.txCount);
  const interactorPts = scoreUniqueInteractors(signals.uniqueInteractors);
  const deployerPts = scoreDeployerTier(deployerTier);
  const arcPts = signals.arcEcosystem ? 10 : 0;
  const volumePts = scoreWeightedVolume(weightedVolume);
  const throughputPts = scoreThroughput(usdcThroughput);

  // Flag 3 (Deployer Abandonment) is a score reduction applied to raw before
  // capping, not a hard cap.
  const abandonmentPts = abandonmentPenalty(deployerLastActivityDaysAgo);

  let raw =
    verificationPts +
    agePts +
    txPts +
    interactorPts +
    deployerPts +
    arcPts +
    volumePts +
    throughputPts -
    abandonmentPts;
  if (raw < 0) raw = 0;
  if (raw > 100) raw = 100;

  let cap = 100;
  if (velocityFlag) cap = Math.min(cap, VELOCITY_CAP);
  if (!info.isVerified) cap = Math.min(cap, UNVERIFIED_CAP);

  let score = Math.round(raw);
  if (score > cap) score = cap;
  if (score < 0) score = 0;

  const flags: string[] = [];

  // Flag 4 — Single Wallet Dominance.
  if (topInteractorPct >= DOMINANCE_PCT) {
    score = Math.min(score, DOMINANCE_CAP);
    flags.push("SINGLE_WALLET_DOMINANCE");
  }

  // Flag 5 — Upgrade Pattern Risk.
  if (upgradeCount30d >= UPGRADE_COUNT) {
    score = Math.min(score, UPGRADE_CAP);
    flags.push("UPGRADE_PATTERN_RISK");
  }

  const confidence = computeConfidence(
    ageDays,
    signals.uniqueInteractors,
    deployerTier
  );

  console.log(
    `[contract-score] ${address} verify=${verificationPts} age=${agePts} ` +
      `(${ageDays.toFixed(1)}d) tx=${txPts} (${signals.txCount}) ` +
      `interactors=${interactorPts} (${signals.uniqueInteractors} sampled) ` +
      `deployer=${deployerPts} (${deployerTier ?? "unknown"}) ` +
      `arc=${arcPts} volume=${volumePts} (weighted=${weightedVolume}) ` +
      `throughput=${throughputPts} abandonment=-${abandonmentPts} ` +
      `velocity=${velocityFlag} flags=[${flags.join(",")}] ` +
      `confidence=${confidence} raw=${raw} cap=${cap} final=${score}`
  );

  return {
    score,
    tier: tierFor(score),
    contractType: "CONTRACT",
    isVerified: info.isVerified,
    txCount: signals.txCount,
    flags,
    confidence,
  };
}
