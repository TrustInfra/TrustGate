import { NextRequest, NextResponse } from "next/server";
import { createSubscription } from "@/lib/protocol-guard/store";
import type { ChannelConfig, GuardRule } from "@/lib/protocol-guard/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/protocol-guard/subscribe
 * Free protocol registration for monitoring config (channels + rules).
 * No payment. No subscription fee. Adoption-first.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const b = body as {
    protocolName?: string;
    contactEmail?: string;
    channels?: ChannelConfig;
    rules?: GuardRule[];
  };

  if (!b.protocolName || typeof b.protocolName !== "string") {
    return NextResponse.json(
      { error: "protocolName_required" },
      { status: 400 }
    );
  }

  const sub = createSubscription({
    protocolName: b.protocolName,
    contactEmail: b.contactEmail,
    channels: b.channels,
    rules: b.rules,
  });

  return NextResponse.json(
    {
      subscription: sub,
      pricing: {
        model: "free",
        monthlyUsdc: 0,
        currency: "USDC",
        note: "Protocol Guard is free for protocols. Register only to save alert channels and rules. Checks work without registration.",
      },
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
