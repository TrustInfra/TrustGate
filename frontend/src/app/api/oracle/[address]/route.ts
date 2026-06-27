import { NextRequest, NextResponse } from "next/server";
import { rescoreWallet } from "@/lib/wallet-rescore";
import { SCORING_VERSION } from "@/lib/scoring-version";
import { isContractAddress } from "@/lib/contract-detect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORACLE_BASE = (
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  process.env.ORACLE_URL ||
  ""
).replace(/\/+$/, "");

if (!ORACLE_BASE) {
  throw new Error(
    "Oracle URL is not configured. Set ORACLE_URL or NEXT_PUBLIC_ORACLE_URL.",
  );
}

const FORWARDABLE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-type",
  "user-agent",
  "x-payment",
  "x-payment-required",
  "x-payment-tx",
  "x-request-id",
]);

const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Payment, X-Payment-Required, X-Payment-Tx, X-Request-Id, Accept",
  "Access-Control-Expose-Headers": "X-Payment, X-Payment-Required, X-Payment-Tx",
  "Access-Control-Max-Age": "86400",
};

function pickRequestHeaders(req: NextRequest): Headers {
  const out = new Headers();
  req.headers.forEach((value, key) => {
    if (FORWARDABLE_REQUEST_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

function pickResponseHeaders(upstream: Response): Headers {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_RESPONSE_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    out.set(k, v);
  }
  out.set("Cache-Control", "no-store");
  return out;
}

async function proxy(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const address = context.params.address;

  // Reject contract addresses on the unpaid challenge call, before any payment
  // is requested or forwarded upstream. The Oracle scores wallets; contracts
  // are scored on Token Shield. Skipped when an X-Payment proof is present
  // (the paid replay), since the challenge has already gated it.
  if (!req.headers.get("x-payment")) {
    const { isContract, rpcOk } = await isContractAddress(address);
    if (isContract) {
      return NextResponse.json(
        {
          error: "This is a contract address. Use Token Shield to score contracts.",
          code: "CONTRACT_NOT_WALLET",
          redirect: "/token-shield",
        },
        { status: 400, headers: CORS_HEADERS }
      );
    }
    if (!rpcOk) {
      console.warn(
        "[oracle] contract pre-check RPC unavailable, proceeding as wallet:",
        address
      );
    }
  }

  const encoded = encodeURIComponent(address);
  const url = `${ORACLE_BASE}/oracle/${encoded}${req.nextUrl.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: pickRequestHeaders(req),
    cache: "no-store",
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Oracle proxy failed", detail: message, upstream: url },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const headers = pickResponseHeaders(upstream);
  const body = await upstream.arrayBuffer();

  // Re-score successful score responses through our formula. 402, 202, 5xx,
  // and anything without a numeric score field pass through unchanged.
  if (
    upstream.status === 200 &&
    req.method === "GET" &&
    /^0x[0-9a-fA-F]{40}$/.test(address) &&
    (headers.get("content-type") ?? "").toLowerCase().includes("application/json")
  ) {
    try {
      const text = new TextDecoder().decode(body);
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { score?: unknown }).score === "number"
      ) {
        const original = parsed as Record<string, unknown> & { score: number };
        const rescored = await rescoreWallet(original.score, address);
        // Override the three score-derived fields. Preserve everything else
        // upstream returned (breakdown, queriedAt, network, source, etc.).
        const merged: Record<string, unknown> = {
          ...original,
          score: rescored.score,
          tier: rescored.tier,
          recommendation: rescored.recommendation,
          scoringVersion: SCORING_VERSION,
          ...(rescored.limitations.length > 0
            ? { limitations: rescored.limitations }
            : {}),
        };
        const newBody = JSON.stringify(merged);
        const newHeaders = new Headers(headers);
        newHeaders.set("content-type", "application/json; charset=utf-8");
        newHeaders.delete("etag");
        newHeaders.delete("last-modified");
        return new NextResponse(newBody, {
          status: 200,
          statusText: "OK",
          headers: newHeaders,
        });
      }
    } catch (err) {
      console.error(
        "[wallet-rescore] post-processing failed, passing upstream through:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  return proxy(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  return proxy(req, context);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
