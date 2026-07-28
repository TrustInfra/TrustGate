import { describe, expect, it } from "vitest";
import {
  EXAMPLE_LENDING_LADDER,
  evaluateLadder,
} from "./ladder";
import { hashFlags, defaultTtlSeconds } from "./eip712";

describe("protocol ladder (illustrative)", () => {
  it("rejects amount above band for score 48", () => {
    const r = evaluateLadder(48, EXAMPLE_LENDING_LADDER, {
      requestedAmount: 500_000,
      capability: "borrow",
      confidence: 80,
    });
    expect(r.allowed).toBe(false);
    expect(r.policyOwner).toBe("protocol");
    expect(r.reasons.join(" ")).toMatch(/exceeds/i);
  });

  it("allows 15k at score 48", () => {
    const r = evaluateLadder(48, EXAMPLE_LENDING_LADDER, {
      requestedAmount: 15_000,
      capability: "borrow",
      confidence: 80,
    });
    expect(r.allowed).toBe(true);
    expect(r.matchedBand?.maxAmount).toBe(20_000);
  });

  it("allows 100k band at score 55", () => {
    const r = evaluateLadder(55, EXAMPLE_LENDING_LADDER, {
      requestedAmount: 80_000,
      capability: "borrow",
      confidence: 70,
    });
    expect(r.allowed).toBe(true);
    expect(r.matchedBand?.maxAmount).toBe(100_000);
  });

  it("fails closed on low confidence when protocol requires it", () => {
    const r = evaluateLadder(70, EXAMPLE_LENDING_LADDER, {
      requestedAmount: 10_000,
      capability: "borrow",
      confidence: 10,
    });
    expect(r.allowed).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/confidence/i);
  });

  it("fails closed with empty bands", () => {
    const r = evaluateLadder(80, {
      protocolId: "x",
      bands: [],
    });
    expect(r.allowed).toBe(false);
  });
});

describe("attestation helpers", () => {
  it("hashes flags stably", () => {
    const a = hashFlags(["EXIT_SYNC", "WASH_TRADING"]);
    const b = hashFlags(["WASH_TRADING", "EXIT_SYNC"]);
    expect(a).toBe(b);
  });

  it("financial TTL shorter than allowlist", () => {
    expect(defaultTtlSeconds("financial_high")).toBeLessThan(
      defaultTtlSeconds("allowlist")
    );
  });
});
