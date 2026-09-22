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

  const value =
    tx.value && typeof tx.value === "object"
      ? (tx.value as { raw?: string }).raw
      : tx.value;

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
          value:
            t.amount && typeof t.amount === "object"
              ? (t.amount as { raw?: string }).raw
              : t.amount,
        },
        type: "token_transfer",
      })),
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
      total_supply?: { raw?: string } | string | number | null;
      holders?: string | number | null;
    };
    const supply =
      b.total_supply && typeof b.total_supply === "object"
        ? b.total_supply.raw
        : b.total_supply;
    return {
      name: b.token?.name,
      symbol: b.token?.symbol,
      decimals: b.token?.decimals,
      type: b.token?.standard,
      holders: b.holders,
      holders_count: b.holders,
      total_supply: supply,
      exchange_rate: null,
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
