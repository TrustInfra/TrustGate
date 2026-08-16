import { describe, expect, it } from "vitest";
import { createWindowCounter, resolveClientIp } from "./widget-limit";

function hdr(map: Record<string, string>) {
  return {
    get(name: string) {
      return map[name.toLowerCase()] ?? null;
    },
  };
}

describe("resolveClientIp", () => {
  it("prefers x-vercel-forwarded-for over spoofed XFF", () => {
    expect(
      resolveClientIp(
        hdr({
          "x-forwarded-for": "1.1.1.1, 2.2.2.2",
          "x-vercel-forwarded-for": "9.9.9.9",
        })
      )
    ).toBe("9.9.9.9");
  });

  it("uses the last XFF hop when no platform header exists", () => {
    expect(
      resolveClientIp(hdr({ "x-forwarded-for": "1.1.1.1, 8.8.8.8" }))
    ).toBe("8.8.8.8");
  });

  it("falls back to x-real-ip", () => {
    expect(resolveClientIp(hdr({ "x-real-ip": "7.7.7.7" }))).toBe("7.7.7.7");
  });
});

describe("createWindowCounter", () => {
  it("rejects after max in the window", () => {
    const c = createWindowCounter(60_000, 2);
    expect(c.take().ok).toBe(true);
    expect(c.take().ok).toBe(true);
    expect(c.take().ok).toBe(false);
    expect(c.take().retryAfter).toBeGreaterThan(0);
  });
});
