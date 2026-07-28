import { NextRequest, NextResponse } from "next/server";
import {
  freeAnonymousConfig,
  getSubscription,
} from "@/lib/protocol-guard/store";
import { evaluateCheck } from "@/lib/protocol-guard/evaluate";
import type { CheckRequest } from "@/lib/protocol-guard/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * POST /api/protocol-guard/check
 * Free for all protocols. subscriptionId optional — omit for anonymous free check.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as Partial<CheckRequest> & { protocolName?: string };
  if (!b.wallet || !ADDRESS_RE.test(b.wallet)) {
    return NextResponse.json({ error: "invalid_wallet" }, { status: 400 });
  }

  let sub =
    b.subscriptionId && typeof b.subscriptionId === "string"
      ? getSubscription(b.subscriptionId)
      : null;

  if (b.subscriptionId && !sub) {
    return NextResponse.json(
      { error: "registration_not_found" },
      { status: 404 }
    );
  }

  if (!sub) {
    sub = freeAnonymousConfig(
      typeof b.protocolName === "string" ? b.protocolName : "anonymous-protocol"
    );
  }

  const allowedContexts = new Set([
    "borrow",
    "vote",
    "generic",
    "dex_swap",
    "api_execution",
    "treasury_control",
    "governance_vote",
  ]);
  const context = allowedContexts.has(String(b.context))
    ? (b.context as CheckRequest["context"])
    : "generic";

  const check: CheckRequest = {
    subscriptionId: sub.id,
    wallet: b.wallet,
    context,
    amount: typeof b.amount === "number" ? b.amount : undefined,
    economicReachUsd:
      typeof b.economicReachUsd === "number" ? b.economicReachUsd : undefined,
    capitalAccess:
      typeof b.capitalAccess === "number" ? b.capitalAccess : undefined,
    minScore: typeof b.minScore === "number" ? b.minScore : undefined,
    minConfidence:
      typeof b.minConfidence === "number" ? b.minConfidence : undefined,
    voteClusterThreshold:
      typeof b.voteClusterThreshold === "number"
        ? b.voteClusterThreshold
        : undefined,
    proposalId: typeof b.proposalId === "string" ? b.proposalId : undefined,
    recentVoters: Array.isArray(b.recentVoters)
      ? b.recentVoters.filter((v): v is string => typeof v === "string")
      : undefined,
  };

  try {
    const result = await evaluateCheck(sub, check);
    return NextResponse.json(
      {
        ...result,
        pricing: "free",
        disclaimer:
          "TrustGate provides a behavioral trust signal free for protocol integrations. The protocol owns access policy. Not a credit decision.",
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[protocol-guard/check]", err);
    return NextResponse.json(
      {
        error: "check_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }
}
