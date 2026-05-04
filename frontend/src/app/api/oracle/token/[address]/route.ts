import { NextRequest, NextResponse } from "next/server";
import {
  ContractInfo,
  detectContractKind,
  scoreContract,
} from "@/lib/contract-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_ORACLE_URL = "http://38.49.216.201:3001";

const ORACLE_BASE = (
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  process.env.ORACLE_URL ||
  DEFAULT_ORACLE_URL
).replace(/\/+$/, "");

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

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

async function forwardToTokenOracle(
  req: NextRequest,
  rawAddress: string
): Promise<NextResponse> {
  const address = encodeURIComponent(rawAddress);
  const url = `${ORACLE_BASE}/oracle/token/${address}${req.nextUrl.search}`;

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

  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

function jsonResponse(
  payload: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): NextResponse {
  const headers = new Headers();
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extraHeaders)) headers.set(k, v);
  return new NextResponse(JSON.stringify(payload), { status, headers });
}

async function handleNonTokenContract(
  req: NextRequest,
  address: string,
  info: ContractInfo
): Promise<NextResponse> {
  const hasPayment = req.headers.has("x-payment");

  // No payment yet — forward to upstream so the client receives Nald's normal
  // 402 challenge body. We intentionally don't synthesise our own challenge:
  // keeping the upstream shape avoids drift between ERC-20 and contract paths.
  if (!hasPayment) {
    return forwardToTokenOracle(req, address);
  }

  // Payment header present — score locally without hitting Nald, per spec
  // ("run the CONTRACT SCORING flow ... instead of forwarding to Nald").
  try {
    const result = await scoreContract(address, info, req.nextUrl.origin);
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[contract-score] ${address} failed:`, message);
    return jsonResponse(
      { error: `Contract scoring failed: ${message}` },
      502
    );
  }
}

async function proxy(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const address = context.params.address;

  if (!ADDRESS_RE.test(address)) {
    return jsonResponse({ error: "Invalid address" }, 400);
  }

  // Preflight via OPTIONS is handled separately; this branch only sees real
  // GET/POST traffic. Detect whether the address is a contract first.
  let detection;
  try {
    detection = await detectContractKind(address);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[token-route] detection failed for ${address}:`, message);
    return jsonResponse(
      { error: "Could not load contract info from Arcscan." },
      502
    );
  }

  if (detection.kind === "fetch-failed") {
    return jsonResponse(
      { error: "Could not load contract info from Arcscan." },
      502
    );
  }

  if (detection.kind === "not-contract") {
    return jsonResponse(
      {
        error:
          "Address is not a contract. Use the Oracle page to score wallet addresses.",
      },
      400
    );
  }

  if (detection.kind === "erc20") {
    return forwardToTokenOracle(req, address);
  }

  // detection.kind === "other-contract"
  if (!detection.info) {
    return jsonResponse(
      { error: "Could not load contract info from Arcscan." },
      502
    );
  }
  return handleNonTokenContract(req, address, detection.info);
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
