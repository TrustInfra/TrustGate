import { describe, expect, it } from "vitest";
import {
  EXAMPLE_LENDING_LADDER,
  evaluateLadder,
} from "./ladder";
import {
  hashFlags,
  defaultTtlSeconds,
  clampAttestationTtl,
  MAX_ATTESTATION_TTL_SECONDS,
  MIN_ATTESTATION_TTL_SECONDS,
} from "./eip712";
import { computeGatingAllowed } from "./decide";

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

  it("fails closed when band maxAmount is 0 even if amount is omitted", () => {
    const r = evaluateLadder(10, EXAMPLE_LENDING_LADDER, {
      capability: "borrow",
      confidence: 80,
    });
    expect(r.allowed).toBe(false);
    expect(r.matchedBand?.maxAmount).toBe(0);
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

  it("clamps attacker-controlled ttlSeconds", () => {
    expect(clampAttestationTtl(10 ** 12, "financial_high")).toBe(
      MAX_ATTESTATION_TTL_SECONDS
    );
    expect(clampAttestationTtl(1, "financial_high")).toBe(
      MIN_ATTESTATION_TTL_SECONDS
    );
    expect(clampAttestationTtl(undefined, "financial_high")).toBe(
      defaultTtlSeconds("financial_high")
    );
    expect(clampAttestationTtl(Number.NaN, "allowlist")).toBe(
      defaultTtlSeconds("allowlist")
    );
  });
});

describe("gating allow decision", () => {
  it("fails closed when attestation is invalid even if ladder allows", () => {
    expect(
      computeGatingAllowed({
        walletAllowed: true,
        attestationValid: false,
        scoringVersionAllowed: true,
      })
    ).toBe(false);
  });

  it("fails closed when token ladder rejects", () => {
    expect(
      computeGatingAllowed({
        walletAllowed: true,
        tokenAllowed: false,
        attestationValid: true,
        scoringVersionAllowed: true,
      })
    ).toBe(false);
  });

  it("allows only when every explicit gate passes", () => {
    expect(
      computeGatingAllowed({
        walletAllowed: true,
        attestationValid: true,
        scoringVersionAllowed: true,
      })
    ).toBe(true);
  });
});
