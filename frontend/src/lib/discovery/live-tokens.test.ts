import { describe, expect, it } from "vitest";
import { LIVE_TOKENS } from "./live-tokens";
import { isVerifiedIssuer } from "./verified-issuers";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

describe("LIVE_TOKENS", () => {
  it("uses unique 20-byte hex addresses", () => {
    const addrs = LIVE_TOKENS.map((t) => t.address.toLowerCase());
    expect(LIVE_TOKENS.every((t) => ADDRESS_RE.test(t.address))).toBe(true);
    expect(new Set(addrs).size).toBe(LIVE_TOKENS.length);
  });

  it("lists official Circle issuers on Arc Mainnet", () => {
    const addrs = LIVE_TOKENS.map((t) => t.address.toLowerCase());
    expect(addrs).toContain("0x3600000000000000000000000000000000000000");
    expect(addrs).toContain("0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1");
    expect(addrs).toContain("0x8a5d989bbb96929f689b0200f435f53da42bf490");
    expect(addrs).not.toContain("0xd5413b391b3790cbef25d9655d82a2ad99cd8b31");
    expect(addrs).not.toContain("0x89b50855aa3be2f677cd6303cec089b5f319d72a");
  });

  it("marks every listed issuer as VERIFIED", () => {
    expect(LIVE_TOKENS.every((t) => isVerifiedIssuer(t.address))).toBe(true);
  });
});
