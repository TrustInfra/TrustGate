"use client";

import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectKitProvider } from "connectkit";
import { config } from "@/lib/config";

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider
          mode="dark"
          customTheme={{
            "--ck-font-family": "var(--font-body), system-ui, sans-serif",
            "--ck-body-background": "#141414",
            "--ck-body-background-secondary": "#1a1a1a",
            "--ck-body-background-tertiary": "#0a0a0a",
            "--ck-body-color": "#f5f5f5",
            "--ck-body-color-muted": "#71717a",
            "--ck-primary-button-background": "#3b82f6",
            "--ck-primary-button-hover-background": "#2563eb",
            "--ck-focus-color": "#3b82f6",
            "--ck-modal-box-shadow": "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            "--ck-overlay-background": "rgba(0, 0, 0, 0.7)",
            "--ck-border-radius": "12px",
          }}
        >
          {children}
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
