"use client";

import { useEffect, useRef } from "react";
import { WagmiProvider, useAccount, useChainId, useSwitchChain } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/lib/config";
import { arc } from "@/lib/chain";
import { ensureArcMainnet } from "@/lib/ensure-arc";

const queryClient = new QueryClient();

function AutoSwitchArc() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const lastTry = useRef("");

  useEffect(() => {
    if (!isConnected || !address) {
      lastTry.current = "";
      return;
    }
    if (chainId === arc.id) return;
    const key = `${address}:${chainId}`;
    if (lastTry.current === key) return;
    lastTry.current = key;
    void ensureArcMainnet({ chainId, switchChainAsync }).catch(() => {
      /* user rejected; query/stake will retry */
    });
  }, [isConnected, address, chainId, switchChainAsync]);

  return null;
}

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          options={{ initialChainId: arc.id }}
          customTheme={{
            "--ck-font-family": "var(--font-body), system-ui, sans-serif",
            "--ck-body-background": "#141414",
            "--ck-body-background-secondary": "#1a1a1a",
            "--ck-body-background-tertiary": "#0a0a0a",
            "--ck-body-color": "#f5f5f5",
            "--ck-body-color-muted": "#71717a",
            "--ck-primary-button-background": "#10d9a0",
            "--ck-primary-button-hover-background": "#0ec090",
            "--ck-focus-color": "#10d9a0",
            "--ck-modal-box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            "--ck-overlay-background": "rgba(0, 0, 0, 0.7)",
            "--ck-border-radius": "12px",
          }}
        >
          <AutoSwitchArc />
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
