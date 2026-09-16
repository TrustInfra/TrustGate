import "server-only";

import { INDEXER_BASE } from "./chain";
import { mapIndexerPath, normalizeIndexerBody } from "./indexer-map";

/**
 * HTTP GET against the Arc indexer. Callers pass Blockscout-style paths
 * (`/api/v2/addresses/...`). Paths are rewritten to Arcscan /v1 and the
 * JSON is normalized. Fail closed: null on any error, never a fake zero.
 */
export async function indexerGet<T>(path: string): Promise<T | null> {
  const mapped = mapIndexerPath(path);
  const url = indexerUrl(path);
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
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
  const mapped = mapIndexerPath(path);
  return `${base}${mapped.startsWith("/") ? mapped : `/${mapped}`}`;
}
