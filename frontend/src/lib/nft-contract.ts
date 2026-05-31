import "server-only";

// Assembles an NftScoreInput from Arcscan / Arc RPC data and scores it with
// scoreNft. Kept separate from nft-scoring.ts so the scoring module stays a
// pure, dependency-free function. Used by both the standalone NFT route and
// the server-side token router.

import { scoreNft, NftScoreInput, NftScoreResult } from "./nft-scoring";

const ARCSCAN_API = "https://testnet.arcscan.app";

// Server-only scoring constant (no NEXT_PUBLIC_ prefix), read via Number().
// Window size for the holder-concentration signal: how many top holders feed
// topThreeHolderPct. Unlike a cap or gate, an extreme fallback would corrupt
// the calculation (0 disables the signal, a huge value sums every holder and
// over-fires concentration), so the fallback preserves current behavior at 3.
const TOP_HOLDER_WINDOW = Number(process.env.SCORING_NFT_TOP_HOLDER_WINDOW ?? 3);

interface ArcscanTokenInfo {
  holders?: string | number | null;
  holders_count?: string | number | null;
  total_supply?: string | number | null;
  type?: string | null;
}

interface ArcscanHolder {
  value?: string | null;
}

interface ArcscanHoldersPage {
  items?: ArcscanHolder[] | null;
}

interface DeployerScoreResponse {
  tier?: string | null;
}

export interface NftContractInfo {
  isErc721: boolean;
  isErc1155: boolean;
  isVerified: boolean;
  creatorAddress: string | null;
}

async function arcscanGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ARCSCAN_API}${path}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function toInt(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function mapDeployerTier(tier: string | null): NftScoreInput["deployerTier"] {
  if (tier === "HIGH_ELITE") return "HIGH_ELITE";
  if (tier === "HIGH") return "HIGH";
  if (tier === "MEDIUM") return "MEDIUM";
  // BLOCKED / LOW / unknown all collapse to the lowest credibility.
  return "LOW";
}

async function fetchDeployerTier(
  origin: string,
  deployer: string
): Promise<string | null> {
  // The internal /api/arc-score proxy uses the same tier vocabulary and is not
  // paywalled, so it is safe to call server-side.
  try {
    const res = await fetch(`${origin}/api/arc-score/${deployer}`, {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as DeployerScoreResponse;
    return data.tier ?? null;
  } catch {
    return null;
  }
}

function topThreeHolderPct(
  holders: ArcscanHolder[],
  totalSupply: number
): number {
  if (totalSupply <= 0) return 0;
  // Blockscout returns holders sorted by balance descending, so the first
  // three are the largest.
  const top3 = holders
    .slice(0, TOP_HOLDER_WINDOW)
    .reduce((sum, h) => sum + toInt(h.value), 0);
  const pct = (top3 / totalSupply) * 100;
  if (!Number.isFinite(pct)) return 0;
  return Math.max(0, Math.min(100, pct));
}

export async function assembleAndScoreNft(
  address: string,
  info: NftContractInfo,
  origin: string
): Promise<NftScoreResult> {
  const [token, holdersPage, deployerTierRaw] = await Promise.all([
    arcscanGet<ArcscanTokenInfo>(`/api/v2/tokens/${address}`),
    arcscanGet<ArcscanHoldersPage>(`/api/v2/tokens/${address}/holders`),
    info.creatorAddress
      ? fetchDeployerTier(origin, info.creatorAddress)
      : Promise.resolve<string | null>(null),
  ]);

  const uniqueHolders = toInt(token?.holders ?? token?.holders_count);
  const totalSupply = toInt(token?.total_supply);
  const holders = holdersPage?.items ?? [];

  const input: NftScoreInput = {
    contractAddress: address,
    isErc721: info.isErc721,
    isErc1155: info.isErc1155,
    isVerified: info.isVerified,
    uniqueHolders,
    totalSupply,
    // TODO: compute from Arcscan floor-price history when available. No floor
    // feed on Arc testnet yet, so report null (no data, no penalty).
    floorPriceDirection: null,
    // TODO: classify from recent trader quality when Arcscan exposes it.
    tradingVolumeQuality: "mixed",
    // TODO: classify from on-chain royalty payouts when available.
    creatorRoyaltyBehavior: "none",
    deployerTier: mapDeployerTier(deployerTierRaw),
    // TODO: detect same-wallet buy/sell pairs within 24h from transfer
    // history when Arcscan exposes a usable transfer feed.
    washTradingDetected: false,
    topThreeHolderPct: topThreeHolderPct(holders, totalSupply),
    // TODO: detect creator/deployer appearing in recent large sell transfers.
    creatorDumpingDetected: false,
  };

  return scoreNft(input);
}
