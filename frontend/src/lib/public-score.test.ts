import { describe, expect, it } from "vitest";
import { toPublicScoreView } from "./public-score";

describe("toPublicScoreView", () => {
  it("maps an arc-score payload into the scan card", () => {
    const view = toPublicScoreView("0xAA00167794A76579942b0f6A95EDD5E1515bf05d", {
      score: 20,
      tier: "LOW",
      blocked: false,
      capped: false,
      breakdown: {
        txPoints: 20,
        usdcPoints: 0,
        contractPoints: 0,
        deployPoints: 0,
        txCount: 2,
        usdcBalanceHuman: 1.091,
        contractInteractions: 0,
        contractDeployments: 0,
      },
    });
    expect(view.score).toBe(20);
    expect(view.tier).toBe("LOW");
    expect(view.recommendation).toBe("Thin history");
    expect(view.txCount).toBe(2);
    expect(view.breakdown.deploymentPoints).toBe(0);
    expect(view.summary[0]).toBe("2 transactions on Arc.");
  });

  it("treats a zero score as no history", () => {
    const view = toPublicScoreView("0x0000000000000000000000000000000000000001", {
      score: 0,
      tier: "BLOCKED",
      blocked: true,
    });
    expect(view.recommendation).toBe("No onchain history");
    expect(view.summary[0]).toBe("No transactions on Arc.");
  });
});
