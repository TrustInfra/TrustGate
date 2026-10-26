/**
 * Map Blockscout-style /api/v2 paths onto Arcscan REST /v1, and normalize
 * JSON so existing scorers keep reading from.hash / timestamp / items.
 */

export function mapIndexerPath(pathAndQuery: string): string {
  const raw = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const url = new URL(raw, "https://indexer.local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const params = url.searchParams;

  const addrTx = path.match(/^\/api\/v2\/addresses\/(0x[0-9a-fA-F]{40})\/transactions$/i);
  if (addrTx) {
    const out = new URLSearchParams();
    const limit = params.get("limit");
    const cursor = params.get("cursor");
    if (limit) out.set("limit", limit);
    if (cursor) out.set("cursor", cursor);
    const q = out.toString();
    return q
      ? `/v1/address/${addrTx[1]}/txs?${q}`
      : `/v1/address/${addrTx[1]}/txs`;
  }

  const addrCounters = path.match(
    /^\/api\/v2\/addresses\/(0x[0-9a-fA-F]{40})\/counters$/i
  );
  if (addrCounters) return `/v1/address/${addrCounters[1]}`;

  const addr = path.match(/^\/api\/v2\/addresses\/(0x[0-9a-fA-F]{40})$/i);
  if (addr) return `/v1/address/${addr[1]}`;

  const tokenHolders = path.match(
    /^\/api\/v2\/tokens\/(0x[0-9a-fA-F]{40})\/holders$/i
  );
  if (tokenHolders) {
    const limit = params.get("limit");
    return limit
      ? `/v1/tokens/${tokenHolders[1]}/holders?limit=${limit}`
      : `/v1/tokens/${tokenHolders[1]}/holders`;
  }

  const tokenTransfers = path.match(
    /^\/api\/v2\/tokens\/(0x[0-9a-fA-F]{40})\/transfers$/i
  );
  if (tokenTransfers) {
    const out = new URLSearchParams();
    const limit = params.get("limit");
    const cursor = params.get("cursor");
    if (limit) out.set("limit", limit);
    if (cursor) out.set("cursor", cursor);
    const q = out.toString();
    return q
      ? `/v1/tokens/${tokenTransfers[1]}/transfers?${q}`
      : `/v1/tokens/${tokenTransfers[1]}/transfers`;
  }

  const token = path.match(/^\/api\/v2\/tokens\/(0x[0-9a-fA-F]{40})$/i);
  if (token) return `/v1/tokens/${token[1]}`;

  if (path.startsWith("/v1/")) return raw;
  return raw;
}

const BLOCKSCOUT_INDEXER_HOSTS = new Set([
  "explorer.arc.io",
  "explorer.testnet.arc.io",
]);

/** True when `base` is Circle's Blockscout and /api/v2 must not be rewritten. */
export function indexerUsesBlockscout(base: string): boolean {
  try {
    const host = new URL(base).hostname.toLowerCase();
    return BLOCKSCOUT_INDEXER_HOSTS.has(host);
  } catch {
    return false;
  }
}

/**
 * Keep a Blockscout /api/v2 path. Holder lists reject `limit`
 * ("Unexpected field: limit"), so that one parameter is dropped.
 * Counters stay on /counters. Other query parameters are left as given.
 */
export function blockscoutIndexerPath(pathAndQuery: string): string {
  const raw = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  let url: URL;
  try {
    url = new URL(raw, "https://indexer.local");
  } catch {
    return raw;
  }
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (!/^\/api\/v2\/tokens\/0x[0-9a-fA-F]{40}\/holders$/i.test(path)) {
    return raw;
  }
  url.searchParams.delete("limit");
  const q = url.searchParams.toString();
  return q ? `${path}?${q}` : path;
}

/** Arcscan bases keep the /v1 map. Blockscout bases pass /api/v2 through. */
export function resolveIndexerPath(base: string, pathAndQuery: string): string {
  if (indexerUsesBlockscout(base)) return blockscoutIndexerPath(pathAndQuery);
  return mapIndexerPath(pathAndQuery);
}

function isoFromUnix(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return new Date(Number(value) * 1000).toISOString();
  }
  if (typeof value === "string") return value;
  return null;
}

/** Arcscan amounts are `{ raw, decimals, formatted }`. Blockscout used a string. */
function amountRaw(node: unknown): string | null {
  if (node == null) return null;
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (typeof node === "object" && "raw" in node) {
    const raw = (node as { raw?: unknown }).raw;
    if (raw == null) return null;
    return String(raw);
  }
  return null;
}

function depthUsdc(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const price = (node as { price?: { depth_usdc?: unknown } }).price;
  const depth = price?.depth_usdc;
  if (depth == null) return null;
  const n = Number(depth);
  return Number.isFinite(n) ? String(n) : null;
}

function party(
  node: unknown
): { hash?: string; is_contract?: boolean } | null {
  if (!node || typeof node !== "object") return null;
  const n = node as {
    address?: string;
    hash?: string;
    is_contract?: boolean | null;
  };
  const hash = n.address ?? n.hash;
  if (!hash) return null;
  return {
    hash,
    is_contract: n.is_contract === true,
  };
}

function pageParams(body: { page?: { next?: string | null; has_more?: boolean } }): {
  next_page_params: Record<string, string> | null;
} {
  const next = body.page?.has_more && body.page.next ? body.page.next : null;
  return { next_page_params: next ? { cursor: next } : null };
}

