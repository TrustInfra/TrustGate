import { NextRequest, NextResponse } from "next/server";
import { verifyProvidedAttestation } from "@/lib/gating/check";
import type { TrustAttestation } from "@/lib/gating/types";
import { GATING_DISCLAIMER } from "@/lib/gating/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/gating/verify
 * Verify a signed attestation (off-chain). Fail-closed on any issue.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as {
    attestation?: TrustAttestation;
    expectedSubject?: string;
    expectedChainId?: number;
  };

  if (!b.attestation || typeof b.attestation !== "object") {
    return NextResponse.json(
      { error: "attestation_required" },
      { status: 400 }
    );
  }

  const result = await verifyProvidedAttestation(
    b.attestation,
    b.expectedSubject,
    b.expectedChainId
  );

  return NextResponse.json(
    {
      ...result,
      disclaimer: GATING_DISCLAIMER,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
