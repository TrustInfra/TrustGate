import { describe, expect, it } from "vitest";
import { decodeAbiString, erc20ViewResultsMatch } from "./erc20-views";

const DECIMALS_18 =
  "0x0000000000000000000000000000000000000000000000000000000000000012";
const SUPPLY_ONE =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const SYMBOL_ARGUS =
  "0x" +
  "0000000000000000000000000000000000000000000000000000000000000020" +
  "0000000000000000000000000000000000000000000000000000000000000005" +
  "4152475553000000000000000000000000000000000000000000000000000000";

describe("erc20 view results", () => {
  it("accepts a dynamic symbol with uint decimals and supply", () => {
    expect(decodeAbiString(SYMBOL_ARGUS)).toBe("ARGUS");
    expect(erc20ViewResultsMatch(DECIMALS_18, SYMBOL_ARGUS, SUPPLY_ONE)).toBe(
      true
    );
  });

  it("accepts a bytes32 symbol", () => {
    const bytes32 =
      "0x4152475553000000000000000000000000000000000000000000000000000000";
    expect(decodeAbiString(bytes32)).toBe("ARGUS");
    expect(erc20ViewResultsMatch(DECIMALS_18, bytes32, SUPPLY_ONE)).toBe(true);
  });

  it("rejects empty, oversized decimals, and short words", () => {
    expect(erc20ViewResultsMatch(null, SYMBOL_ARGUS, SUPPLY_ONE)).toBe(false);
    expect(erc20ViewResultsMatch("0x", SYMBOL_ARGUS, SUPPLY_ONE)).toBe(false);
    expect(
      erc20ViewResultsMatch(
        "0x" + "ff".repeat(32),
        SYMBOL_ARGUS,
        SUPPLY_ONE
      )
    ).toBe(false);
    expect(erc20ViewResultsMatch(DECIMALS_18, "0x", SUPPLY_ONE)).toBe(false);
    expect(erc20ViewResultsMatch(DECIMALS_18, SYMBOL_ARGUS, "0x01")).toBe(
      false
    );
  });
});