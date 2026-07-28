import { NextRequest, NextResponse } from "next/server";
import {
  ContractInfo,
  detectContractKind,
  isVerifiedIssuer,
  scoreContract,
} from "@/lib/contract-scoring";
import { assembleAndScoreNft } from "@/lib/nft-contract";

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

async function enrichTokenScore(
  rawAddress: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { analyzeTokenTemporal } = await import(
    "@/lib/token-behavior/temporal"
  );
  const { markCoordinatedExitParticipants } = await import(
    "@/lib/token-behavior/wallet-marks"
  );
  const { deployerStakingBoost } = await import("@/lib/staking/signals");
  const {
    confidenceEnumToNumber,
    recordIntelligence,
  } = await import("@/lib/trust-intelligence/snapshots");
  const { SCORING_VERSION } = await import("@/lib/scoring-version");
  const { detectContractKind } = await import("@/lib/contract-scoring");

  const temporal = await analyzeTokenTemporal(rawAddress);
  let detectionCreator: string | null = null;
  try {
    const det = await detectContractKind(rawAddress);
    detectionCreator = det.info?.creatorAddress ?? null;
  } catch {
    // ignore
  }
  const staking = await deployerStakingBoost(detectionCreator);

  const baseScore =
    typeof payload.score === "number" ? payload.score : 50;
  let score = Math.max(
    0,
    Math.min(100, Math.round(baseScore + temporal.scoreDelta + staking.boost))
  );

  const upstreamFlags = Array.isArray(payload.flags)
    ? (payload.flags as unknown[]).map(String)
    : [];
  const flags = [
    ...new Set([...upstreamFlags, ...temporal.flags, ...staking.flags]),
  ];

  if (flags.includes("EXIT_SYNC") && temporal.exitParticipants.length > 0) {
    markCoordinatedExitParticipants(rawAddress, temporal.exitParticipants);
  }

  const confidence = confidenceEnumToNumber(
    (payload.confidence as string | number | undefined) ??
      (temporal.metrics.transferSample >= 20 ? "HIGH" : "MEDIUM")
  );

  const tier =
    typeof payload.tier === "string"
      ? payload.tier
      : score >= 80
        ? "HIGH_ELITE"
        : score >= 60
          ? "HIGH"
          : score >= 40
            ? "MEDIUM"
            : "LOW";

  const observations = [...temporal.observations, ...staking.observations];
  const intel = recordIntelligence({
    subject: rawAddress,
    subjectType: "token",
    score,
    tier,
    confidence,
    flags,
    scoringVersion: SCORING_VERSION,
    observations,
  });
  const { buildExplainability } = await import(
    "@/lib/trust-intelligence/explainability"
  );
  const explain = buildExplainability({
    score,
    tier,
    confidence: intel.confidence,
    flags,
    observations,
    scoreStability: intel.scoreStability,
    directionDrivers: intel.directionDrivers,
    subjectType: "token",
  });

  return {
    ...payload,
    score,
    tier,
    confidence: intel.confidence,
    flags,
    summary: intel.summary,
    publicExplain: explain.public,
    protocolExplain: explain.protocol,
    scoreStability: intel.scoreStability,
    directionDrivers: intel.directionDrivers,
    snapshotId: intel.snapshotId,
    scoringVersion: SCORING_VERSION,
    queriedAt: intel.queriedAt,
    temporal: temporal.metrics,
  };
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

  // Phase 3: enrich successful paid score responses with temporal intelligence
  if (
    upstream.status === 200 &&
    req.method === "GET" &&
    (headers.get("content-type") ?? "").toLowerCase().includes("application/json")
  ) {
    try {
      const text = new TextDecoder().decode(body);
      const parsed: unknown = JSON.parse(text);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        (typeof (parsed as { score?: unknown }).score === "number" ||
          (parsed as { tier?: string }).tier === "VERIFIED")
      ) {
        const enriched = await enrichTokenScore(
          rawAddress,
          parsed as Record<string, unknown>
        );
        const newBody = JSON.stringify(enriched);
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
        "[token-intel] enrich failed, passing upstream:",
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

  // Official issuer tokens skip detection, the upstream VPS oracle forward, and
  // the x402 payment entirely. They get the dedicated VERIFIED tier with no
  // numeric score, before any forwardToTokenOracle call can happen.
  if (isVerifiedIssuer(address)) {
    return jsonResponse({ score: null, tier: "VERIFIED", label: "VERIFIED" }, 200);
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

  if (detection.kind === "nft") {
    if (!detection.info) {
      return jsonResponse(
        { error: "Could not load contract info from Arcscan." },
        502
      );
    }
    // NFT scoring is free — no payment, no Nald oracle. Score locally and
    // return 200 immediately so the client never sees a 402 challenge.
    try {
      const result = await assembleAndScoreNft(
        address,
        {
          isErc721: detection.info.isErc721,
          isErc1155: detection.info.isErc1155,
          isVerified: detection.info.isVerified,
          creatorAddress: detection.info.creatorAddress,
        },
        req.nextUrl.origin
      );
      return jsonResponse(result, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.error(`[nft-score] ${address} failed:`, message);
      return jsonResponse({ error: `NFT scoring failed: ${message}` }, 502);
    }
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
