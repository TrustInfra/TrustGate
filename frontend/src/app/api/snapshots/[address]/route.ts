import { NextRequest, NextResponse } from "next/server";
import {
  getSnapshot,
  listSnapshots,
} from "@/lib/trust-intelligence/snapshots";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * GET /api/snapshots/:address?limit=20
 * GET /api/snapshots/:address?id=snap_...
 * Point-in-time trust audit trail (Phase 3).
 */
export async function GET(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const address = context.params.address;
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    const snap = getSnapshot(address, id);
    if (!snap) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(snap, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  const limit = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20)
  );
  const snapshots = listSnapshots(address, limit);
  return NextResponse.json(
    { address: address.toLowerCase(), count: snapshots.length, snapshots },
    { headers: { "Cache-Control": "no-store" } }
  );
}