function normalizeTx(tx: Record<string, unknown>): Record<string, unknown> {
  const method = tx.method as
    | { selector?: string; name?: string; is_creation?: boolean }
    | string
    | null
    | undefined;
  const methodName =
    typeof method === "string" ? method : method?.name ?? null;
  const selector =
    typeof method === "object" && method ? method.selector ?? null : null;
  const isCreation =
    typeof method === "object" && method ? method.is_creation === true : false;
  const to = party(tx.to);
  const created =
    tx.created_contract && typeof tx.created_contract === "object"
      ? party(tx.created_contract)
      : isCreation
        ? { hash: undefined }
        : null;
  const types: string[] = [];
  if (isCreation || created) types.push("contract_creation");
  else if (to?.is_contract) types.push("contract_call");

  const value = amountRaw(tx.value);

  const status = String(tx.status ?? "");
  return {
    ...tx,
    timestamp: isoFromUnix(tx.timestamp),
    from: party(tx.from),
    to,
    created_contract: created,
    method: methodName,
    raw_input: selector,
    input: selector,
    value,
    result: status === "success" ? "success" : status,
    status: status === "success" ? "ok" : status,
    transaction_types: types,
    tx_types: types,
  };
}

export function normalizeIndexerBody(mappedPath: string, body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const path = mappedPath.split("?")[0];

  if (/^\/v1\/address\/0x[0-9a-fA-F]{40}\/txs$/i.test(path)) {
    const b = body as {
      items?: Record<string, unknown>[];
      page?: { next?: string | null; has_more?: boolean };
    };
    return {
      items: (b.items ?? []).map(normalizeTx),
      ...pageParams(b),
    };
  }

  if (/^\/v1\/tokens\/0x[0-9a-fA-F]{40}\/transfers$/i.test(path)) {
    const b = body as {
      items?: Record<string, unknown>[];
      page?: { next?: string | null; has_more?: boolean };
    };
    return {
      items: (b.items ?? []).map((t) => ({
        timestamp: isoFromUnix(t.timestamp),
        from: party(t.from),
        to: party(t.to),
        total: {
          value: amountRaw(t.amount),
        },
        type: "token_transfer",
      })),
      ...pageParams(b),
    };
  }

  if (/^\/v1\/tokens\/0x[0-9a-fA-F]{40}\/holders$/i.test(path)) {
    const b = body as {
      items?: Record<string, unknown>[];
      holder_count?: string | number | null;
      holders?: string | number | null;
      page?: { next?: string | null; has_more?: boolean };
    };
    const count = b.holder_count ?? b.holders ?? null;
    return {
      items: (b.items ?? []).map((h) => {
        const addrNode = h.address;
        const address =
          party(addrNode) ??
          (typeof addrNode === "string" ? { hash: addrNode } : null);
        // Arcscan `value` is a USD quote object. Token balance is `balance.raw`.
        const tokenValue =
          amountRaw(h.balance) ??
          (typeof h.value === "string" || typeof h.value === "number"
            ? String(h.value)
            : null);
        return {
          address,
          value: tokenValue,
          share: h.share,
          liquidity_usd: depthUsdc(h.value),
        };
      }),
      holders: count,
      holders_count: count,
      ...pageParams(b),
    };
  }

  if (/^\/v1\/tokens\/0x[0-9a-fA-F]{40}$/i.test(path)) {
    const b = body as {
      token?: {
        name?: string;
        symbol?: string;
        decimals?: number;
        standard?: string;
      };
      contract?: { verified?: boolean | null } | null;
      total_supply?: { raw?: string } | string | number | null;
      holders?: string | number | null;
      holder_count?: string | number | null;
    };
    const supply = amountRaw(b.total_supply) ?? b.total_supply;
    const holders = b.holders ?? b.holder_count ?? null;
    return {
      name: b.token?.name,
      symbol: b.token?.symbol,
      decimals: b.token?.decimals,
      type: b.token?.standard,
      holders,
      holders_count: holders,
      total_supply: supply,
      exchange_rate: null,
      is_verified: b.contract?.verified === true,
    };
  }

  if (/^\/v1\/address\/0x[0-9a-fA-F]{40}$/i.test(path)) {
    const b = body as {
      address?: string;
      type?: string | null;
      nonce?: number;
      verified?: boolean;
      token?: { type?: string; standard?: string } | null;
      creation?: {
        from?: { address?: string };
        address?: string;
        timestamp?: number | string | null;
      } | null;
      counts?: { txs?: number | null };
      creator_address_hash?: string | null;
      is_contract?: boolean;
    };
    const creator =
      b.creator_address_hash ??
      b.creation?.from?.address ??
      b.creation?.address ??
      null;
    const txCount = b.counts?.txs ?? b.nonce ?? 0;
    const createdAt = isoFromUnix(b.creation?.timestamp ?? null);
    const tokenType =
      b.token?.type ??
      (b.token?.standard
        ? String(b.token.standard).toUpperCase().replace("ERC20", "ERC-20")
        : null);
    const isContract =
      b.is_contract === true ||
      b.type === "contract" ||
      b.token != null ||
      creator != null;
    return {
      ...b,
      hash: b.address,
      creator_address_hash: creator,
      is_verified: b.verified === true,
      is_contract: isContract,
      token_type: tokenType,
      token: b.token ? { ...b.token, type: tokenType } : b.token,
      transactions_count: String(txCount),
      created_at: createdAt,
    };
  }

  return body;
}
