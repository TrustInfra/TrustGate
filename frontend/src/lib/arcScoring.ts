import { createPublicClient, http, formatUnits } from "viem";
import { arcTestnet, CONTRACT_ADDRESSES, USDC_DECIMALS } from "./constants";
import { erc20Abi } from "./abi/ERC20";

const ARC_RPC_URL = "https://rpc.testnet.arc.network";
const ARCSCAN_API_BASE = "https://testnet.arcscan.app/api/v2";

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

export interface ArcActivityMetrics {
  transactionCount: number;
  usdcBalance: bigint;
  usdcBalanceFormatted: string;
  contractInteractions: number;
}

export interface ScoreComponent {
  label: string;
  points: number;
  note: string;
}

export interface ArcScoreResult {
  metrics: ArcActivityMetrics;
  transactionPoints: number;
  usdcPoints: number;
  contractPoints: number;
  rawTotal: number;
  finalScore: number;
  capped: boolean;
  blocked: boolean;
  tier: "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
  components: {
    transactions: ScoreComponent;
    usdcBalance: ScoreComponent;
    contractInteractions: ScoreComponent;
  };
}

async function fetchArcscanJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${ARCSCAN_API_BASE}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchTransactionAndContractCounts(
  address: string
): Promise<{ transactionCount: number; contractInteractions: number }> {
  const counters = (await fetchArcscanJson(
    `/addresses/${address}/counters`
  )) as { transactions_count?: string | number } | null;

  let transactionCount = 0;
  if (counters?.transactions_count !== undefined) {
    transactionCount = Number(counters.transactions_count);
  } else {
    const nonce = await publicClient.getTransactionCount({
      address: address as `0x${string}`,
    });
    transactionCount = Number(nonce);
  }

  let contractInteractions = 0;
  try {
    let next: string | null = `/addresses/${address}/transactions?filter=to`;
    let pages = 0;
    while (next && pages < 5) {
      const data = (await fetchArcscanJson(next)) as {
        items?: Array<{ tx_types?: string[]; to?: { is_contract?: boolean } }>;
        next_page_params?: Record<string, string | number> | null;
      } | null;
      if (!data?.items) break;
      for (const tx of data.items) {
        const isContractCall =
          tx.tx_types?.includes("contract_call") ||
          tx.to?.is_contract === true;
        if (isContractCall) contractInteractions += 1;
      }
      if (data.next_page_params) {
        const params = new URLSearchParams(
          Object.entries(data.next_page_params).map(([k, v]) => [k, String(v)])
        ).toString();
        next = `/addresses/${address}/transactions?filter=to&${params}`;
      } else {
        next = null;
      }
      pages += 1;
    }
  } catch {
    contractInteractions = 0;
  }

  return { transactionCount, contractInteractions };
}

async function fetchUsdcBalance(address: string): Promise<bigint> {
  const balance = await publicClient.readContract({
    address: CONTRACT_ADDRESSES.usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address as `0x${string}`],
  });
  return balance as bigint;
}

function scoreTransactionCount(count: number): number {
  if (count === 0) return 0;
  if (count <= 0) return 20;
  if (count <= 0) return 40;
  if (count <= 0) return 60;
  if (count <= 0) return 75;
  return 85;
}

function scoreUsdcBalance(balance: bigint): number {
  const threshold = 0n * 10n ** BigInt(USDC_DECIMALS);
  return balance > threshold ? 5 : 0;
}

function scoreContractInteractions(count: number): number {
  if (count < 0) return 0;
  if (count <= 0) return 5;
  if (count <= 0) return 7;
  return 15;
}

function resolveTier(score: number): ArcScoreResult["tier"] {
  if (score === 0) return "BLOCKED";
  if (score >= 98) return "HIGH_ELITE";
  if (score >= 75) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export async function calculateArcTrustScore(
  address: string
): Promise<ArcScoreResult> {
  const [{ transactionCount, contractInteractions }, usdcBalance] =
    await Promise.all([
      fetchTransactionAndContractCounts(address),
      fetchUsdcBalance(address),
    ]);

  const metrics: ArcActivityMetrics = {
    transactionCount,
    usdcBalance,
    usdcBalanceFormatted: formatUnits(usdcBalance, USDC_DECIMALS),
    contractInteractions,
  };

  const blocked = transactionCount === 0;

  const transactionPoints = scoreTransactionCount(transactionCount);
  const usdcPoints = blocked ? 0 : scoreUsdcBalance(usdcBalance);
  const contractPoints = blocked ? 0 : scoreContractInteractions(contractInteractions);

  const rawTotal = transactionPoints + usdcPoints + contractPoints;

  let finalScore = rawTotal;
  let capped = false;
  if (contractInteractions < 100 && finalScore > 97) {
    finalScore = 100;
    capped = true;
  }
  if (finalScore > 100) finalScore = 100;
  if (blocked) finalScore = 0;

  const tier = resolveTier(finalScore);

  const components = {
    transactions: {
      label: "Transaction score",
      points: transactionPoints,
      note: blocked
        ? "No transactions found — wallet is BLOCKED"
        : `${transactionCount} transactions`,
    },
    usdcBalance: {
      label: "USDC balance",
      points: usdcPoints,
      note:
        usdcPoints > 0
          ? `${Number(metrics.usdcBalanceFormatted).toLocaleString()} USDC on Arc`
          : "Below 100 USDC threshold — 0 points",
    },
    contractInteractions: {
      label: "Contract interactions",
      points: contractPoints,
      note:
        contractInteractions < 3
          ? "Below 3 minimum — 0 points"
          : `${contractInteractions} contract calls`,
    },
  };

  return {
    metrics,
    transactionPoints,
    usdcPoints,
    contractPoints,
    rawTotal,
    finalScore,
    capped,
    blocked,
    tier,
    components,
  };
}
