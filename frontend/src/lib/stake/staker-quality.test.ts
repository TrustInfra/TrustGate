import { describe, expect, it } from "vitest";
import {
  daysHeldOver50,
  isSybilStakeCrowd,
  stakerQualityWeight,
} from "./staker-quality";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2026, 8, 16);

const mature = {
  txCount: 400,
  isContract: false,
  isSelf: false,
  walletAgeDays: 200,
  balanceUsd: 600,
  daysHeldOver50: 100,
};

describe("stakerQualityWeight", () => {
  it("zeros self-stake, contracts, and missing proofs", () => {
    expect(stakerQualityWeight({ ...mature, isSelf: true })).toBe(0);
    expect(stakerQualityWeight({ ...mature, isContract: true })).toBe(0);
    expect(stakerQualityWeight({ ...mature, txCount: null })).toBe(0);
    expect(stakerQualityWeight({ ...mature, walletAgeDays: null })).toBe(0);
    expect(stakerQualityWeight({ ...mature, balanceUsd: null })).toBe(0);
    expect(stakerQualityWeight({ ...mature, daysHeldOver50: null })).toBe(0);
  });

  it("scores 1-10 txs at 0.05 even if the rest is strong", () => {
    expect(stakerQualityWeight({ ...mature, txCount: 1 })).toBe(0.05);
    expect(stakerQualityWeight({ ...mature, txCount: 10 })).toBe(0.05);
  });

  it("zeros a funded wallet that is too new or just received $50", () => {
    expect(stakerQualityWeight({ ...mature, walletAgeDays: 3 })).toBe(0);
    expect(stakerQualityWeight({ ...mature, balanceUsd: 49 })).toBe(0);
    expect(stakerQualityWeight({ ...mature, daysHeldOver50: 2 })).toBe(0);
  });

  it("requires age, balance, hold, and txs together", () => {
    expect(stakerQualityWeight(mature)).toBe(1);
    expect(
      stakerQualityWeight({ ...mature, txCount: 80, balanceUsd: 80 })
    ).toBe(0.3);
  });
});

describe("daysHeldOver50", () => {
  it("is 0 below $50 or with no history", () => {
    expect(
      daysHeldOver50({ currentBalanceUsd: 20, nowMs: now, transfers: [] })
    ).toBe(0);
    expect(
      daysHeldOver50({ currentBalanceUsd: 80, nowMs: now, transfers: [] })
    ).toBe(0);
  });

  it("counts from the inbound that pushed the wallet over $50", () => {
    const days = daysHeldOver50({
      currentBalanceUsd: 80,
      nowMs: now,
      transfers: [{ ts: now - 40 * DAY, usd: 80, inbound: true }],
    });
    expect(days).toBeCloseTo(40, 5);
  });

  it("resets the streak if the wallet dipped below $50", () => {
    const days = daysHeldOver50({
      currentBalanceUsd: 90,
      nowMs: now,
      transfers: [
        { ts: now - 1 * DAY, usd: 80, inbound: true },
        { ts: now - 10 * DAY, usd: 70, inbound: false },
        { ts: now - 40 * DAY, usd: 80, inbound: true },
      ],
    });
    expect(days).toBeCloseTo(1, 5);
  });
});

describe("isSybilStakeCrowd", () => {
  it("flags many empty wallets and ignores a few real ones", () => {
    expect(isSybilStakeCrowd(20, 20 * 0.05)).toBe(true);
    expect(isSybilStakeCrowd(3, 0)).toBe(false);
    expect(isSybilStakeCrowd(8, 8 * 0.8)).toBe(false);
  });
});
