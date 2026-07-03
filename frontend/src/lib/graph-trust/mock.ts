import { buildExplainer } from "./map-result";
import type {
  GraphRelationship,
  GraphResultType,
  GraphTrust,
  GraphTier,
  GraphTrustState,
} from "./types";

const MOCK_LATENCY_MS = 420;

function hashAddress(address: string): number {
  const normalized = address.toLowerCase();
  let h = 5381;
  for (let i = 2; i < normalized.length; i++) {
    h = ((h << 5) + h + normalized.charCodeAt(i)) >>> 0;
  }
  return h;
}

function maskEntity(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function buildRelationships(seed: number, count: number): GraphRelationship[] {
  const relations = [
    "endorsed by",
    "attested by",
    "trusted by",
    "vouched for by",
  ];
  const out: GraphRelationship[] = [];
  for (let i = 0; i < count; i++) {
    const slot = (seed + i * 17) % 0xffff;
    const entity = `0x${slot.toString(16).padStart(4, "0")}${"a".repeat(36)}`.slice(0, 42);
    out.push({
      entity: maskEntity(entity),
      relation: relations[(seed + i) % relations.length],
    });
  }
  return out;
}

interface Scenario {
  state: GraphTrustState;
  tier: GraphTier;
  score: number;
  attestations: number;
  endorsements: number;
  connected: number;
  relationships?: number;
}

function scenarioForBucket(bucket: number): Scenario {
  switch (bucket) {
    case 0:
      return {
        state: "not_found",
        tier: "UNKNOWN",
        score: 0,
        attestations: 0,
        endorsements: 0,
        connected: 0,
      };
    case 1:
      return {
        state: "sparse",
        tier: "UNKNOWN",
        score: 0,
        attestations: 1,
        endorsements: 0,
        connected: 2,
      };
    case 2:
      return {
        state: "sparse",
        tier: "LOW",
        score: 28,
        attestations: 3,
        endorsements: 1,
        connected: 5,
      };
    case 3:
      return {
        state: "indexed",
        tier: "LOW",
        score: 34,
        attestations: 8,
        endorsements: 2,
        connected: 11,
        relationships: 2,
      };
    case 4:
      return {
        state: "indexed",
        tier: "MEDIUM",
        score: 58,
        attestations: 24,
        endorsements: 9,
        connected: 31,
        relationships: 3,
      };
    case 5:
      return {
        state: "indexed",
        tier: "HIGH",
        score: 81,
        attestations: 67,
        endorsements: 28,
        connected: 94,
        relationships: 4,
      };
    case 6:
      return {
        state: "sparse",
        tier: "MEDIUM",
        score: 52,
        attestations: 6,
        endorsements: 3,
        connected: 14,
        relationships: 2,
      };
    default:
      return {
        state: "indexed",
        tier: "HIGH",
        score: 76,
        attestations: 41,
        endorsements: 16,
        connected: 58,
        relationships: 3,
      };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockGetGraphTrust(address: string): Promise<GraphTrust> {
  await delay(MOCK_LATENCY_MS);

  if (address.toLowerCase().endsWith("dead")) {
    throw new Error("Graph trust service unavailable");
  }

  const h = hashAddress(address);
  const scenario = scenarioForBucket(h % 7);

  const topRelationships =
    scenario.relationships && scenario.relationships > 0
      ? buildRelationships(h, scenario.relationships)
      : undefined;

  const resultType: GraphResultType =
    scenario.state === "not_found" ? "not_found" : "path";

  const pathTrust =
    resultType === "path"
      ? {
          score: scenario.score,
          pathCount: scenario.attestations,
          sources: topRelationships?.map((r) => r.entity) ?? [],
        }
      : null;

  const explainer = buildExplainer(
    resultType,
    scenario.score,
    scenario.tier,
    pathTrust,
    null
  );

  return {
    address,
    graphScore: scenario.score,
    graphTier: scenario.tier,
    attestationCount: scenario.attestations,
    endorsements: scenario.endorsements,
    connectedEntities: scenario.connected,
    topRelationships,
    state: scenario.state,
    pathTrust,
    globalStanding: null,
    resultType,
    explainer,
  };
}