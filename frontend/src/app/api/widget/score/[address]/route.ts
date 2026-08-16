import { NextRequest, NextResponse } from "next/server";
import { detectContractKind, isVerifiedIssuer } from "@/lib/contract-scoring";
import { scoreErc20ViaUpstream } from "@/lib/widget-payment";
import {
  resolveClientIp,
  takeWidgetIpSlot,
  WidgetSpendLimitError,
} from "@/lib/widget-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

function jsonResponse(
  payload: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): NextResponse {
  const headers = new Headers();
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new NextResponse(JSON.stringify(payload), { status, headers });
}

export async function GET(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const ip = resolveClientIp(req.headers);
  const slot = takeWidgetIpSlot(ip);
  if (!slot.ok) {
    return jsonResponse({ error: "rate_limited" }, 429, {
      "Retry-After": String(slot.retryAfter),
    });
  }

  const address = context.params.address;
  if (!ADDRESS_RE.test(address)) {
    return jsonResponse({ error: "invalid_address" }, 400);
  }

  // Official issuer tokens skip detection, the upstream VPS oracle, and the
  // server-side x402 payment entirely. They get the dedicated VERIFIED tier
  // with no numeric score. Shape mirrors the NTT response below.
  if (isVerifiedIssuer(address)) {
    return jsonResponse({ score: null, tier: "VERIFIED", label: "VERIFIED" }, 200);
  }

  let detection;
  try {
    detection = await detectContractKind(address);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[widget-score] detection failed for ${address}:`, message);
    return jsonResponse({ error: "detection_failed" }, 502);
  }

  if (detection.kind === "fetch-failed") {
    return jsonResponse({ error: "detection_failed" }, 502);
  }

  // ERC-20 tokens go to upstream Nald with a server-side x402 payment so the
  // widget returns the same authoritative score Token Shield does. The hot
  // wallet pays — caller pays nothing. See lib/widget-payment.ts.
  if (detection.kind === "erc20") {
    try {
      const result = await scoreErc20ViaUpstream(address);
      return jsonResponse(result, 200);
    } catch (err) {
      if (err instanceof WidgetSpendLimitError) {
        return jsonResponse({ error: "rate_limited" }, 429, {
          "Retry-After": String(err.retryAfter),
        });
      }
      const message = err instanceof Error ? err.message : "unknown";
      console.error(
        `[widget-score] erc20 upstream failed for ${address}:`,
        message
      );
      return jsonResponse({ error: "scoring_unavailable" }, 502);
    }
  }

  // Everything else is Not a Tradeable Token: NFT contracts (ERC-721/ERC-1155),
  // other non-token contracts, and wallet addresses (EOAs). The widget only
  // scores ERC-20s, so it returns an explicit NTT marker for these instead of a
  // misleading trust score. detection.kind here is one of "nft",
  // "other-contract", or "not-contract".
  return jsonResponse({ score: null, tier: "NTT", label: "NTT" }, 200);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
