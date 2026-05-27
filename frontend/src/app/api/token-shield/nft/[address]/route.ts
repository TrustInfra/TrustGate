import { NextRequest, NextResponse } from "next/server";
import { detectContractKind } from "@/lib/contract-scoring";
import { assembleAndScoreNft } from "@/lib/nft-contract";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(payload: unknown, status: number): NextResponse {
  const headers = new Headers();
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new NextResponse(JSON.stringify(payload), { status, headers });
}

// Free NFT contract scoring. No payment, no oracle, no hot wallet — the score
// is computed locally from Arcscan data. Always returns a result; sparse data
// degrades to LOW confidence with safe defaults rather than throwing.
export async function GET(
  _req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const address = context.params.address;

  if (!ADDRESS_RE.test(address)) {
    return jsonResponse({ error: "Invalid address" }, 400);
  }

  let detection;
  try {
    detection = await detectContractKind(address);
  } catch {
    return jsonResponse(
      { error: "Could not load contract info from Arcscan." },
      502
    );
  }

  if (detection.kind === "fetch-failed" || !detection.info) {
    return jsonResponse(
      { error: "Could not load contract info from Arcscan." },
      502
    );
  }

  if (detection.kind === "not-contract") {
    return jsonResponse({ error: "Address is not a contract." }, 400);
  }

  if (detection.kind !== "nft") {
    return jsonResponse(
      { error: "Address is not an ERC-721 or ERC-1155 contract." },
      400
    );
  }

  try {
    const result = await assembleAndScoreNft(
      address,
      {
        isErc721: detection.info.isErc721,
        isErc1155: detection.info.isErc1155,
        isVerified: detection.info.isVerified,
        creatorAddress: detection.info.creatorAddress,
      },
      _req.nextUrl.origin
    );
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[nft-score] ${address} failed:`, message);
    return jsonResponse({ error: `NFT scoring failed: ${message}` }, 502);
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
