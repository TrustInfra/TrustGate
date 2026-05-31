import "server-only";

// frontend/src/lib/nft-scoring.ts
// NFT contract scoring — ERC-721 and ERC-1155
// Free query, scored locally, no oracle required

// Sensitive scoring constants are sourced from server-only environment
// variables (no NEXT_PUBLIC_ prefix) so the thresholds, caps, and band edges
// never ship to the client. Each read is wrapped in Number(). Fallbacks are
// deliberately neutral placeholders, NOT the real production values: caps
// default to no-cap (100), penalties to zero effect, and band/gate thresholds
// to values so extreme the band or flag effectively never fires. A missing-env
// deploy therefore degrades to obviously-neutered scoring rather than leaking
// values.
const WASH_TRADING_CAP = Number(process.env.SCORING_NFT_WASH_TRADING_CAP ?? 100);
const CREATOR_DUMPING_CAP = Number(process.env.SCORING_NFT_CREATOR_DUMPING_CAP ?? 100);
const HOLDER_CONCENTRATION_PCT = Number(process.env.SCORING_NFT_HOLDER_CONCENTRATION_PCT ?? 999);
const HOLDER_CONCENTRATION_PENALTY = Number(process.env.SCORING_NFT_HOLDER_CONCENTRATION_PENALTY ?? 0);

// Unique-holder-ratio band edges (uniqueHolders / totalSupply). Higher ratio is
// better, so a missing edge defaults extreme-high and the band never matches,
// awarding zero rather than inflating the score.
const HOLDER_RATIO_HIGH = Number(process.env.SCORING_NFT_HOLDER_RATIO_HIGH ?? 999);
const HOLDER_RATIO_MEDIUM = Number(process.env.SCORING_NFT_HOLDER_RATIO_MEDIUM ?? 999);
const HOLDER_RATIO_LOW = Number(process.env.SCORING_NFT_HOLDER_RATIO_LOW ?? 999);

// Confidence unique-holder thresholds. Missing values default extreme-high so
// the HIGH and MEDIUM gates never fire and confidence degrades to LOW.
const CONFIDENCE_HIGH_INTERACTORS = Number(process.env.SCORING_NFT_CONFIDENCE_HIGH_INTERACTORS ?? 99999);
const CONFIDENCE_LOW_INTERACTORS = Number(process.env.SCORING_NFT_CONFIDENCE_LOW_INTERACTORS ?? 99999);

export type NftScoreInput = {
  contractAddress: string;
  isErc721: boolean;
  isErc1155: boolean;
  isVerified: boolean;
  uniqueHolders: number;
  totalSupply: number;
  floorPriceDirection: "stable" | "growing" | "volatile" | "declining" | null; // null = under 30 days, insufficient data
  tradingVolumeQuality: "majority_high" | "mixed" | "majority_low";
  creatorRoyaltyBehavior: "consistent" | "none" | "manipulated";
  deployerTier: "HIGH_ELITE" | "HIGH" | "MEDIUM" | "LOW";
  washTradingDetected: boolean;
  topThreeHolderPct: number; // 0-100
  creatorDumpingDetected: boolean;
};

export type NftScoreResult = {
  score: number;
  tier: "LOW" | "MEDIUM" | "HIGH" | "HIGH_ELITE";
  flags: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  label: "NFT SCORE";
};

// 1. Unique Holder Ratio (0-25 points)
function scoreHolderRatio(uniqueHolders: number, totalSupply: number): number {
  if (totalSupply === 0) return 0;
  const ratio = uniqueHolders / totalSupply;
  if (ratio >= HOLDER_RATIO_HIGH) return 25;
  if (ratio >= HOLDER_RATIO_MEDIUM) return 15;
  if (ratio >= HOLDER_RATIO_LOW) return 5;
  return 0;
}

// 2. Deployer Credibility (0-25 points)
function scoreDeployer(tier: NftScoreInput["deployerTier"]): number {
  if (tier === "HIGH_ELITE") return 25;
  if (tier === "HIGH") return 18;
  if (tier === "MEDIUM") return 10;
  return 0;
}

// 3. Floor Price Stability (0-20 points)
function scoreFloorPrice(
  direction: NftScoreInput["floorPriceDirection"]
): number {
  if (direction === null) return 0; // no data, no penalty
  if (direction === "stable" || direction === "growing") return 20;
  return 0; // volatile or declining
}

// 4. Trading Volume Quality (0-15 points)
function scoreVolumeQuality(
  quality: NftScoreInput["tradingVolumeQuality"]
): number {
  if (quality === "majority_high") return 15;
  if (quality === "mixed") return 8;
  return 0;
}

// 5. Creator Royalty Behavior (0-10 points)
function scoreRoyalty(
  behavior: NftScoreInput["creatorRoyaltyBehavior"]
): number {
  if (behavior === "consistent") return 10;
  if (behavior === "none") return 5;
  return 0;
}

// 6. Verification Status (±5 points)
function scoreVerification(isVerified: boolean): number {
  return isVerified ? 5 : -5;
}

function tierFor(score: number): NftScoreResult["tier"] {
  if (score <= 39) return "LOW";
  if (score <= 59) return "MEDIUM";
  if (score <= 79) return "HIGH";
  return "HIGH_ELITE";
}

function computeConfidence(input: NftScoreInput): NftScoreResult["confidence"] {
  if (
    input.uniqueHolders >= CONFIDENCE_HIGH_INTERACTORS &&
    (input.deployerTier === "HIGH" || input.deployerTier === "HIGH_ELITE") &&
    input.floorPriceDirection !== null
  ) {
    return "HIGH";
  }
  if (input.uniqueHolders >= CONFIDENCE_LOW_INTERACTORS || input.deployerTier === "MEDIUM") {
    return "MEDIUM";
  }
  return "LOW";
}

export function scoreNft(input: NftScoreInput): NftScoreResult {
  const raw =
    scoreHolderRatio(input.uniqueHolders, input.totalSupply) +
    scoreDeployer(input.deployerTier) +
    scoreFloorPrice(input.floorPriceDirection) +
    scoreVolumeQuality(input.tradingVolumeQuality) +
    scoreRoyalty(input.creatorRoyaltyBehavior) +
    scoreVerification(input.isVerified);

  // Clamp to 0-100 before applying flags.
  let score = Math.max(0, Math.min(100, raw));
  const flags: string[] = [];

  // Risk flags, applied in order.
  if (input.washTradingDetected) {
    score = Math.min(score, WASH_TRADING_CAP);
    flags.push("WASH_TRADING");
  }
  if (input.topThreeHolderPct >= HOLDER_CONCENTRATION_PCT) {
    score = Math.max(0, score - HOLDER_CONCENTRATION_PENALTY);
    flags.push("HOLDER_CONCENTRATION");
  }
  if (input.creatorDumpingDetected) {
    score = Math.min(score, CREATOR_DUMPING_CAP);
    flags.push("CREATOR_DUMPING");
  }

  return {
    score,
    tier: tierFor(score),
    flags,
    confidence: computeConfidence(input),
    label: "NFT SCORE",
  };
}
