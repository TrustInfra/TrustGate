import { describe, expect, it } from "vitest";
import {
  aggregateStakingScore,
  computeStakePoints,
  durationMultiplier,
  sizeMultiplier,
  tokenTrustMultiplier,
} from "./formula";
import {
  computeTrustSurfaceArea,
  meetsThreshold,
  resolveThreshold,
} from "../protocol-guard/thresholds";
import {
  buildPublicExplain,
  buildProtocolExplain,
} from "../trust-intelligence/explainability";

describe("staking formula", () => {
  it("enforces 7-day minimum", () => {
    const p = computeStakePoints({
      durationDays: 3,
      sizeUsd: 500,
      tokenTier: "HIGH",
      isSelfStake: false,
      resetByMisbehavior: false,
    });
    expect(p.awardedPoints).toBe(0);
    expect(p.voidReason).toBe("below_7_day_minimum");
  });

  it("voids self-stake", () => {
    const p = computeStakePoints({
      durationDays: 100,
      sizeUsd: 5000,
      tokenTier: "HIGH_ELITE",
      isSelfStake: true,
      resetByMisbehavior: false,
    });
    expect(p.awardedPoints).toBe(0);
    expect(p.voidReason).toBe("self_staking");
  });

  it("voids blocked token", () => {
    const p = computeStakePoints({
      durationDays: 100,
      sizeUsd: 5000,
      tokenTier: "BLOCKED",
      isSelfStake: false,
      resetByMisbehavior: false,
    });
    expect(p.awardedPoints).toBe(0);
  });

  it("applies duration x size x token trust", () => {
    // 100 days → 3x, $500 → 1.5x, HIGH → 1.2x → 10*3*1.5*1.2 = 54
    const p = computeStakePoints({
      durationDays: 100,
      sizeUsd: 500,
      tokenTier: "HIGH",
      isSelfStake: false,
      resetByMisbehavior: false,
    });
    expect(p.durationMultiplier).toBe(3);
    expect(p.sizeMultiplier).toBe(1.5);
    expect(p.tokenTrustMultiplier).toBe(1.2);
    expect(p.awardedPoints).toBe(54);
  });

  it("caps size multiplier at 2.5", () => {
    expect(sizeMultiplier(100_000)).toBe(2.5);
  });

  it("duration bands", () => {
    expect(durationMultiplier(6)).toBe(0);
    expect(durationMultiplier(7)).toBe(1);
    expect(durationMultiplier(45)).toBe(2);
    expect(durationMultiplier(120)).toBe(3);
    expect(durationMultiplier(200)).toBe(4);
  });

  it("token trust mult", () => {
    expect(tokenTrustMultiplier("HIGH_ELITE")).toBe(1.5);
    expect(tokenTrustMultiplier("LOW")).toBe(0.5);
  });

  it("resets on misbehavior", () => {
    const p = computeStakePoints({
      durationDays: 200,
      sizeUsd: 5000,
      tokenTier: "HIGH",
      isSelfStake: false,
      resetByMisbehavior: true,
    });
    expect(p.awardedPoints).toBe(0);
    expect(p.voidReason).toBe("stake_age_reset_misbehavior");
  });

  it("aggregates with diversity and decay", () => {
    const agg = aggregateStakingScore({
      positions: [
        {
          durationDays: 100,
          sizeUsd: 500,
          tokenTier: "HIGH",
          isSelfStake: false,
          resetByMisbehavior: false,
        },
      ],
      uniqueProtocols: 3,
      activeSpanDays: 400,
      daysSinceLastStake: 60,
    });
    expect(agg.diversityBonusApplied).toBe(true);
    expect(agg.consistencyBonusApplied).toBe(true);
    expect(agg.decayFactor).toBeLessThan(1);
    expect(agg.committedScore).toBeGreaterThan(0);
  });
});

describe("contextual thresholds + TSA", () => {
  it("borrow requires HIGH band", () => {
    const t = resolveThreshold("borrow");
    expect(t.minScore).toBe(60);
    const low = meetsThreshold(30, "LOW", 80, t);
    expect(low.ok).toBe(false);
    const high = meetsThreshold(70, "HIGH", 60, t);
    expect(high.ok).toBe(true);
  });

  it("treasury requires elite", () => {
    const t = resolveThreshold("treasury_control");
    const high = meetsThreshold(70, "HIGH", 80, t);
    expect(high.ok).toBe(false);
  });

  it("dex swap permits any", () => {
    const t = resolveThreshold("dex_swap");
    expect(meetsThreshold(5, "LOW", 10, t).ok).toBe(true);
  });

  it("trust surface area prioritizes low trust + high reach", () => {
    const low = computeTrustSurfaceArea({
      score: 15,
      tier: "LOW",
      economicReachUsd: 1_000_000,
      coordinationScore: 0.9,
      capitalAccess: 0.8,
    });
    const high = computeTrustSurfaceArea({
      score: 90,
      tier: "HIGH_ELITE",
      economicReachUsd: 100,
      coordinationScore: 0,
      capitalAccess: 0.1,
    });
    expect(low.surfaceArea).toBeGreaterThan(high.surfaceArea);
    expect(low.priority).not.toBe("monitor");
  });
});

describe("two-tier explainability", () => {
  it("public is short and plain", () => {
    const p = buildPublicExplain({
      score: 20,
      tier: "LOW",
      confidence: 30,
      flags: ["EXIT_SYNC", "HONEYPOT_PATTERN"],
    });
    expect(p.headline.toLowerCase()).toMatch(/low|risk/);
    expect(p.lines.length).toBeGreaterThan(0);
    expect(p.lines.length).toBeLessThanOrEqual(4);
  });

  it("protocol is structured", () => {
    const p = buildProtocolExplain({
      score: 55,
      tier: "MEDIUM",
      confidence: 70,
      flags: ["WASH_TRADING", "STAKING_COMMITTED", "COORDINATED_BUY"],
      limitations: ["Sparse onchain activity"],
    });
    expect(p.confidence).toBe(70);
    expect(p.temporalSignals.length).toBeGreaterThan(0);
    expect(p.riskCategories.length).toBeGreaterThan(0);
  });
});
