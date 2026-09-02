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

  it("includes the four Circle issuers and SWPRC", () => {
    const bySymbol = Object.fromEntries(
      LIVE_TOKENS.map((t) => [t.address.toLowerCase(), t.symbol])
    );
    expect(bySymbol["0x3600000000000000000000000000000000000000"]).toBe("USDC");
    expect(bySymbol["0x89b50855aa3be2f677cd6303cec089b5f319d72a"]).toBe("EURC");
    expect(bySymbol["0xe9185f0c5f296ed1797aae4238d26ccabeadb86c"]).toBe("USYC");
    expect(bySymbol["0xf0c4a4ce82a5746abaad9425360ab04fbba432bf"]).toBe(
      "CircBTC"
    );
    expect(bySymbol["0xbe7477bf91526fc9988c8f33e91b6db687119d45"]).toBe("SWPRC");
  });

  it("has three USDC tickers so same-name ranking has something to group", () => {
    const usdc = LIVE_TOKENS.filter((t) => t.symbol.toUpperCase() === "USDC");
    expect(usdc).toHaveLength(3);
    const verified = usdc.filter((t) => isVerifiedIssuer(t.address));
    expect(verified).toHaveLength(1);
  });
});
