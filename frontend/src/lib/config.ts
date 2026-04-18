"use client";

import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { arcTestnet } from "./constants";

export const config = createConfig(
  getDefaultConfig({
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    appName: "TrustGate",
    appDescription: "Trust-gated USDC payment gateway for AI agents",
    enableAaveAccount: false,
  })
);
