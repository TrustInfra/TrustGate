import "server-only";
import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = "https://rpc.testnet.arc.network";
const ARCSCAN_API = "https://testnet.arcscan.app/api/v2";
const USDC_ADDR = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 6;
const MAX_PAGES = 10;

// Sensitive scoring constants are sourced from server-only environment
// variables (SCORING_ARC_ prefix, no NEXT_PUBLIC_) so the thresholds, caps, and
// band edges never ship to the client. Each read is wrapped in Number().
// Fallbacks are deliberately neutral, NOT the real production values, and each
// is chosen so a single missing var fails safe (never inflates a score, never
// wrongly caps a legitimate wallet) rather than leaking or faking real values.

// Interactor anti-gaming cap (the most sensitive value in this file): a wallet
// with too few distinct contract interactions is capped just below the elite
// edge so it cannot reach HIGH_ELITE by farming raw points. Both fallbacks
// DISABLE the cap so a missing-env deploy never wrongly caps a legitimate
// wallet: min-interactions defaults to 0 (interactions < 0 is impossible) and
// the cap score defaults to 100 (finalScore > 100 is impossible, and capping to
// 100 is a no-op anyway).
// COUPLING: INTERACTOR_CAP_SCORE must stay exactly one below the hardcoded
// HIGH_ELITE tier edge (98 in tierFor). The cap exists to keep gamed wallets out
// of HIGH_ELITE, so if that elite edge ever moves, this cap must move with it.
const INTERACTOR_CAP_MIN_INTERACTIONS = Number(process.env.SCORING_ARC_INTERACTOR_CAP_MIN_INTERACTIONS ?? 0);
const INTERACTOR_CAP_SCORE = Number(process.env.SCORING_ARC_INTERACTOR_CAP_SCORE ?? 100);

// scoreTxCount band edges (upper bound of each tx-count band, ascending). The
// cascade awards MORE points as the count rises, so an extreme-LOW edge would
// let a low-activity wallet escape into a higher-point band (inflation). The
// neutral fallback is therefore extreme-HIGH: every active wallet stays trapped
// in the lowest non-zero band (20 pts) rather than being over-rewarded.
const TX_BAND_1 = Number(process.env.SCORING_ARC_TX_BAND_1 ?? 999999); // count <= edge -> 20 pts
const TX_BAND_2 = Number(process.env.SCORING_ARC_TX_BAND_2 ?? 999999); // count <= edge -> 40 pts
const TX_BAND_3 = Number(process.env.SCORING_ARC_TX_BAND_3 ?? 999999); // count <= edge -> 60 pts
const TX_BAND_4 = Number(process.env.SCORING_ARC_TX_BAND_4 ?? 999999); // count <= edge -> 75 pts

// scoreContracts band edges. CONTRACT_MIN is the floor: below it the wallet
// earns zero contract points, so defaulting it extreme-HIGH denies the points
// (safe). BAND_1 / BAND_2 are the upper bounds of the 5 / 7 point bands; like
// the tx bands the top award (15) goes to the highest counts, so extreme-HIGH
// fallbacks trap a wallet in the lower-point band rather than inflating it.
const CONTRACT_MIN = Number(process.env.SCORING_ARC_CONTRACT_MIN ?? 999999); // count < min -> 0 pts
const CONTRACT_BAND_1 = Number(process.env.SCORING_ARC_CONTRACT_BAND_1 ?? 999999); // count <= edge -> 5 pts
const CONTRACT_BAND_2 = Number(process.env.SCORING_ARC_CONTRACT_BAND_2 ?? 999999); // count <= edge -> 7 pts

// scoreUsdc bonus gate: +5 only when the balance clears this many whole USDC.
// Neutral fallback is extreme-HIGH so the bonus is never wrongly awarded when
// the real threshold is missing.
const USDC_BONUS_MIN = Number(process.env.SCORING_ARC_USDC_BONUS_MIN ?? 999999999);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BlockscoutTx {
  transaction_types?: string[];
  tx_types?: string[];
  to?: { hash?: string; is_contract?: boolean } | null;
  created_contract?: { hash?: string } | null;
}

interface BlockscoutTxPage {
  items?: BlockscoutTx[];
  next_page_params?: Record<string, string | number> | null;
}

