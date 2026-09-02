import type { BatchScore } from "./types";

// Fixture BatchScore results for local dev when NEXT_PUBLIC_DISCOVERY_MOCK=1.
// Live scoring goes through client.ts to POST /api/batch. This file is never
// the production path.

// Fixed profiles we map addresses onto. Deterministic: the same address
// always gets the same mock result within a session, so the demo is stable.
// Covers every tier, a spread of flags, and both token states.
const PROFILES: Omit<BatchScore, "address">[] = [
  { score: 88, tier: "ELITE", confidence: "high", flags: [], state: "graduated" },
  { score: 71, tier: "HIGH", confidence: 82, flags: [], state: "graduated" },
  {
    score: 54,
    tier: "MEDIUM",
    confidence: "low",
    flags: ["LOW_HOLDER_QUALITY"],
    state: "graduated",
  },
  {
    score: 33,
    tier: "LOW",
    confidence: "low",
    flags: ["COORDINATED_BUY"],
    state: "graduated",
  },
  {
    score: 9,
    tier: "BLOCKED",
    confidence: "low",
    flags: ["HONEYPOT_PATTERN", "EXIT_SYNC"],
    state: "graduated",
  },
  // Mining-phase entries. There is no liquidity pool yet, so score and tier
  // here represent the DEPLOYER wallet's trust, not a token score. The
  // mining display treatment (Step 5) labels this honestly.
  { score: 64, tier: "HIGH", confidence: "medium", flags: [], state: "mining" },
  {
    score: 28,
    tier: "LOW",
    confidence: "low",
    flags: ["LOW_HOLDER_QUALITY"],
    state: "mining",
  },
];

function hashAddress(address: string): number {
  let h = 0;
  const a = address.toLowerCase();
  for (let i = 0; i < a.length; i++) {
    h = (h * 31 + a.charCodeAt(i)) >>> 0;
  }
  return h;
}

export async function mockScoreBatch(addresses: string[]): Promise<BatchScore[]> {
  // Small simulated latency so loading states get exercised in the demo.
  await new Promise((r) => setTimeout(r, 250));
  return addresses.map((address) => {
    const profile = PROFILES[hashAddress(address) % PROFILES.length];
    return { address, ...profile };
  });
}
