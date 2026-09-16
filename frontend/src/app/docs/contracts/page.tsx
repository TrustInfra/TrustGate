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
      title="Deployed on Arc"
      lede="TrustGate contracts on Arc Mainnet. Chain ID 5042. Settlement asset is Circle USDC at 6 decimals."
    >
      <h2>Network parameters</h2>
      <pre><code>{`Chain ID   : 5042
Name       : Arc
RPC        : https://rpc.mainnet.arc.io
Explorer   : https://explorer.arc.io
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
        name="SubjectStake"
        role="Lock USDC for or against any subject (wallet, token, social, website, URI). 7-day unbond."
        address={CONTRACT_ADDRESSES.subjectStake}
        constructorArgs={`usdc         = ${CONTRACT_ADDRESSES.usdc}
initialOwner = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}
      />

      <ContractRow
        name="USDC (ERC-20)"
        role="Circle USDC on Arc, 6 decimals. The settlement asset for every claim and the gas token for every transaction."
        address={CONTRACT_ADDRESSES.usdc}
      />

      <h2>Reproducing verification</h2>
      <p>
        Source verification runs through hardhat-verify against the
        Etherscan-compatible endpoint Arcscan exposes. To verify a fresh
        deployment:
      </p>
      <pre><code>{`ETHERSCAN_API_KEY=arcscan npx hardhat verify \\
  --network arcMainnet <ADDRESS> <...CTOR_ARGS>`}</code></pre>
      <p>
        Verification depends on the explorer API being public. If
        explorer.arc.io is gated, skip verify until Circle opens it.
      </p>

      <h2>Gas</h2>
      <p>
        Arc uses USDC as the native gas token. Fund the deployer with real
        USDC on chain 5042. Transactions with maxFeePerGas below 20 gwei are
        dropped by the mempool. The same balance covers gas and claims —
        there is no second currency.
      </p>
    </DocShell>
  );
}
