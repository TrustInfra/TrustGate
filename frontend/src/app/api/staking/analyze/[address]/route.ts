import { NextResponse } from "next/server";
import { analyzeStaking } from "@/lib/staking/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** GET /api/staking/analyze/:address — staking intelligence for one wallet */
export async function GET(
  _req: Request,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const address = context.params.address;
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }
  try {
    const signal = await analyzeStaking(address);
    return NextResponse.json(signal, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "staking_analysis_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }
}
