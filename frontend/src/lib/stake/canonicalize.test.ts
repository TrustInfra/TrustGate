import { describe, expect, it } from "vitest";
import { keccak256, toBytes } from "viem";
import { canonicalizeSubject, subjectId } from "./canonicalize";

describe("canonicalizeSubject", () => {
  it("parses X urls and @handles", () => {
    const a = canonicalizeSubject("https://x.com/TrustGated");
    const b = canonicalizeSubject("https://twitter.com/TrustGated");
    const c = canonicalizeSubject("@TrustGated", { kind: "x" });
    expect(a?.kind).toBe("x");
    expect(a?.canonical).toBe("trustgated");
    expect(b?.canonical).toBe("trustgated");
    expect(c?.canonical).toBe("trustgated");
    expect(a && b && subjectId(a.kind, a.canonical)).toBe(
      subjectId(b.kind, b.canonical)
    );
  });

  it("parses LinkedIn, GitHub, Discord, Telegram", () => {
    expect(
      canonicalizeSubject("https://www.linkedin.com/in/Jane-Doe")?.canonical
    ).toBe("in:jane-doe");
    expect(
      canonicalizeSubject("https://linkedin.com/company/Circle")?.canonical
    ).toBe("company:circle");
    expect(canonicalizeSubject("https://github.com/ethereum")?.canonical).toBe(
      "ethereum"
    );
    expect(
      canonicalizeSubject("https://github.com/ethereum/go-ethereum")?.canonical
    ).toBe("ethereum/go-ethereum");
    expect(canonicalizeSubject("https://discord.gg/KbX9")?.canonical).toBe(
      "invite:kbx9"
    );
    expect(canonicalizeSubject("https://t.me/TrustGated")?.canonical).toBe(
      "trustgated"
    );
  });

  it("parses wallets, tokens, and websites", () => {
    const addr = "0x3600000000000000000000000000000000000000";
    const wallet = canonicalizeSubject(addr);
    expect(wallet?.kind).toBe("wallet");
    expect(wallet?.canonical).toBe(`eip155:5042:${addr.toLowerCase()}`);
    const token = canonicalizeSubject(addr, { addressKind: "token" });
    expect(token?.kind).toBe("token");
    expect(token?.canonical).toBe(`eip155:5042/erc20:${addr.toLowerCase()}`);
    const site = canonicalizeSubject("https://TrustGated.xyz/docs");
    expect(site?.kind).toBe("website");
    expect(site?.canonical).toBe("https://trustgated.xyz");
  });

  it("falls back to uri so anything is stakeable", () => {
    const s = canonicalizeSubject("some arbitrary claim");
    expect(s?.kind).toBe("uri");
    expect(s?.canonical).toBe("some arbitrary claim");
  });

  it("subjectId matches abi.encodePacked(kind, ':', canonical)", () => {
    const packed = keccak256(toBytes("x:trustgated"));
    expect(subjectId("x", "trustgated")).toBe(packed);
  });
});
