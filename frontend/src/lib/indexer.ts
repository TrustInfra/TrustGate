import "server-only";

import { INDEXER_BASE } from "./chain";
import { normalizeIndexerBody, resolveIndexerPath } from "./indexer-map";

/**
 * Sent on every indexer fetch. explorer.arc.io answers 403 to the
 * default Node and axios user agent and 200 to this one.
 */
const INDEXER_USER_AGENT = "Mozilla/5.0 (compatible; TrustGateOracle/2)";

/**
 * HTTP GET against the Arc indexer. Callers pass Blockscout-style paths
 * (`/api/v2/addresses/...`). explorer.arc.io is fetched as /api/v2.
 * Any other base still uses the Arcscan /v1 map, and that JSON is
 * normalized. Fail closed: null on any error, never a fake zero.
 */
export async function indexerGet<T>(path: string): Promise<T | null> {
  const mapped = resolveIndexerPath(INDEXER_BASE, path);
  const url = indexerUrl(path);
  try {
    const res = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": INDEXER_USER_AGENT,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return normalizeIndexerBody(mapped, body) as T;
  } catch {
    return null;
  }
}

export function indexerUrl(path: string): string {
  const base = INDEXER_BASE.replace(/\/+$/, "");
  const mapped = resolveIndexerPath(base, path);
  return `${base}${mapped.startsWith("/") ? mapped : `/${mapped}`}`;
}
