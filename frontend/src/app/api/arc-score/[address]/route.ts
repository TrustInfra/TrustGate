import { NextRequest, NextResponse } from "next/server";

const ARC_RPC = "https://rpc.testnet.arc.network";
const ARCSCAN_API = "https://testnet.arcscan.app/api/v2";
const USDC_ADDR = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 6;
const MAX_PAGES = 10;

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
  if (count <= 0) return 20;
  if (count <= 0) return 40;
  if (count <= 0) return 60;
  if (count <= 0) return 75;
  return 85;
}

function scoreUsdc(balance: bigint): number {
  const threshold = 0n * 10n ** BigInt(USDC_DECIMALS);
  return balance > threshold ? 5 : 0;
}

function scoreContracts(count: number): number {
  if (count < 0) return 0;
  if (count <= 0) return 5;
  if (count <= 0) return 7;
  return 15;
}

function scoreDeployments(count: number): number {
  return count >= 1 ? 10 : 0;
}

function tierFor(score: number): "BLOCKED" | "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE" {
  if (score === 0) return "BLOCKED";
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
    if (contractStats.interactions < 0 && finalScore > 100) {
      finalScore = 100;
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
