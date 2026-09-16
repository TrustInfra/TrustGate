import { NextRequest, NextResponse } from "next/server";
import {
  readPosition,
  readPositions,
  readSubjectById,
  readUnbonds,
} from "@/lib/stake/read";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ID_RE = /^0x[0-9a-fA-F]{64}$/;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const id = (req.nextUrl.searchParams.get("id") ?? "").trim();
  const staker = (req.nextUrl.searchParams.get("staker") ?? "").trim();
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }

  try {
    const onchain = await readSubjectById(id as `0x${string}`);
    const positions = await readPositions(id as `0x${string}`);
    let position = null;
    let unbonds = null;
    if (/^0x[0-9a-fA-F]{40}$/.test(staker)) {
      position = await readPosition(id as `0x${string}`, staker as `0x${string}`);
      unbonds = await readUnbonds(id as `0x${string}`, staker as `0x${string}`);
    }
    return NextResponse.json({ onchain, positions, position, unbonds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
