import type { BatchScore } from "./types";
import { mockScoreBatch } from "./mock";
import { isVerifiedIssuer } from "./verified-issuers";

// ============================================================================
// scoreBatch is the ONLY thing the rest of the frontend calls. Badges, flags,
// the reorder helper, the demo surface: all of them go through here.
//
// Live batch via /api/batch. Mock is used only when
// NEXT_PUBLIC_DISCOVERY_MOCK=1. Live failures are not replaced with fixture
// scores — that would paint fake tiers onto real contracts.
// ============================================================================

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
  const results = await fetchScoreBatch(addresses);
  return applyVerifiedOverlay(results);
}
