"use client";

import { arc, EXPLORER_URL, RPC_URL } from "./chain";

const ADD_CHAIN_PARAMS = {
  chainId: `0x${arc.id.toString(16)}`,
  chainName: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: [RPC_URL],
  blockExplorerUrls: [EXPLORER_URL],
};

/**
 * Switch the injected wallet to Arc Mainnet (5042). If the wallet does not
 * have that network, add it first. Testnet 5042002 is not accepted.
 */
export async function ensureArcMainnet(opts: {
  chainId: number;
  switchChainAsync: (args: { chainId: number }) => Promise<unknown>;
  addChain?: (params: typeof ADD_CHAIN_PARAMS) => Promise<unknown>;
}): Promise<void> {
  if (opts.chainId === arc.id) return;
  try {
    await opts.switchChainAsync({ chainId: arc.id });
    return;
  } catch {
    /* wallet may not know 5042 yet */
  }
  if (opts.addChain) {
    await opts.addChain(ADD_CHAIN_PARAMS);
  } else if (typeof window !== "undefined") {
    const eth = (
      window as unknown as {
        ethereum?: {
          request: (args: { method: string; params?: unknown }) => Promise<unknown>;
        };
      }
    ).ethereum;
    if (!eth) {
      throw new Error("Add Arc Mainnet (chain ID 5042) in your wallet, then retry.");
    }
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [ADD_CHAIN_PARAMS],
    });
  }
  await opts.switchChainAsync({ chainId: arc.id });
}