async function rpcCall(method: string, params: unknown[]): Promise<string> {
  const res = await fetch(ARC_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`RPC HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    result?: string;
    error?: { message: string };
  };
  if (data.error) throw new Error(data.error.message);
  if (!data.result) throw new Error("RPC returned no result");
  return data.result;
}

async function getTxCount(address: string): Promise<number> {
  const hex = await rpcCall("eth_getTransactionCount", [address, "latest"]);
  const count = parseInt(hex, 16);
  console.log(`[arc-score] eth_getTransactionCount(${address}) = ${count}`);
  return count;
}

async function getUsdcBalance(address: string): Promise<bigint> {
  const selector = "0x70a08231";
  const paddedAddr = address.slice(2).toLowerCase().padStart(64, "0");
  const data = `${selector}${paddedAddr}`;
  const result = await rpcCall("eth_call", [
    { to: USDC_ADDR, data },
    "latest",
  ]);
  const balance = BigInt(result);
  console.log(
    `[arc-score] USDC balanceOf(${address}) raw=${balance.toString()} human=${
      Number(balance) / 10 ** USDC_DECIMALS
    }`
  );
  return balance;
}

async function getContractStats(
  address: string
): Promise<{ interactions: number; deployments: number; scanned: number }> {
  let interactions = 0;
  let deployments = 0;
  let scanned = 0;
  let nextParams: URLSearchParams | null = new URLSearchParams({
    filter: "from",
  });
  let page = 0;

  while (nextParams && page < MAX_PAGES) {
    const url = `${ARCSCAN_API}/addresses/${address}/transactions?${nextParams.toString()}`;
    console.log(`[arc-score] fetching page ${page + 1}: ${url}`);

    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.log(
        `[arc-score] arcscan responded ${res.status} on page ${page + 1} — stopping`
      );
      break;
    }

    const data = (await res.json()) as BlockscoutTxPage;
    const items = data.items ?? [];
    scanned += items.length;

    for (const tx of items) {
      const types = tx.transaction_types ?? tx.tx_types ?? [];
      const hasCreatedContract =
        tx.created_contract !== null && tx.created_contract !== undefined;
      const isDeployment =
        types.includes("contract_creation") ||
        hasCreatedContract ||
        tx.to === null ||
        tx.to === undefined;
      const isContractCall =
        types.includes("contract_call") ||
        (tx.to && tx.to.is_contract === true);

      if (isDeployment) {
        deployments += 1;
      } else if (isContractCall) {
        interactions += 1;
      }
    }

    if (data.next_page_params) {
      const next = new URLSearchParams({ filter: "from" });
      for (const [k, v] of Object.entries(data.next_page_params)) {
        next.set(k, String(v));
      }
      nextParams = next;
      page += 1;
    } else {
      nextParams = null;
    }
  }

  console.log(
    `[arc-score] scanned ${scanned} txs — interactions=${interactions} deployments=${deployments}`
  );
  return { interactions, deployments, scanned };
}

function scoreTxCount(count: number): number {
  if (count === 0) return 0;
  if (count <= TX_BAND_1) return 20;
  if (count <= TX_BAND_2) return 40;
  if (count <= TX_BAND_3) return 60;
  if (count <= TX_BAND_4) return 75;
  return 85;
}

function scoreUsdc(balance: bigint): number {
  const threshold = BigInt(USDC_BONUS_MIN) * 10n ** BigInt(USDC_DECIMALS);
  return balance > threshold ? 5 : 0;
}

function scoreContracts(count: number): number {
  if (count < CONTRACT_MIN) return 0;
  if (count <= CONTRACT_BAND_1) return 5;
  if (count <= CONTRACT_BAND_2) return 7;
  return 15;
}

function scoreDeployments(count: number): number {
  return count >= 1 ? 10 : 0;
}

function tierFor(score: number): "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE" {
  if (score === 0) return "BLOCKED";
  // The 40 / 75 / 98 tier edges are intentionally hardcoded. The 98 HIGH_ELITE
  // edge is COUPLED to INTERACTOR_CAP_SCORE (the anti-gaming cap, externalized
  // above): the cap must stay exactly one below this edge so a low-interaction
  // wallet can never be tiered HIGH_ELITE. Keep the two consistent if either moves.
  if (score >= 98) return "HIGH_ELITE";
  if (score >= 75) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400 }
    );
  }

  console.log(`\n[arc-score] ===== scoring ${address} =====`);

  try {
    const [txCount, usdcBalance, contractStats] = await Promise.all([
      getTxCount(address),
      getUsdcBalance(address),
      getContractStats(address),
    ]);

    const blocked = txCount === 0;

    const txPoints = scoreTxCount(txCount);
    const usdcPoints = blocked ? 0 : scoreUsdc(usdcBalance);
    const contractPoints = blocked ? 0 : scoreContracts(contractStats.interactions);
    const deployPoints = blocked ? 0 : scoreDeployments(contractStats.deployments);

    const rawTotal = txPoints + usdcPoints + contractPoints + deployPoints;

    let finalScore = rawTotal;
    let capped = false;
    if (
      contractStats.interactions < INTERACTOR_CAP_MIN_INTERACTIONS &&
      finalScore > INTERACTOR_CAP_SCORE
    ) {
      finalScore = INTERACTOR_CAP_SCORE;
      capped = true;
    }
    if (finalScore > 100) finalScore = 100;
    if (blocked) finalScore = 0;

    const tier = tierFor(finalScore);

    console.log(
      `[arc-score] points: tx=${txPoints} usdc=${usdcPoints} contract=${contractPoints} deploy=${deployPoints}`
    );
    console.log(`[arc-score] rawTotal=${rawTotal} capped=${capped} finalScore=${finalScore} tier=${tier}`);

    return NextResponse.json({
      score: finalScore,
      tier,
      blocked,
      capped,
      breakdown: {
        txPoints,
        usdcPoints,
        contractPoints,
        deployPoints,
        txCount,
        usdcBalance: usdcBalance.toString(),
        usdcBalanceHuman: Number(usdcBalance) / 10 ** USDC_DECIMALS,
        contractInteractions: contractStats.interactions,
        contractDeployments: contractStats.deployments,
        scannedTxs: contractStats.scanned,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[arc-score] FAILED for ${address}:`, message);
    return NextResponse.json(
      { error: `Arc scoring failed: ${message}` },
      { status: 502 }
    );
  }
}
