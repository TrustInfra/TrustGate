import { NextRequest, NextResponse } from "next/server";

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

// Cache only the read-only stats endpoint so RPC rate limits don't fail it.
// Payment/POST flows must never be cached or retried, so this is scoped tightly.
const ORACLE_STATS_CACHE_TTL_MS = 60 * 1000;

interface OracleStatsCacheEntry {
  body: ArrayBuffer;
  status: number;
  statusText: string;
  contentType: string | null;
  at: number;
}

let oracleStatsCache: OracleStatsCacheEntry | null = null;

function buildUpstreamUrl(path: string[], search: string): string {
  const safe = path.map((seg) => encodeURIComponent(seg)).join("/");
  return `${ORACLE_BASE}/${safe}${search}`;
}

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

function isStatsRequest(segments: string[], search: string): boolean {
  return (
    search === "" &&
    segments.length === 2 &&
    segments[0] === "oracle" &&
    segments[1] === "stats"
  );
}

function buildStatsCacheResponse(entry: OracleStatsCacheEntry): NextResponse {
  const headers = new Headers();
  if (entry.contentType) {
    headers.set("content-type", entry.contentType);
  }
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  headers.set("Cache-Control", "no-store");
  headers.set("X-Cache", "HIT");
  return new NextResponse(entry.body, {
    status: entry.status,
    statusText: entry.statusText,
    headers,
  });
}

// Retry once after a 1s delay so a transient upstream/RPC failure doesn't
// surface as an error. Only used for idempotent (GET/HEAD) requests.
async function fetchWithRetry(
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return await fetch(url, init);
  }
}

async function proxy(
  req: NextRequest,
  context: { params: { path?: string[] } }
): Promise<NextResponse> {
  const segments = context.params.path ?? [];
  const url = buildUpstreamUrl(segments, req.nextUrl.search);
  const isIdempotent = req.method === "GET" || req.method === "HEAD";
  const cacheable =
    req.method === "GET" && isStatsRequest(segments, req.nextUrl.search);

  if (
    cacheable &&
    oracleStatsCache &&
    Date.now() - oracleStatsCache.at < ORACLE_STATS_CACHE_TTL_MS
  ) {
    return buildStatsCacheResponse(oracleStatsCache);
  }

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
    upstream = isIdempotent
      ? await fetchWithRetry(url, init)
      : await fetch(url, init);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json(
      { error: "Oracle proxy failed", detail: message, upstream: url },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const headers = pickResponseHeaders(upstream);
  const body = await upstream.arrayBuffer();

  if (cacheable && upstream.ok) {
    oracleStatsCache = {
      body,
      status: upstream.status,
      statusText: upstream.statusText,
      contentType: upstream.headers.get("content-type"),
      at: Date.now(),
    };
  }

  return new NextResponse(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function GET(
  req: NextRequest,
  context: { params: { path?: string[] } }
): Promise<NextResponse> {
  return proxy(req, context);
}

export async function POST(
  req: NextRequest,
  context: { params: { path?: string[] } }
): Promise<NextResponse> {
  return proxy(req, context);
}

export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
