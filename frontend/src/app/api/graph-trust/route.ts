import { NextRequest, NextResponse } from "next/server";
import { fetchGraphTrustFromMcp } from "@/lib/graph-trust/mcp-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

function parseFromParam(
  raw: string | null
): string | string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(/[,\s]+/)
    .map((p) => p.trim())
    .filter((p) => ADDRESS_RE.test(p));
  if (parts.length === 0) return undefined;
  return parts.length === 1 ? parts[0] : parts;
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

function upstreamError(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 502 });
}

async function handleQuery(
  address: string | null | undefined,
  fromAddress?: string | string[] | null
): Promise<NextResponse> {
  if (!address || !ADDRESS_RE.test(address)) {
    return badRequest("A valid 0x address is required");
  }

  try {
    const graphTrust = await fetchGraphTrustFromMcp(address, fromAddress);
    return NextResponse.json(graphTrust, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Graph trust upstream failed";
    console.error("[graph-trust] proxy error:", message);
    return upstreamError(message);
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const address = req.nextUrl.searchParams.get("address");
  const fromAddress = parseFromParam(req.nextUrl.searchParams.get("from"));
  return handleQuery(address, fromAddress);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { address?: string; fromAddress?: string | string[] } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return badRequest("Request body must be JSON");
  }
  return handleQuery(body.address, body.fromAddress);
}