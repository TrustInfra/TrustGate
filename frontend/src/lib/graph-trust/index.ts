import type { GraphTrust } from "./types";
import { mockGetGraphTrust } from "./mock";

// Set true to use local mock data during development.
export const USE_MOCK = false;

export type {
  GraphTrust,
  GraphTier,
  GraphTrustState,
  GraphRelationship,
  GraphResultType,
  PathTrust,
  GlobalStanding,
} from "./types";

export async function getGraphTrust(address: string): Promise<GraphTrust> {
  if (USE_MOCK) {
    return mockGetGraphTrust(address);
  }

  const res = await fetch(
    `/api/graph-trust?address=${encodeURIComponent(address)}`,
    { cache: "no-store" }
  );

  let payload: GraphTrust & { error?: string };
  try {
    payload = (await res.json()) as GraphTrust & { error?: string };
  } catch {
    throw new Error(`Graph trust API returned non-JSON (status ${res.status})`);
  }

  if (!res.ok) {
    throw new Error(payload.error ?? `Graph trust request failed (${res.status})`);
  }

  return payload;
}