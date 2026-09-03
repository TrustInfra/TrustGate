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

  it("includes official USDC, two USDC clones, and SWPRC", () => {
    const addrs = LIVE_TOKENS.map((t) => t.address.toLowerCase());
    expect(addrs).toContain("0x3600000000000000000000000000000000000000");
    expect(addrs).toContain("0xd5413b391b3790cbef25d9655d82a2ad99cd8b31");
    expect(addrs).toContain("0x634b984958e56a5a57db2ccfb11c48404b86f507");
    expect(addrs).toContain("0xbe7477bf91526fc9988c8f33e91b6db687119d45");
    expect(addrs).not.toContain("0x89b50855aa3be2f677cd6303cec089b5f319d72a");
    expect(addrs).not.toContain("0xe9185f0c5f296ed1797aae4238d26ccabeadb86c");
    expect(addrs).not.toContain("0xf0c4a4ce82a5746abaad9425360ab04fbba432bf");
  });

  it("has three USDC tickers so same-name ranking has something to group", () => {
    const usdc = LIVE_TOKENS.filter((t) => t.symbol.toUpperCase() === "USDC");
    expect(usdc).toHaveLength(3);
    const verified = usdc.filter((t) => isVerifiedIssuer(t.address));
    expect(verified).toHaveLength(1);
  });
});
