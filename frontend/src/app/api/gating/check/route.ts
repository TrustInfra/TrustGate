import { NextRequest, NextResponse } from "next/server";
import { runGatingCheck } from "@/lib/gating/check";
import {
  EXAMPLE_GOVERNANCE_LADDER,
  EXAMPLE_LENDING_LADDER,
} from "@/lib/gating/ladder";
import type { GatingCheckRequest, LadderConfig } from "@/lib/gating/types";
import { GATING_DISCLAIMER } from "@/lib/gating/types";
import { arcTestnet } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * POST /api/gating/check
 * Score wallet (+ optional token), evaluate protocol-supplied ladder, issue attestation.
 * Body must include ladder OR ladderPreset: "example_lending" | "example_governance"
 * (presets are ILLUSTRATIVE only — not TrustGate policy).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<GatingCheckRequest> & {
    ladderPreset?: string;
  };

  if (!b.wallet || !ADDRESS_RE.test(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  let ladder: LadderConfig | undefined = b.ladder as LadderConfig | undefined;
  if (!ladder && b.ladderPreset === "example_lending") {
    ladder = EXAMPLE_LENDING_LADDER;
  } else if (!ladder && b.ladderPreset === "example_governance") {
    ladder = EXAMPLE_GOVERNANCE_LADDER;
  }

  if (!ladder || !Array.isArray(ladder.bands) || ladder.bands.length === 0) {
    return NextResponse.json(
      {
        error: "ladder_required",
        detail:
          "Provide ladder.bands (protocol-owned) or ladderPreset example_lending|example_governance for demos only",
      },
      { status: 400 }
    );
  }

  const checkReq: GatingCheckRequest = {
    wallet: b.wallet as `0x${string}`,
    requestedAmount:
      typeof b.requestedAmount === "number" ? b.requestedAmount : undefined,
    capability: typeof b.capability === "string" ? b.capability : "borrow",
    ladder,
    tokenAddress:
      b.tokenAddress && ADDRESS_RE.test(b.tokenAddress)
        ? (b.tokenAddress as `0x${string}`)
        : undefined,
    tokenLadder: b.tokenLadder,
    useClass: b.useClass,
    chainId: typeof b.chainId === "number" ? b.chainId : arcTestnet.id,
    requireMultiFactorAck: b.requireMultiFactorAck === true,
  };

  try {
    const result = await runGatingCheck(checkReq);
    return NextResponse.json(
      {
        ...result,
        pricing: "free",
        disclaimer: GATING_DISCLAIMER,
        guidance:
          "Free for protocols. TrustGate is one risk input. Combine with collateral, protocol history, and staking. Do not sole-gate on score.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[gating/check]", err);
    return NextResponse.json(
      {
        error: "check_failed",
        detail: err instanceof Error ? err.message : "unknown",
        disclaimer: GATING_DISCLAIMER,
      },
      { status: 502 }
    );
  }
}
