import { NextRequest, NextResponse } from "next/server";
import { scoreTokenBatch } from "@/lib/batch/score-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ADDRESSES = 40;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
  "Access-Control-Max-Age": "86400",
};

const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets: Map<string, RateBucket> = new Map();

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

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

function json(payload: unknown, status: number, extra: Record<string, string> = {}) {
  const headers = new Headers(CORS_HEADERS);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new NextResponse(JSON.stringify(payload), { status, headers });
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * POST /api/batch
 * Body: { addresses: string[] }
 * Returns BatchScore[] (or { results }) for discovery widget / React kit.
 * Free local scoring path — no x402 (Phase 2b).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = clientIp(req);
  const slot = takeRateSlot(ip);
  if (!slot.ok) {
    return json({ error: "rate_limited" }, 429, {
      "Retry-After": String(slot.retryAfter),
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const addresses = (body as { addresses?: unknown })?.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return json({ error: "addresses_required" }, 400);
  }
  if (addresses.length > MAX_ADDRESSES) {
    return json(
      { error: "too_many_addresses", max: MAX_ADDRESSES },
      400
    );
  }
  if (!addresses.every((a) => typeof a === "string")) {
    return json({ error: "invalid_addresses" }, 400);
  }

  try {
    const results = await scoreTokenBatch(addresses as string[]);
    return json(results, 200);
  } catch (err) {
    console.error("[batch]", err);
    return json(
      {
        error: "batch_failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      502
    );
  }
}
