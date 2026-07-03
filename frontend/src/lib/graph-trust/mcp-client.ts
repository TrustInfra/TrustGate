import "server-only";
import {
  mergeGraphTrustResults,
  type ExplainTrustResult,
  type PersonalizedTrustResult,
} from "./map-result";
import type { GraphTrust } from "./types";

const MCP_URL =
  process.env.INTUITION_MCP_URL?.replace(/\/+$/, "") ||
  "https://mcp-trust.intuition.box/mcp";

const MCP_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

const DEFAULT_ANCHOR_ADDRESSES = [
  "0x4d4ec2ec39ce77f09ca25502536afdb1a88d8375",
  "0x861d3b379719891dcfd15df2dc7fbcf2093a2012",
];

interface JsonRpcEnvelope {
  jsonrpc?: string;
  id?: number;
  result?: {
    content?: Array<{ type?: string; text?: string }>;
  };
  error?: { code?: number; message?: string; data?: unknown };
}

function parseSseJson(text: string): JsonRpcEnvelope | null {
  const dataLines: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;

  for (let i = dataLines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(dataLines[i]) as JsonRpcEnvelope;
    } catch {
      continue;
    }
  }
  return null;
}

async function mcpPost(
  body: Record<string, unknown>,
  sessionId?: string | null
): Promise<{ sessionId: string | null; envelope: JsonRpcEnvelope | null; status: number }> {
  const headers = { ...MCP_HEADERS };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  const envelope = parseSseJson(text);
  const nextSession = res.headers.get("mcp-session-id") ?? sessionId ?? null;

  return { sessionId: nextSession, envelope, status: res.status };
}

function assertNoRpcError(
  envelope: JsonRpcEnvelope | null,
  context: string
): void {
  if (!envelope?.error) return;
  const message =
    typeof envelope.error.message === "string"
      ? envelope.error.message
      : "Unknown MCP error";
  throw new Error(`${context}: ${message}`);
}

function parseToolText<T>(envelope: JsonRpcEnvelope | null): T {
  const text = envelope?.result?.content?.find((c) => c.type === "text")?.text;
  if (!text) {
    throw new Error("MCP tool response missing text content");
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("MCP tool response was not valid JSON");
  }
}

async function initializeMcpSession(): Promise<string | null> {
  const init = await mcpPost({
    jsonrpc: "2.0",
    id: 0,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "trustgate", version: "1.0" },
    },
  });

  if (init.status < 200 || init.status >= 300) {
    throw new Error(`MCP initialize failed with status ${init.status}`);
  }
  assertNoRpcError(init.envelope, "MCP initialize");

  const sessionId = init.sessionId;
  await mcpPost(
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    sessionId
  );

  return sessionId;
}

async function callMcpTool<T>(
  sessionId: string | null,
  id: number,
  name: string,
  arguments_: Record<string, unknown>
): Promise<T> {
  const tool = await mcpPost(
    {
      jsonrpc: "2.0",
      id,
      method: "tools/call",
      params: { name, arguments: arguments_ },
    },
    sessionId
  );

  if (tool.status < 200 || tool.status >= 300) {
    throw new Error(`MCP ${name} failed with status ${tool.status}`);
  }
  assertNoRpcError(tool.envelope, `MCP ${name}`);

  return parseToolText<T>(tool.envelope);
}

export function resolveAnchorAddresses(
  fromAddress?: string | string[] | null
): string[] {
  if (Array.isArray(fromAddress) && fromAddress.length > 0) {
    return fromAddress.filter(
      (a): a is string => typeof a === "string" && /^0x[0-9a-fA-F]{40}$/.test(a)
    );
  }
  if (typeof fromAddress === "string" && /^0x[0-9a-fA-F]{40}$/.test(fromAddress)) {
    return [fromAddress];
  }

  const envAnchors = process.env.GRAPH_TRUST_ANCHOR_ADDRESSES;
  if (envAnchors) {
    const parsed = envAnchors
      .split(/[,\s]+/)
      .map((a) => a.trim())
      .filter((a) => /^0x[0-9a-fA-F]{40}$/.test(a));
    if (parsed.length > 0) return parsed;
  }

  return DEFAULT_ANCHOR_ADDRESSES;
}

export async function fetchGraphTrustFromMcp(
  toAddress: string,
  fromAddress?: string | string[] | null
): Promise<GraphTrust> {
  const anchors = resolveAnchorAddresses(fromAddress);
  if (anchors.length === 0) {
    throw new Error("No valid truster anchor addresses configured");
  }

  const sessionId = await initializeMcpSession();

  const personalized = await callMcpTool<PersonalizedTrustResult>(
    sessionId,
    1,
    "compute_personalized_trust",
    {
      fromAddress: anchors,
      toAddress,
      maxHops: 3,
    }
  );

  let global: ExplainTrustResult | null = null;
  try {
    global = await callMcpTool<ExplainTrustResult>(
      sessionId,
      2,
      "explain_trust_score",
      { address: toAddress }
    );
  } catch (err) {
    console.warn(
      "[graph-trust] explain_trust_score failed, continuing with path only:",
      err instanceof Error ? err.message : err
    );
  }

  return mergeGraphTrustResults(toAddress, personalized, global);
}