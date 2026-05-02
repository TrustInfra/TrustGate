import { NextResponse } from "next/server";

const ARCSCAN_API = "https://testnet.arcscan.app/api/v2";

const CONTRACTS: readonly string[] = [
  "0x52E17bC482d00776d73811680CbA9914e83E33CC",
  "0x73d3cf7f2734C334927f991fe87D06d595d398b4",
  "0xEb979Dc25396ba4be6cEA41EAfEa894C55772246",
] as const;

const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_PAGES_PER_CONTRACT = 200;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface StatsCacheEntry {
  total_transactions: number | null;
  unique_callers: number | null;
  countersAt: number | null;
  callersAt: number | null;
}

interface StatsResponse {
  total_transactions: number;
  unique_callers: number | null;
}

let cache: StatsCacheEntry | null = null;
let countersInflight: Promise<number> | null = null;
let callersInflight: Promise<number> | null = null;

interface CountersResponse {
  transactions_count?: string;
}

interface AddressTx {
  from?: { hash?: string } | null;
}

interface AddressTxPage {
  items?: AddressTx[];
  next_page_params?: Record<string, string | number> | null;
}

async function fetchCount(address: string): Promise<number> {
  const res = await fetch(`${ARCSCAN_API}/addresses/${address}/counters`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`counters ${address} HTTP ${res.status}`);
  }
  const data = (await res.json()) as CountersResponse;
  const parsed = parseInt(data.transactions_count ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function collectCallers(
  address: string,
  acc: Set<string>
): Promise<void> {
  const contractLower = address.toLowerCase();
  let nextParams: URLSearchParams | null = new URLSearchParams();
  let page = 0;

  while (nextParams && page < MAX_PAGES_PER_CONTRACT) {
    const qs = nextParams.toString();
    const url = qs
      ? `${ARCSCAN_API}/addresses/${address}/transactions?${qs}`
      : `${ARCSCAN_API}/addresses/${address}/transactions`;

    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(
        `transactions ${address} page ${page + 1} HTTP ${res.status}`
      );
    }

    const data = (await res.json()) as AddressTxPage;
    const items = data.items ?? [];

    for (const tx of items) {
      const from = tx.from?.hash?.toLowerCase();
      if (from && from !== contractLower) {
        acc.add(from);
      }
    }

    if (data.next_page_params) {
      const next = new URLSearchParams();
      for (const [k, v] of Object.entries(data.next_page_params)) {
        next.set(k, String(v));
      }
      nextParams = next;
      page += 1;
    } else {
      nextParams = null;
    }
  }
}

function ensureCacheEntry(): StatsCacheEntry {
  if (!cache) {
    cache = {
      total_transactions: null,
      unique_callers: null,
      countersAt: null,
      callersAt: null,
    };
  }
  return cache;
}

function computeCounters(): Promise<number> {
  if (countersInflight) return countersInflight;
  countersInflight = (async () => {
    try {
      const counts = await Promise.all(CONTRACTS.map(fetchCount));
      const total = counts.reduce((sum, n) => sum + n, 0);
      const entry = ensureCacheEntry();
      entry.total_transactions = total;
      entry.countersAt = Date.now();
      return total;
    } finally {
      countersInflight = null;
    }
  })();
  return countersInflight;
}

function computeCallers(): Promise<number> {
  if (callersInflight) return callersInflight;
  callersInflight = (async () => {
    try {
      const callers = new Set<string>();
      await Promise.all(CONTRACTS.map((c) => collectCallers(c, callers)));
      const entry = ensureCacheEntry();
      entry.unique_callers = callers.size;
      entry.callersAt = Date.now();
      return callers.size;
    } finally {
      callersInflight = null;
    }
  })();
  return callersInflight;
}

function refreshCallersInBackground(): void {
  if (callersInflight) return;
  void computeCallers().catch((err) => {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[stats] callers refresh failed:", message);
  });
}

function refreshCountersInBackground(): void {
  if (countersInflight) return;
  void computeCounters().catch((err) => {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[stats] counters refresh failed:", message);
  });
}

function isFresh(at: number | null, now: number): boolean {
  return at !== null && now - at < CACHE_TTL_MS;
}

export async function GET() {
  const now = Date.now();

  if (cache && cache.total_transactions !== null) {
    if (!isFresh(cache.countersAt, now)) {
      refreshCountersInBackground();
    }
    if (cache.unique_callers === null || !isFresh(cache.callersAt, now)) {
      refreshCallersInBackground();
    }
    const payload: StatsResponse = {
      total_transactions: cache.total_transactions,
      unique_callers: cache.unique_callers,
    };
    return NextResponse.json(payload);
  }

  try {
    const total = await computeCounters();
    refreshCallersInBackground();
    const payload: StatsResponse = {
      total_transactions: total,
      unique_callers: cache?.unique_callers ?? null,
    };
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[stats] counters failed:", message);
    return NextResponse.json(
      { error: "stats fetch failed" },
      { status: 502 }
    );
  }
}
