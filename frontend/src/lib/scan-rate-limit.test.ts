import { afterEach, describe, expect, it } from "vitest";
import { allowScan, resetScanRateLimit, scanClientKey } from "./scan-rate-limit";

describe("scan rate limit", () => {
  afterEach(() => {
    resetScanRateLimit();
  });

  it("allows 30 scans in a window and rejects the next", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 30; i += 1) {
      expect(allowScan("203.0.113.8", now + i)).toBe(true);
    }
    expect(allowScan("203.0.113.8", now + 31)).toBe(false);
  });

  it("opens the window again after 60 seconds", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 30; i += 1) allowScan("203.0.113.8", now);
    expect(allowScan("203.0.113.8", now + 60_000)).toBe(true);
  });

  it("counts addresses separately", () => {
    const now = 1_700_000_000_000;
    for (let i = 0; i < 30; i += 1) allowScan("203.0.113.8", now);
    expect(allowScan("203.0.113.9", now)).toBe(true);
  });

  it("collapses a missing or malformed IP into one shared bucket", () => {
    expect(scanClientKey("not an ip")).toBe("shared");
    expect(scanClientKey(null)).toBe("shared");
    expect(scanClientKey("203.0.113.8")).toBe("203.0.113.8");
  });
});