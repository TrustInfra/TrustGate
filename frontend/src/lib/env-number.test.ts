import { describe, expect, it } from "vitest";
import { envNumber } from "./env-number";

describe("envNumber", () => {
  it("uses fallback for missing and empty string", () => {
    expect(envNumber("X", 100, {})).toBe(100);
    expect(envNumber("X", 100, { X: "" })).toBe(100);
    expect(envNumber("X", 100, { X: "   " })).toBe(100);
  });

  it("rejects non-finite values", () => {
    expect(envNumber("X", 7, { X: "nope" })).toBe(7);
  });

  it("parses finite numbers including 0", () => {
    expect(envNumber("X", 100, { X: "0" })).toBe(0);
    expect(envNumber("X", 100, { X: "59" })).toBe(59);
  });
});
