import { createPublicClient, http, type Hash } from "viem";
import { RPC_URL, arc } from "./chain";

const client = createPublicClient({
  chain: arc,
  transport: http(RPC_URL, { timeout: 12_000 }),
});

export type ArcReceiptStatus = "success" | "reverted" | "unknown";

/**
 * Wait for an Arc Mainnet receipt. If the public RPC lags the wallet RPC,
 * return "unknown" so the caller can still send the tx hash to the oracle.
 */
export async function waitArcReceipt(hash: Hash): Promise<ArcReceiptStatus> {
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      confirmations: 1,
      pollingInterval: 400,
      timeout: 20_000,
    });
    return receipt.status === "success" ? "success" : "reverted";
  } catch {
    try {
      const receipt = await client.getTransactionReceipt({ hash });
      if (receipt.status === "success") return "success";
      if (receipt.status === "reverted") return "reverted";
    } catch {
      /* RPC still does not have it */
    }
    return "unknown";
  }
}
