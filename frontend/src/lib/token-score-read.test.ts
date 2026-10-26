import { describe, expect, it } from "vitest";
import {
  classifyPaidRead,
  paidBodyState,
  pendingBlocksScore,
} from "./token-score-read";

describe("paidBodyState", () => {
  it("shows a score that arrived beside a pending flag", () => {
    expect(paidBodyState({ status: "pending", score: 39, tier: "LOW" })).toBe(
      "score"
    );
  });

  it("waits when the body is pending and the score is missing or zero", () => {
    expect(paidBodyState({ status: "pending" })).toBe("pending");
    expect(paidBodyState({ data: { kind: "pending", score: 0 } })).toBe(
      "pending"
    );
  });

  it("shows a finished zero that is not marked pending", () => {
    expect(paidBodyState({ score: 0, tier: "LOW" })).toBe("score");
  });

  it("rejects a body with no score and no pending flag", () => {
    expect(paidBodyState({ error: "nope" })).toBe("unusable");
    expect(paidBodyState(null)).toBe("unusable");
  });
});

describe("pendingBlocksScore", () => {
  it("lets a positive score through a pending flag", () => {
    expect(
      pendingBlocksScore({ status: "pending", score: 39, tier: "LOW" })
    ).toBe(false);
    expect(
      pendingBlocksScore({ data: { kind: "pending", score: 39, tier: "LOW" } })
    ).toBe(false);
  });

  it("blocks a pending body whose score is missing or zero", () => {
    expect(pendingBlocksScore({ status: "pending" })).toBe(true);
    expect(pendingBlocksScore({ data: { kind: "pending", score: 0 } })).toBe(
      true
    );
  });

  it("does not block a finished zero", () => {
    expect(pendingBlocksScore({ score: 0, tier: "LOW" })).toBe(false);
  });
});

describe("classifyPaidRead", () => {
  it("reads a score from an HTTP 202 body", () => {
    expect(
      classifyPaidRead(202, { status: "pending", score: 39, tier: "LOW" })
    ).toBe("score");
  });

  it("waits on HTTP 202 when the body has no score", () => {
    expect(classifyPaidRead(202, { status: "pending" })).toBe("pending");
    expect(classifyPaidRead(202, null)).toBe("pending");
  });
});
