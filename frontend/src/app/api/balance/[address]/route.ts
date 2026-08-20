import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, formatUnits, http, type Chain } from "viem";
import { base, mainnet } from "viem/chains";
import { erc20Abi } from "@/lib/abi/ERC20";
import { arcTestnet } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SUPPORTED_CHAIN_IDS = [1, 8453, 5042002] as const;

type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];
type HexAddress = `0x${string}`;

function isHexAddress(value: string): value is HexAddress {
  return ADDRESS_RE.test(value);
}

function parseChainId(raw: string | null): SupportedChainId | null {
  const value = raw == null || raw.trim() === "" ? "8453" : raw.trim();
  if (!/^[0-9]+$/.test(value)) return null;
  const n = Number(value);
  if (n === 1 || n === 8453 || n === 5042002) return n;
  return null;
}

function transportFor(envName: "MAINNET_RPC_URL" | "BASE_RPC_URL") {
  const url = process.env[envName]?.trim();
  return url ? http(url) : http();
}

function chainAndTransport(chainId: SupportedChainId): {
  chain: Chain;
  transport: ReturnType<typeof http>;
} {
  if (chainId === 1) {
    return { chain: mainnet, transport: transportFor("MAINNET_RPC_URL") };
  }
  if (chainId === 8453) {
    return { chain: base, transport: transportFor("BASE_RPC_URL") };
  }
  const arcRpc = arcTestnet.rpcUrls.default.http[0];
  return { chain: arcTestnet, transport: http(arcRpc) };
}

function sanitizeDetail(err: unknown): string {
  const raw = err instanceof Error ? err.message : "unknown error";
  const stripped = raw
    .replace(/https?:\/\/[^\s]+/gi, "[redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[redacted]");
  return stripped.slice(0, 160);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { address: string } }
) {
  const address = params.address;
  if (!isHexAddress(address)) {
    return NextResponse.json(
      { error: "Invalid Ethereum address" },
      { status: 400 }
    );
  }

  const chainId = parseChainId(req.nextUrl.searchParams.get("chainId"));
  if (chainId === null) {
    return NextResponse.json(
      { error: "Unsupported chainId", supported: [...SUPPORTED_CHAIN_IDS] },
      { status: 400 }
    );
  }

  const rawToken = req.nextUrl.searchParams.get("token");
  const tokenParam =
    rawToken == null || rawToken.trim() === "" ? "native" : rawToken.trim();
  const isNative = tokenParam.toLowerCase() === "native";
  if (!isNative && !isHexAddress(tokenParam)) {
    return NextResponse.json(
      { error: "Invalid token address" },
      { status: 400 }
    );
  }

  try {
    const { chain, transport } = chainAndTransport(chainId);
    const client = createPublicClient({ chain, transport });

    let balanceRaw: bigint;
    let decimals: number;
    let token: "native" | HexAddress;

    if (isNative) {
      token = "native";
      decimals = chain.nativeCurrency.decimals;
      balanceRaw = await client.getBalance({ address });
    } else {
      const tokenAddress = tokenParam as HexAddress;
      token = tokenAddress;
      balanceRaw = await client.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      try {
        decimals = await client.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "decimals",
        });
      } catch {
        decimals = 18;
      }
    }

    return NextResponse.json({
      address,
      chainId,
      token,
      decimals,
      balanceRaw: balanceRaw.toString(),
      balanceFormatted: formatUnits(balanceRaw, decimals),
      queriedAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "balance_lookup_failed", detail: sanitizeDetail(err) },
      { status: 502 }
    );
  }
}
