import { NextRequest, NextResponse } from "next/server";
import {
  issueTokenAttestation,
  issueWalletAttestation,
} from "@/lib/gating/issue";
import type { AttestationUseClass } from "@/lib/gating/types";
import { GATING_DISCLAIMER } from "@/lib/gating/types";
import { arcTestnet } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * POST /api/gating/attest
 * Issue a time-bound signed trust attestation (behavioral access signal).
 * Body: { subject, subjectType?: "wallet"|"token", useClass?, chainId?, ttlSeconds? }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as {
    subject?: string;
    wallet?: string;
    token?: string;
    subjectType?: string;
    useClass?: AttestationUseClass;
    chainId?: number;
    ttlSeconds?: number;
  };

  const subject = (b.subject || b.wallet || b.token || "").trim();
  if (!ADDRESS_RE.test(subject)) {
    return NextResponse.json({ error: "invalid_subject" }, { status: 400 });
  }

  const subjectType =
    b.subjectType === "token" || b.token
      ? "token"
      : "wallet";

  try {
    const attestation =
      subjectType === "token"
        ? await issueTokenAttestation({
            token: subject as `0x${string}`,
            chainId: b.chainId ?? arcTestnet.id,
            useClass: b.useClass,
            ttlSeconds: b.ttlSeconds,
          })
        : await issueWalletAttestation({
            wallet: subject as `0x${string}`,
            chainId: b.chainId ?? arcTestnet.id,
            useClass: b.useClass,
            ttlSeconds: b.ttlSeconds,
          });

    return NextResponse.json(
      {
        attestation,
        pricing: "free",
        disclaimer: GATING_DISCLAIMER,
        note: attestation.isDemoSigner
          ? "Demo signer active. Set ATTESTATION_SIGNER_PRIVATE_KEY for production."
          : undefined,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[gating/attest]", err);
    return NextResponse.json(
      {
        error: "attest_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }
}
