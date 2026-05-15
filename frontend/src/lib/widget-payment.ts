// Server-side x402 payment + caching for the widget oracle proxy.
//
// Pays the 0.001 USDC needed to query upstream Nald for ERC-20 token scores
// from a server-managed hot wallet, mirroring the X-Payment header format
// the Token Shield client constructs. The widget thereby returns the same
// authoritative ERC-20 score Token Shield gets, without asking the caller
// to sign anything.
//
// In-memory result cache (5 min TTL) and in-flight request dedup prevent
// paying twice for the same address in quick succession. A single mutex
// chain serialises all wallet tx broadcasts so nonces never collide on a
// single-instance deployment.
//
// Required env vars:
//   WIDGET_HOT_WALLET_PRIVATE_KEY  0x-prefixed 32-byte hex of the server
//                                  wallet's secp256k1 private key.
//   ORACLE_URL / NEXT_PUBLIC_ORACLE_URL  Upstream Nald base URL.
//
// Operational note: the hot wallet must hold ERC-20 USDC (0x3600..., 6
// decimals) for the transfer value AND Arc native gas for tx fees. Either
// running out causes queries to 502.
//
// Multi-instance deployments would need a shared nonce manager (Redis
// lock) and shared cache — single-instance Railway/Vercel deployment is
// the current target.

import { randomUUID } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { erc20Abi } from "@/lib/abi/ERC20";
import { arcTestnet, CONTRACT_ADDRESSES } from "@/lib/constants";

const DEFAULT_ORACLE_URL = "https://oracle.trustgated.xyz";
const ORACLE_BASE = (
  process.env.ORACLE_URL ||
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  DEFAULT_ORACLE_URL
).replace(/\/+$/, "");

const PAYMENT_AMOUNT_USDC = "0.001";
const PAYMENT_AMOUNT_RAW = parseUnits(PAYMENT_AMOUNT_USDC, 6); // 1000n at 6 decimals
const RECIPIENT = CONTRACT_ADDRESSES.trustGate;
const USDC = CONTRACT_ADDRESSES.usdc;

const SCORE_CACHE_TTL_MS = 5 * 60_000;

export interface WidgetScore {
  score: number;
  tier: string;
  contractType: string;
}

interface CachedScore {
  result: WidgetScore;
  expiresAt: number;
}

interface WalletCtx {
  account: PrivateKeyAccount;
  walletClient: WalletClient;
  publicClient: PublicClient;
}

let walletCtx: WalletCtx | null = null;

function getWalletCtx(): WalletCtx {
  if (walletCtx) return walletCtx;
  const pk = process.env.WIDGET_HOT_WALLET_PRIVATE_KEY;
  if (!pk || !/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new Error(
      "WIDGET_HOT_WALLET_PRIVATE_KEY env var not configured " +
        "(expected 0x-prefixed 32-byte hex)"
    );
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: arcTestnet,
    transport: http(),
  });
  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
  walletCtx = { account, walletClient, publicClient };
  return walletCtx;
}

// Mutex chain: every wallet tx awaits the previous one. Failures don't
// poison the chain — the catch returns undefined so the next caller still
// proceeds.
let txChain: Promise<unknown> = Promise.resolve();

async function payAndBuildHeader(): Promise<{
  header: string;
  txHash: `0x${string}`;
}> {
  const ctx = getWalletCtx();
  const task = txChain.then(async () => {
    const txHash = await ctx.walletClient.writeContract({
      account: ctx.account,
      chain: arcTestnet,
      address: USDC,
      abi: erc20Abi,
      functionName: "transfer",
      args: [RECIPIENT, PAYMENT_AMOUNT_RAW],
    });
    const receipt = await ctx.publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
    });
    if (receipt.status !== "success") {
      throw new Error(`payment tx reverted on Arc: ${txHash}`);
    }
    // Fresh per-request opaque nonce. Nald's replay protection is a single
    // global `usedNonces` set; wallet-local blockchain nonces collide across
    // users. UUIDs guarantee uniqueness.
    const payload = JSON.stringify({
      scheme: "exact",
      network: "Arc Testnet",
      txHash,
      from: ctx.account.address,
      amount: PAYMENT_AMOUNT_USDC,
      nonce: randomUUID(),
    });
    const header = Buffer.from(payload, "utf-8").toString("base64");
    return { header, txHash };
  });
  txChain = task.catch(() => undefined);
  return task;
}

async function fetchUpstream(
  address: string,
  xPaymentHeader: string,
  txHash: string
): Promise<WidgetScore> {
  const url = `${ORACLE_BASE}/oracle/token/${encodeURIComponent(address)}`;
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "X-Payment": xPaymentHeader,
      "X-Payment-Tx": txHash,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `upstream ${res.status} ${res.statusText}: ${body.slice(0, 200)}`
    );
  }
  const data: unknown = await res.json();
  if (
    typeof data !== "object" ||
    data === null ||
    typeof (data as { score?: unknown }).score !== "number" ||
    typeof (data as { tier?: unknown }).tier !== "string"
  ) {
    throw new Error("upstream returned unexpected response shape");
  }
  const d = data as { score: number; tier: string; contractType?: string };
  return {
    score: d.score,
    tier: d.tier,
    contractType: d.contractType ?? "ERC-20",
  };
}

const scoreCache = new Map<string, CachedScore>();
const inFlight = new Map<string, Promise<WidgetScore>>();

export async function scoreErc20ViaUpstream(
  address: string
): Promise<WidgetScore> {
  const key = address.toLowerCase();
  const now = Date.now();

  const cached = scoreCache.get(key);
  if (cached && cached.expiresAt > now) return cached.result;

  const existing = inFlight.get(key);
  if (existing) return existing;

  const task: Promise<WidgetScore> = (async () => {
    try {
      const { header, txHash } = await payAndBuildHeader();
      const result = await fetchUpstream(address, header, txHash);
      scoreCache.set(key, {
        result,
        expiresAt: Date.now() + SCORE_CACHE_TTL_MS,
      });
      return result;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}
