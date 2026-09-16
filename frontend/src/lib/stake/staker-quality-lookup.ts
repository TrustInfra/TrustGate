import "server-only";

import { RPC_URL } from "../chain";
import { isContractAddress } from "../contract-detect";
import { indexerGet } from "../indexer";
import {
  daysHeldOver50,
  stakerQualityWeight,
  type BalanceTransfer,
} from "./staker-quality";

const TTL_MS = 10 * 60 * 1000;
const TX_PAGES = 2;
const cache = new Map<string, { weight: number; expiresAt: number }>();

interface RpcHex {
  result?: string;
}

interface AddrInfo {
  created_at?: string | null;
  creation?: { timestamp?: number | string | null } | null;
}

interface TxItem {
  timestamp?: string | null;
  from?: { hash?: string } | null;
  to?: { hash?: string } | null;
  value?: string | number | null;
}

interface TxPage {
  items?: TxItem[] | null;
  next_page_params?: Record<string, string> | null;
}

async function rpcHex(method: string, params: unknown[]): Promise<string | null> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RpcHex;
    return typeof data.result === "string" ? data.result : null;
  } catch {
    return null;
  }
}

function hexToInt(hex: string | null): number | null {
  if (!hex) return null;
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : null;
}

/** Native Arc USDC is 18 decimals and $1. */
function weiToUsd(raw: string | number | null | undefined): number {
  if (raw == null || raw === "") return 0;
  try {
    const wei = BigInt(typeof raw === "number" ? Math.trunc(raw) : raw);
    if (wei <= 0n) return 0;
    return Number(wei / 10n ** 16n) / 100;
  } catch {
    return 0;
  }
}

async function fetchTxs(address: string): Promise<TxItem[]> {
  const out: TxItem[] = [];
  let params = new URLSearchParams({ limit: "50" });
  for (let i = 0; i < TX_PAGES; i++) {
    const page = await indexerGet<TxPage>(
      `/api/v2/addresses/${address}/transactions?${params}`
    );
    const items = page?.items ?? [];
    out.push(...items);
    if (!page?.next_page_params) break;
    params = new URLSearchParams(
      Object.entries(page.next_page_params).map(([k, v]) => [k, String(v)])
    );
  }
  return out;
}

function transfersFromTxs(address: string, txs: TxItem[]): BalanceTransfer[] {
  const key = address.toLowerCase();
  const out: BalanceTransfer[] = [];
  for (const tx of txs) {
    const ts = tx.timestamp ? Date.parse(tx.timestamp) : NaN;
    const usd = weiToUsd(tx.value);
    if (!Number.isFinite(ts) || usd <= 0) continue;
    const from = (tx.from?.hash ?? "").toLowerCase();
    const to = (tx.to?.hash ?? "").toLowerCase();
    if (to === key) out.push({ ts, usd, inbound: true });
    else if (from === key) out.push({ ts, usd, inbound: false });
  }
  return out;
}

/**
 * Quality weight for one staker. Fail closed: missing age, $50 hold, or
 * RPC errors → 0. Does not call rescore/conviction (would recurse).
 */
export async function lookupStakerQuality(
  staker: string,
  subjectAddress: string
): Promise<number> {
  const key = staker.toLowerCase();
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) {
    if (key === subjectAddress.toLowerCase()) return 0;
    return hit.weight;
  }

  const isSelf = key === subjectAddress.toLowerCase();
  let weight = 0;
  try {
    const [countHex, balHex, contract, addr, txs] = await Promise.all([
      rpcHex("eth_getTransactionCount", [staker, "latest"]),
      rpcHex("eth_getBalance", [staker, "latest"]),
      isContractAddress(staker),
      indexerGet<AddrInfo>(`/api/v2/addresses/${staker}`),
      fetchTxs(staker),
    ]);

    const createdMs = addr?.created_at ? Date.parse(addr.created_at) : NaN;
    const txTimes = txs
      .map((t) => (t.timestamp ? Date.parse(t.timestamp) : NaN))
      .filter((n) => Number.isFinite(n));
    const firstMs = Number.isFinite(createdMs)
      ? createdMs
      : txTimes.length > 0
        ? Math.min(...txTimes)
        : NaN;
    const walletAgeDays = Number.isFinite(firstMs)
      ? (now - firstMs) / (24 * 60 * 60 * 1000)
      : null;

    const balanceUsd = balHex ? weiToUsd(BigInt(balHex).toString()) : null;
    const holdDays =
      balanceUsd == null
        ? null
        : daysHeldOver50({
            currentBalanceUsd: balanceUsd,
            nowMs: now,
            transfers: transfersFromTxs(staker, txs),
          });

    weight = stakerQualityWeight({
      txCount: hexToInt(countHex),
      isContract: contract.isContract,
      isSelf,
      walletAgeDays,
      balanceUsd,
      daysHeldOver50: holdDays,
    });
  } catch {
    weight = 0;
  }
  cache.set(key, { weight, expiresAt: now + TTL_MS });
  return isSelf ? 0 : weight;
}
