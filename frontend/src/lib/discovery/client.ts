import type { BatchScore } from "./types";
import { mockScoreBatch } from "./mock";
import { isVerifiedIssuer } from "./verified-issuers";

// ============================================================================
// scoreBatch is the ONLY thing the rest of the frontend calls. Badges, flags,
// the reorder helper, the demo surface: all of them go through here.
//
// THE ONE LINE TO CHANGE when Nald's batch endpoint goes live:
//   set USE_MOCK = false
// The real request lives in fetchScoreBatch below, already wired to the
// agreed shape. Nothing downstream changes.
// ============================================================================

// Live batch via /api/batch (Phase 2b). Mock is fallback only if live fails
// and NEXT_PUBLIC_DISCOVERY_MOCK=1, or when explicitly forced.
const FORCE_MOCK = process.env.NEXT_PUBLIC_DISCOVERY_MOCK === "1";
const BATCH_ENDPOINT = "/api/batch";

async function fetchScoreBatch(addresses: string[]): Promise<BatchScore[]> {
  const res = await fetch(BATCH_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addresses }),
  });

  if (!res.ok) {
    throw new Error(`Batch scoring failed: ${res.status}`);
  }

  const data = await res.json();
  // Expecting a plain array of BatchScore. If wrapped as { results: [...] },
  // unwrap here once.
  return Array.isArray(data) ? data : data.results;
}

// VERIFIED overlay for Circle-issued tokens. These short-circuit to VERIFIED
// on the frontend exactly like the single-token path. The check lives in a
// client-safe module (verified-issuers.ts) because contract-scoring.ts is
// server-only and cannot be imported into this client code.
function applyVerifiedOverlay(results: BatchScore[]): BatchScore[] {
  return results.map((r) =>
    isVerifiedIssuer(r.address) ? { ...r, tier: "VERIFIED", flags: [] } : r
  );
}

export async function scoreBatch(addresses: string[]): Promise<BatchScore[]> {
  if (addresses.length === 0) return [];
  if (FORCE_MOCK) {
    return applyVerifiedOverlay(await mockScoreBatch(addresses));
  }
  try {
    const results = await fetchScoreBatch(addresses);
    return applyVerifiedOverlay(results);
  } catch (err) {
    console.warn(
      "[discovery] live batch failed, falling back to mock:",
      err instanceof Error ? err.message : err
    );
    return applyVerifiedOverlay(await mockScoreBatch(addresses));
  }
}
