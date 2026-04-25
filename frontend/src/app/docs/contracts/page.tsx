import { ExternalLink, CheckCircle2 } from "lucide-react";
import DocShell from "@/components/docs/DocShell";
import { CONTRACT_ADDRESSES, EXPLORER_URL } from "@/lib/constants";

export const metadata = { title: "Contracts — TrustGate Docs" };

function ContractRow({
  name,
  address,
  role,
  constructorArgs,
}: {
  name: string;
  address: string;
  role: string;
  constructorArgs?: string;
}) {
  return (
    <div className="card-static p-5 mb-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <h3 className="text-sm font-display font-bold text-text">{name}</h3>
          <p className="text-xs text-text-muted mt-0.5">{role}</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-tier-high-muted text-tier-high border border-tier-high/20 shrink-0">
          <CheckCircle2 size={10} /> Verified
        </span>
      </div>
      <p className="text-[11px] font-mono text-text break-all mb-3">
        {address}
      </p>
      {constructorArgs && (
        <>
          <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
            Constructor args
          </p>
          <pre className="!my-0 !py-2.5 text-[11px]">
            <code>{constructorArgs}</code>
          </pre>
        </>
      )}
      <a
        href={`${EXPLORER_URL}/address/${address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover"
      >
        View on Arcscan <ExternalLink size={11} />
      </a>
    </div>
  );
}

export default function Contracts() {
  return (
    <DocShell
      eyebrow="Contracts"
      title="Deployed on Arc Testnet"
      lede="All TrustGate contracts are live and source-verified on Arcscan. Chain ID 5042002. Settlement asset is Circle USDC at 6 decimals."
    >
      <h2>Network parameters</h2>
      <pre><code>{`Chain ID   : 5042002
Name       : Arc Testnet
RPC        : https://rpc.testnet.arc.network
Explorer   : https://testnet.arcscan.app
Gas asset  : USDC (used as native)
Deployer   : 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}</code></pre>

      <h2>Contracts</h2>

      <ContractRow
        name="TrustGate"
        role="Pooled USDC ledger and tier-routed claim settlement. The user-facing entry point for both depositors and agents."
        address={CONTRACT_ADDRESSES.trustGate}
        constructorArgs={`usdc          = ${CONTRACT_ADDRESSES.usdc}
trustScoring  = ${CONTRACT_ADDRESSES.trustScoring}
agentRegistry = ${CONTRACT_ADDRESSES.agentRegistry}
owner         = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}
      />

      <ContractRow
        name="AgentRegistry"
        role="Permissionless agent enrollment with Active / Suspended / Deactivated lifecycle. msg.sender becomes agent owner."
        address={CONTRACT_ADDRESSES.agentRegistry}
        constructorArgs="initialOwner = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62"
      />

      <ContractRow
        name="TrustScoringPlaintext"
        role="Onchain trust scores (uint64) with HIGH / MEDIUM / LOW tier lookups. Plaintext on Arc; FHE variant exists for Zama-compatible chains."
        address={CONTRACT_ADDRESSES.trustScoring}
        constructorArgs="initialOwner = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62"
      />

      <ContractRow
        name="USDC (ERC-20)"
        role="Circle USDC on Arc Testnet, 6 decimals. The settlement asset for every claim and the gas token for every transaction."
        address={CONTRACT_ADDRESSES.usdc}
      />

      <h2>Reproducing verification</h2>
      <p>
        Source verification runs through hardhat-verify against the
        Etherscan-compatible endpoint Arcscan exposes. To verify a fresh
        deployment:
      </p>
      <pre><code>{`ETHERSCAN_API_KEY=arcscan npx hardhat verify \\
  --network arcTestnet <ADDRESS> <...CTOR_ARGS>`}</code></pre>
      <p>
        Arcscan does not currently issue API keys — any non-empty string is
        accepted. The Etherscan v2 deprecation warning printed by
        hardhat-verify is benign on this chain.
      </p>

      <h2>Faucet</h2>
      <p>
        Get testnet USDC from{" "}
        <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
          faucet.circle.com
        </a>
        . The same balance covers gas and claims — there is no second
        currency to request.
      </p>
    </DocShell>
  );
}
