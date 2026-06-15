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

const USE_MOCK = true;

// Real path. A same-origin proxy keeps the oracle IP hidden, matching the
// single-token pattern. Point this at whatever path Nald finalizes for batch.
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
  // Expecting a plain array of BatchScore. If Nald wraps it (for example
  // { results: [...] }), unwrap it here, in this one place, and nothing
  // else has to know.
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
  const results = USE_MOCK
    ? await mockScoreBatch(addresses)
    : await fetchScoreBatch(addresses);
  return applyVerifiedOverlay(results);
}
