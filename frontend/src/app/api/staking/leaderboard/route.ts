import { NextRequest, NextResponse } from "next/server";
import { getStakingLeaderboard } from "@/lib/staking/signals";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/staking/leaderboard?limit=50
 * Public staking commitment leaderboard (Phase 3b).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const limit = Math.min(
    100,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 50) || 50)
  );
  const entries = getStakingLeaderboard(limit);
  return NextResponse.json(
    {
      updatedAt: new Date().toISOString(),
      count: entries.length,
      entries,
      note: "Leaderboard fills as wallets are scored through oracle / protocol-guard paths. Gaming-flagged wallets are excluded.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
