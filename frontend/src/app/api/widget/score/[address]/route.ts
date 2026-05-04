import { NextRequest, NextResponse } from "next/server";
import { detectContractKind, scoreContract } from "@/lib/contract-scoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_ORACLE_URL = "https://oracle.trustgated.xyz";
const ORACLE_BASE = (
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  process.env.ORACLE_URL ||
  DEFAULT_ORACLE_URL
).replace(/\/+$/, "");

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets: Map<string, RateBucket> = new Map();

function takeRateSlot(ip: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += 1;
  return { ok: true, retryAfter: 0 };
}

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

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

interface UpstreamTokenResponse {
  score?: number;
  tier?: string;
}

async function fetchErc20Free(
  address: string
): Promise<{ score: number; tier: string } | null> {
  // The widget endpoint is free, but Nald's upstream may still require x402.
  // Try a header-less GET; only accept the 200 path. Anything else falls
  // through to a deterministic placeholder per spec: "for now return a
  // cached/mock score if payment is required, we will sort with Nald later".
  const url = `${ORACLE_BASE}/oracle/token/${encodeURIComponent(address)}`;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (res.status !== 200) return null;
    const data = (await res.json()) as UpstreamTokenResponse;
    if (typeof data.score !== "number" || typeof data.tier !== "string") {
      return null;
    }
    return { score: data.score, tier: data.tier };
  } catch {
    return null;
  }
}

function placeholderErc20Score(address: string): {
  score: number;
  tier: string;
} {
  // Deterministic fallback: hash the address into a 0-99 bucket and map to
  // the same tier bands the wallet/contract scorers use. Stable per-address
  // so a DEX integrator sees the same badge on repeat loads.
  let h = 2166136261 >>> 0;
  for (let i = 0; i < address.length; i++) {
    h = (h ^ address.charCodeAt(i)) >>> 0;
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const bucket = h % 100;
  if (bucket >= 80) return { score: bucket, tier: "HIGH_ELITE" };
  if (bucket >= 60) return { score: bucket, tier: "HIGH" };
  if (bucket >= 40) return { score: bucket, tier: "MEDIUM" };
  return { score: bucket, tier: "LOW" };
}

export async function GET(
  req: NextRequest,
  context: { params: { address: string } }
): Promise<NextResponse> {
  const ip = clientIp(req);
  const slot = takeRateSlot(ip);
  if (!slot.ok) {
    return jsonResponse({ error: "rate_limited" }, 429, {
      "Retry-After": String(slot.retryAfter),
    });
  }

  const address = context.params.address;
  if (!ADDRESS_RE.test(address)) {
    return jsonResponse({ error: "invalid_address" }, 400);
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

  if (detection.kind === "not-contract") {
    return jsonResponse({ error: "not_a_contract" }, 404);
  }

  if (detection.kind === "erc20") {
    const upstream = await fetchErc20Free(address);
    const result = upstream ?? placeholderErc20Score(address);
    return jsonResponse(
      {
        score: result.score,
        tier: result.tier,
        contractType: "ERC-20",
      },
      200
    );
  }

  if (!detection.info) {
    return jsonResponse({ error: "info_missing" }, 502);
  }

  try {
    const result = await scoreContract(
      address,
      detection.info,
      req.nextUrl.origin
    );
    return jsonResponse(
      {
        score: result.score,
        tier: result.tier,
        contractType: result.contractType,
      },
      200
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error(`[widget-score] scoring failed for ${address}:`, message);
    return jsonResponse({ error: "scoring_failed" }, 502);
  }
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
