import { describe, expect, it } from "vitest";
import {
  applyTemporalScoreDelta,
  classifyPostDistributionVolume,
  countBidirectionalWashPairs,
  isWashWallet,
  readTemporalScoreWeight,
} from "./heuristics";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

describe("applyTemporalScoreDelta", () => {
  it("zeros contribution when weight is 0", () => {
    expect(applyTemporalScoreDelta(-25, 0)).toBe(0);
  });

  it("passes through at weight 1", () => {
    expect(applyTemporalScoreDelta(-12, 1)).toBe(-12);
  });

  it("treats non-finite weight as 0", () => {
    expect(applyTemporalScoreDelta(-25, Number.NaN)).toBe(0);
    expect(applyTemporalScoreDelta(-25, Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("readTemporalScoreWeight", () => {
  it("defaults to 0", () => {
    expect(readTemporalScoreWeight({})).toBe(0);
  });

  it("rejects garbage env", () => {
    expect(readTemporalScoreWeight({ SCORING_TEMPORAL_SCORE_WEIGHT: "nope" })).toBe(
      0
    );
  });

  it("reads a finite multiplier", () => {
    expect(readTemporalScoreWeight({ SCORING_TEMPORAL_SCORE_WEIGHT: "1" })).toBe(
      1
    );
  });
});

describe("classifyPostDistributionVolume", () => {
  it("treats primary-distributor outflow as buy, not sell (honeypot-shaped)", () => {
    const deployer = "0xd";
    const buyers = ["0xa", "0xb", "0xc"];
    const transfers = [
      { from: "0x0", to: deployer, amount: 1000, ts: T0 },
      ...buyers.map((to, i) => ({
        from: deployer,
        to,
        amount: 100,
        ts: T0 + 3 * DAY + i * 1000,
      })),
    ];
    const v = classifyPostDistributionVolume(transfers, 2 * DAY);
    expect(v.buyVolume).toBe(300);
    expect(v.sellVolume).toBe(0);
  });

  it("counts early-holder exits as sell", () => {
    const deployer = "0xd";
    const holder = "0xh";
    const late = "0xl";
    const transfers = [
      { from: "0x0", to: deployer, amount: 1000, ts: T0 },
      { from: deployer, to: holder, amount: 200, ts: T0 + 1000 },
      { from: holder, to: late, amount: 180, ts: T0 + 3 * DAY },
    ];
    const v = classifyPostDistributionVolume(transfers, 2 * DAY);
    expect(v.buyVolume).toBe(180);
    expect(v.sellVolume).toBe(180);
  });

  it("does not treat a zero post-dist buy as missing", () => {
    const transfers = [
      { from: "0x0", to: "0xd", amount: 100, ts: T0 },
      { from: "0xd", to: "0xa", amount: 50, ts: T0 + 1000 },
    ];
    const v = classifyPostDistributionVolume(transfers, 2 * DAY);
    expect(v.buyVolume).toBe(0);
    expect(v.sellVolume).toBe(0);
  });
});

describe("countBidirectionalWashPairs", () => {
  it("ignores one-way router flow", () => {
    const transfers = Array.from({ length: 20 }, (_, i) => ({
      from: "0xtrader",
      to: "0xrouter",
      amount: 1,
      ts: T0 + i,
    }));
    expect(countBidirectionalWashPairs(transfers)).toBe(0);
  });

  it("flags A↔B repeated both ways", () => {
    const transfers = [
      { from: "0xa", to: "0xb" },
      { from: "0xa", to: "0xb" },
      { from: "0xb", to: "0xa" },
      { from: "0xb", to: "0xa" },
    ];
    expect(countBidirectionalWashPairs(transfers)).toBe(1);
  });
});

describe("isWashWallet", () => {
  it("rejects directional traders", () => {
    expect(
      isWashWallet({ buyCount: 5, sellCount: 3, bought: 1000, sold: 50 })
    ).toBe(false);
  });

  it("flags balanced round-trips", () => {
    expect(
      isWashWallet({ buyCount: 4, sellCount: 4, bought: 100, sold: 95 })
    ).toBe(true);
  });
});
