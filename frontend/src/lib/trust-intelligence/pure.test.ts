import { describe, expect, it } from "vitest";
import {
  computeStability,
  confidenceEnumToNumber,
  directionDrivers,
} from "./pure";
import { buildSummary } from "./summary";
import { detectCoordinatedVoting } from "../protocol-guard/coordination";
import { reorderByTrust } from "../discovery/reorder";
import { rankGroupsByTrust } from "../discovery/group-rank";
import type { BatchScore } from "../discovery/types";

describe("computeStability", () => {
  it("returns insufficient_history for a single point", () => {
    expect(computeStability([50])).toBe("insufficient_history");
  });

  it("detects improving trend", () => {
    expect(computeStability([40, 45, 50, 55, 60, 70])).toBe("improving");
  });

  it("detects deteriorating trend", () => {
    expect(computeStability([70, 65, 60, 55, 50, 40])).toBe("deteriorating");
  });

  it("detects stable band", () => {
    expect(computeStability([50, 51, 49, 50, 52, 50])).toBe("stable");
  });
});

describe("confidenceEnumToNumber", () => {
  it("maps enums and clamps numbers", () => {
    expect(confidenceEnumToNumber("HIGH")).toBe(88);
    expect(confidenceEnumToNumber("LOW")).toBe(32);
    expect(confidenceEnumToNumber(150)).toBe(100);
    expect(confidenceEnumToNumber(-5)).toBe(0);
  });
});

describe("buildSummary", () => {
  it("includes confidence language and caps length", () => {
    const s = buildSummary({
      subject: "0xabc",
      subjectType: "wallet",
      score: 72,
      tier: "HIGH",
      confidence: 90,
      flags: ["EXIT_SYNC", "WASH_TRADING"],
      scoringVersion: "v1.0",
    });
    expect(s.length).toBeGreaterThan(0);
    expect(s.length).toBeLessThanOrEqual(5);
  });
});

describe("directionDrivers", () => {
  it("returns trend driver", () => {
    const d = directionDrivers("improving", ["STAKING_COMMITTED"]);
    expect(d[0]).toMatch(/upward/i);
  });
});

describe("detectCoordinatedVoting", () => {
  it("flags low-trust clusters", () => {
    const voters = Array.from({ length: 6 }, (_, i) => ({
      wallet: `0x${i}`,
      score: 20,
      tier: "LOW",
    }));
    const r = detectCoordinatedVoting(voters, 5);
    expect(r.coordinated).toBe(true);
  });
});

describe("reorder and group rank", () => {
  const scores: BatchScore[] = [
    {
      address: "0x1",
      score: 10,
      tier: "BLOCKED",
      confidence: 50,
      flags: ["HONEYPOT_PATTERN"],
      state: "graduated",
    },
    {
      address: "0x2",
      score: 80,
      tier: "ELITE",
      confidence: 90,
      flags: [],
      state: "graduated",
    },
    {
      address: "0x3",
      score: 40,
      tier: "MEDIUM",
      confidence: 40,
      flags: [],
      state: "graduated",
    },
  ];

  it("sinks blocked to bottom", () => {
    const items = [
      { address: "0x1", symbol: "Y" },
      { address: "0x2", symbol: "Y" },
      { address: "0x3", symbol: "Y" },
    ];
    const ordered = reorderByTrust(items, (i) => i.address, scores);
    expect(ordered[0].address).toBe("0x2");
    expect(ordered[ordered.length - 1].address).toBe("0x1");
  });

  it("ranks within ticker groups", () => {
    const items = [
      { address: "0x1", symbol: "YOSHI" },
      { address: "0x2", symbol: "YOSHI" },
      { address: "0xa", symbol: "PEPE" },
    ];
    const map: Record<string, BatchScore> = {
      "0x1": scores[0],
      "0x2": scores[1],
      "0xa": {
        address: "0xa",
        score: 5,
        tier: "LOW",
        confidence: 20,
        flags: [],
        state: "graduated",
      },
    };
    const ordered = rankGroupsByTrust(
      items,
      (i) => i.address,
      (i) => i.symbol,
      map
    );
    expect(ordered[0].address).toBe("0x2");
    expect(ordered[1].address).toBe("0x1");
    expect(ordered[2].symbol).toBe("PEPE");
  });
});
