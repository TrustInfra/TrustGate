import { defineChain } from "viem";

/**
 * Arc Mainnet — production chain for trustgated.xyz.
 * Official values: https://docs.arc.io/integrate/connect-to-arc
 */
export const arc = defineChain({
  id: 5042,
  name: "Arc",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [rpcUrl()] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
});

/** Staging only. Not used by the production wagmi config. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" },
  },
  testnet: true,
});

function rpcUrl(): string {
  const fromEnv =
    typeof process !== "undefined"
      ? process.env.ARC_RPC_URL?.trim() ||
        process.env.NEXT_PUBLIC_ARC_RPC_URL?.trim()
      : "";
  return fromEnv || "https://rpc.mainnet.arc.io";
}

function indexerBase(): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.ARC_INDEXER_BASE?.trim() : "";
  // Official explorer.arc.io is not a public API. Arcscan REST is.
  return fromEnv || "https://api.arc-scan.org";
}

export const CHAIN_ID = arc.id;
export const RPC_URL = rpcUrl();
export const EXPLORER_URL = "https://explorer.arc.io";
export const INDEXER_BASE = indexerBase();
export const X402_NETWORK = "Arc";

export const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

export const USDC_DECIMALS = 6;

/** Circle-issued tokens on Arc Mainnet. Exact-match, lowercase. */
export const VERIFIED_ISSUER_ADDRESSES = [
  "0x3600000000000000000000000000000000000000", // USDC
  "0xbef5f6d51cb62b58e6a8f77868681825c6fe21c1", // EURC
  "0x8a5d989bbb96929f689b0200f435f53da42bf490", // USYC
] as const;

/** Arc Mainnet deployment. See deployments/arcMainnet-addresses.json. */
export const CONTRACT_ADDRESSES = {
  trustScoring: "0x1c0fDF6Bcf927824113271FccECb007fC43B41ee" as const,
  agentRegistry: "0xF27f123D4b3148811d65E4b8AF02bf0767e944e5" as const,
  trustGate: "0xD7f66981364be30D42D7cA5373d690FEa1045628" as const,
  subjectStake: "0xF3713C3434B712C947bb849b4c4d81Ea539189aE" as const,
  usdc: USDC_ADDRESS,
};

export const TRUST_TIERS = {
  HIGH: { value: 2, min: 75, label: "High Trust", color: "tier-high" },
  MEDIUM: { value: 1, min: 40, label: "Medium Trust", color: "tier-medium" },
  LOW: { value: 0, min: 0, label: "Low Trust", color: "tier-low" },
} as const;

export const CLAIM_STATUS = {
  0: "None",
  1: "Pending",
  2: "Released",
  3: "Cancelled",
} as const;

export const DELAY_PERIOD_SECONDS = 24 * 60 * 60;

/** Arc mempool drops maxFeePerGas below 20 gwei. Send headroom above base. */
export const ARC_MIN_MAX_FEE_PER_GAS_WEI = 50n * 1_000_000_000n;
export const ARC_MIN_PRIORITY_FEE_WEI = 2n * 1_000_000_000n;
