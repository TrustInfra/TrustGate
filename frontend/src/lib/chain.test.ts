import { describe, expect, it } from "vitest";
import { CHAIN_ID, CONTRACT_ADDRESSES, USDC_ADDRESS, VERIFIED_ISSUER_ADDRESSES } from "./chain";

describe("Arc Mainnet chain config", () => {
  it("is chain 5042 with Circle USDC", () => {
    expect(CHAIN_ID).toBe(5042);
    expect(USDC_ADDRESS.toLowerCase()).toBe(
      "0x3600000000000000000000000000000000000000"
    );
  });

  it("lists mainnet Circle issuers only", () => {
    expect(VERIFIED_ISSUER_ADDRESSES).toContain(
      "0x3600000000000000000000000000000000000000"
    );
    expect(VERIFIED_ISSUER_ADDRESSES).toContain(
      "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1"
    );
    expect(VERIFIED_ISSUER_ADDRESSES).not.toContain(
      "0x89b50855aa3be2f677cd6303cec089b5f319d72a"
    );
  });

  it("does not point at Arc Testnet contracts", () => {
    const addrs = [
      CONTRACT_ADDRESSES.trustGate,
      CONTRACT_ADDRESSES.agentRegistry,
      CONTRACT_ADDRESSES.trustScoring,
      CONTRACT_ADDRESSES.subjectStake,
    ];
    expect(addrs).not.toContain("0x52E17bC482d00776d73811680CbA9914e83E33CC");
    expect(addrs).not.toContain("0x73d3cf7f2734C334927f991fe87D06d595d398b4");
    expect(addrs).not.toContain("0xEb979Dc25396ba4be6cEA41EAfEa894C55772246");
  });
});
