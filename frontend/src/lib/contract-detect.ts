// Isomorphic contract-vs-EOA detection for the Oracle wallet scorer.
// Runs on both the server (api/oracle/[address] route) and the client
// (oracle page pre-check), so the wallet-vs-contract rule lives in one place.
// The Oracle scores wallets (EOAs); contracts belong on Token Shield.

const ARC_RPC_URL = "https://rpc.testnet.arc.network";

// EIP-7702 sets an EOA's code to the delegation designator 0xef0100 || address.
// Such an address is still a wallet, so it must NOT be treated as a contract.
const EIP7702_DELEGATION_PREFIX = "0xef0100";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

async function getCodeOnce(address: string): Promise<string | null> {
  try {
    const res = await fetch(ARC_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getCode",
        params: [address, "latest"],
        id: 1,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: string;
      error?: { message: string };
    };
    if (data.error || typeof data.result !== "string") return null;
    return data.result;
  } catch {
    return null;
  }
}

// One bounded retry. Most RPC failures are transient and clear on a second try.
async function getCode(address: string): Promise<string | null> {
  const first = await getCodeOnce(address);
  if (first !== null) return first;
  await new Promise((r) => setTimeout(r, 250));
  return getCodeOnce(address);
}

export function codeIsContract(code: string): boolean {
  const c = code.toLowerCase();
  if (c === "0x" || c === "0x0") return false; // EOA, no code
  if (c.startsWith(EIP7702_DELEGATION_PREFIX)) return false; // 7702 delegated EOA
  return true; // real deployed bytecode
}

export interface ContractCheck {
  isContract: boolean; // true only when bytecode was positively confirmed
  rpcOk: boolean; // false when the RPC could not be reached (fail-open)
}

export async function isContractAddress(address: string): Promise<ContractCheck> {
  if (!ADDRESS_RE.test(address)) {
    // Not a valid address; leave it to the caller's existing validation.
    return { isContract: false, rpcOk: true };
  }
  const code = await getCode(address);
  if (code === null) {
    // RPC unreachable. Fail open so a transient outage never blocks a real
    // wallet from being scored. The caller logs this.
    return { isContract: false, rpcOk: false };
  }
  return { isContract: codeIsContract(code), rpcOk: true };
}
