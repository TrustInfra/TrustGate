import "server-only";
import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Chain,
  type Hex,
} from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { normalize } from "viem/ens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAINS = [
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
] as const;

type ChainName = (typeof SUPPORTED_CHAINS)[number];

const CHAIN_BY_NAME: Record<ChainName, Chain> = {
  ethereum: mainnet,
  base,
  arbitrum,
  optimism,
  polygon,
};

function isChainName(value: string): value is ChainName {
  return (SUPPORTED_CHAINS as readonly string[]).includes(value);
}

function isHexAddress(value: string): value is Hex {
  return ADDRESS_RE.test(value);
}

function isEnsName(value: string): boolean {
  return value.toLowerCase().endsWith(".eth") && value.length > 4;
}

function transportFor(chainName: ChainName) {
  if (chainName === "ethereum") {
    const url = process.env.MAINNET_RPC_URL?.trim();
    return url ? http(url) : http();
  }
  if (chainName === "base") {
    const url = process.env.BASE_RPC_URL?.trim();
    return url ? http(url) : http();
  }
  return http();
}

function publicClient(chainName: ChainName) {
  return createPublicClient({
    chain: CHAIN_BY_NAME[chainName],
    transport: transportFor(chainName),
  });
}

function roundTo(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function sanitizeDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : "unknown error";
  const stripped = raw
    .replace(/https?:\/\/[^\s]+/gi, "[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted]");
  return stripped.slice(0, 160);
}

export async function GET(req: NextRequest) {
  const chainRaw = req.nextUrl.searchParams.get("chain")?.trim() ?? "";
  if (!isChainName(chainRaw)) {
    return NextResponse.json(
      { error: "unsupported_chain", supported: [...SUPPORTED_CHAINS] },
      { status: 400 }
    );
  }

  const addressRaw = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  const ensInput = isEnsName(addressRaw) ? addressRaw : null;
  if (!isHexAddress(addressRaw) && ensInput === null) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  const chain = CHAIN_BY_NAME[chainRaw];

  try {
    let resolved: Hex;
    if (ensInput !== null) {
      const ensClient = publicClient("ethereum");
      const fromEns = await ensClient.getEnsAddress({
        name: normalize(ensInput),
      });
      if (!fromEns) {
        return NextResponse.json({ error: "ens_not_resolved" }, { status: 400 });
      }
      resolved = fromEns;
    } else {
      resolved = addressRaw as Hex;
    }

    const checksummed = getAddress(resolved);
    const client = publicClient(chainRaw);
    const balanceRaw = await client.getBalance({ address: checksummed });
    const decimals = chain.nativeCurrency.decimals;
    const symbol = chain.nativeCurrency.symbol;
    const balance = roundTo(Number(formatUnits(balanceRaw, decimals)), 6);
    const summaryBalance = roundTo(balance, 4).toFixed(4);

    return NextResponse.json({
      intent: "WALLET_BALANCE_CHECK",
      address: checksummed,
      ens: ensInput,
      chain: chainRaw,
      chain_id: chain.id,
      token: null,
      symbol,
      balance,
      balance_raw: balanceRaw.toString(),
      decimals,
      summary: `${checksummed} holds ${summaryBalance} ${symbol} on ${chainRaw}.`,
      confidence: 0.98,
      source: "eth_getBalance over public RPC",
      as_of: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "balance_lookup_failed", detail: sanitizeDetail(err) },
      { status: 502 }
    );
  }
}
