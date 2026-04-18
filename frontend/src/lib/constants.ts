import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const CONTRACT_ADDRESSES = {
  trustScoring: "0xEb979Dc25396ba4be6cEA41EAfEa894C55772246" as const,
  agentRegistry: "0x73d3cf7f2734C334927f991fe87D06d595d398b4" as const,
  trustGate: "0x52E17bC482d00776d73811680CbA9914e83E33CC" as const,
  usdc: "0x3600000000000000000000000000000000000000" as const,
};

export const USDC_DECIMALS = 6;

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

export const EXPLORER_URL = "https://testnet.arcscan.app";
