"use client";

import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { arc, RPC_URL } from "./chain";

export const config = createConfig(
  getDefaultConfig({
    chains: [arc],
    transports: {
      [arc.id]: http(RPC_URL),
    },
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "",
    appName: "TrustGate",
    appDescription: "Trust-gated USDC payment gateway for AI agents",
    enableAaveAccount: false,
  })
);
