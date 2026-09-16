import { NextRequest, NextResponse } from "next/server";
import { canonicalizeSubject } from "@/lib/stake/canonicalize";
import { isSubjectKind } from "@/lib/stake/kinds";
import {
  readClaims,
  readPosition,
  readSubject,
  readUnbonds,
} from "@/lib/stake/read";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const kindRaw = (req.nextUrl.searchParams.get("kind") ?? "").trim();
  const canonicalRaw = (req.nextUrl.searchParams.get("canonical") ?? "").trim();
  const input = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const staker = (req.nextUrl.searchParams.get("staker") ?? "").trim();

  const parsed = input
    ? canonicalizeSubject(input, {
        kind: isSubjectKind(kindRaw) ? kindRaw : undefined,
      })
    : kindRaw && canonicalRaw
      ? canonicalizeSubject(
          kindRaw === "wallet" || kindRaw === "token"
            ? canonicalRaw.split(":").pop() || canonicalRaw
            : canonicalRaw,
          { kind: isSubjectKind(kindRaw) ? kindRaw : undefined }
        )
      : null;

  const subject =
    parsed ??
    (kindRaw && canonicalRaw && isSubjectKind(kindRaw)
      ? {
          kind: kindRaw,
          canonical: canonicalRaw,
          display: canonicalRaw,
          input: canonicalRaw,
        }
      : null);

  if (!subject) {
    return NextResponse.json({ error: "subject_required" }, { status: 400 });
  }

  try {
    const onchain = await readSubject(subject);
    const claims = await readClaims(onchain.id);
    let position = null;
    let unbonds = null;
    if (/^0x[0-9a-fA-F]{40}$/.test(staker)) {
      position = await readPosition(onchain.id, staker as `0x${string}`);
      unbonds = await readUnbonds(onchain.id, staker as `0x${string}`);
    }
    return NextResponse.json({
      subject,
      onchain,
      claims,
      position,
      unbonds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "read_failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
