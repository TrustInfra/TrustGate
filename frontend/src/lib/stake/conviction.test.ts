import { describe, expect, it } from "vitest";
import {
  applyConvictionDelta,
  convictionDelta,
  mergeConvictionInputs,
} from "./conviction";

describe("convictionDelta", () => {
  it("lifts score when people back a subject", () => {
    const r = convictionDelta({
      supportUsd: 50,
      challengeUsd: 0,
      supportPeople: 5,
      challengePeople: 0,
    });
    expect(r.delta).toBeGreaterThan(0);
    expect(r.flags).toContain("CONVICTION_POSITIVE");
    expect(r.netPeople).toBe(5);
  });

  it("cuts score when people challenge a subject", () => {
    const r = convictionDelta({
      supportUsd: 0,
      challengeUsd: 40,
      supportPeople: 0,
      challengePeople: 4,
    });
    expect(r.delta).toBeLessThan(0);
    expect(r.flags).toContain("CONVICTION_NEGATIVE");
  });

  it("caps a whale so one wallet cannot buy elite", () => {
    const r = convictionDelta({
      supportUsd: 1_000_000,
      challengeUsd: 0,
      supportPeople: 1,
      challengePeople: 0,
    });
    expect(r.delta).toBeLessThanOrEqual(15);
    expect(r.delta).toBeGreaterThan(0);
  });

  it("marks contested subjects", () => {
    const r = convictionDelta({
      supportUsd: 20,
      challengeUsd: 18,
      supportPeople: 3,
      challengePeople: 2,
    });
    expect(r.flags).toContain("CONVICTION_CONTESTED");
  });

  it("is zero with no stakes", () => {
    const r = convictionDelta({
      supportUsd: 0,
      challengeUsd: 0,
      supportPeople: 0,
      challengePeople: 0,
    });
    expect(r.delta).toBe(0);
    expect(r.flags).toEqual([]);
  });

  it("flags a swarm of low-quality stakers", () => {
    const r = convictionDelta({
      supportUsd: 2,
      challengeUsd: 0,
      supportPeople: 1,
      challengePeople: 0,
      rawStakers: 20,
      qualityMass: 1,
    });
    expect(r.flags).toContain("CONVICTION_SYBIL_STAKE");
  });
});

describe("applyConvictionDelta", () => {
  it("adds and subtracts then clamps", () => {
    expect(applyConvictionDelta(70, 10, 79)).toBe(79);
    expect(applyConvictionDelta(70, -15, 100)).toBe(55);
    expect(applyConvictionDelta(4, -15, 100)).toBe(0);
  });
});

describe("mergeConvictionInputs", () => {
  it("sums identity and claims", () => {
    const m = mergeConvictionInputs([
      { supportUsd: 10, challengeUsd: 1, supportPeople: 2, challengePeople: 1 },
      { supportUsd: 5, challengeUsd: 4, supportPeople: 3, challengePeople: 0 },
    ]);
    expect(m.supportPeople).toBe(5);
    expect(m.challengePeople).toBe(1);
    expect(m.supportUsd).toBe(15);
  });
});
