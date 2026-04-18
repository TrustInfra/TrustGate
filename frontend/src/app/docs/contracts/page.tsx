import { ExternalLink, CheckCircle2 } from "lucide-react";
import DocShell from "@/components/docs/DocShell";
import { CONTRACT_ADDRESSES, EXPLORER_URL } from "@/lib/constants";

export const metadata = { title: "Contract Reference — TrustGate Docs" };

function ContractRow({
  name,
  address,
  role,
  constructorArgs,
}: {
  name: string;
  address: string;
  role: string;
  constructorArgs: string;
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
      <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1">
        Constructor args
      </p>
      <pre className="!my-0 !py-2.5 text-[11px]"><code>{constructorArgs}</code></pre>
      <a
        href={`${EXPLORER_URL}/address/${address}#code`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-accent hover:text-accent-hover"
      >
        View source on Arcscan <ExternalLink size={11} />
      </a>
    </div>
  );
}

export default function Contracts() {
  return (
    <DocShell
      eyebrow="Contract Reference"
      title="Deployed on Arc Testnet"
      lede="All three TrustGate contracts are deployed and source-verified on testnet.arcscan.app. Chain id 5042002. Native and settlement asset: USDC (6 decimals)."
    >
      <h2>Addresses</h2>

      <ContractRow
        name="TrustScoringPlaintext"
        role="Oracle-updated trust scores (0-100). Maps scores to HIGH / MEDIUM / LOW tiers."
        address={CONTRACT_ADDRESSES.trustScoring}
        constructorArgs="owner = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62"
      />

      <ContractRow
        name="AgentRegistry"
        role="Permissionless agent enrollment. Tracks Active / Suspended / Deactivated lifecycle."
        address={CONTRACT_ADDRESSES.agentRegistry}
        constructorArgs="owner = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62"
      />

      <ContractRow
        name="TrustGate"
        role="Pooled USDC balances, per-agent allowances, tier-routed claim settlement."
        address={CONTRACT_ADDRESSES.trustGate}
        constructorArgs={`usdc          = ${CONTRACT_ADDRESSES.usdc}
trustScoring  = ${CONTRACT_ADDRESSES.trustScoring}
agentRegistry = ${CONTRACT_ADDRESSES.agentRegistry}
owner         = 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}
      />

      <h2>USDC reference</h2>
      <p>
        Arc Testnet USDC lives at <code>{CONTRACT_ADDRESSES.usdc}</code>. The
        contract uses 6 decimals — do not confuse with 18-decimal native gas.
        Get testnet funds at{" "}
        <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer">
          faucet.circle.com
        </a>
        .
      </p>

      <h2>Network parameters</h2>
      <pre><code>{`Chain ID   : 5042002
Name       : Arc Testnet
RPC        : https://rpc.testnet.arc.network
Explorer   : https://testnet.arcscan.app
Deployer   : 0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}</code></pre>

      <h2>Reproducing verification</h2>
      <p>
        Source is verified through hardhat-verify against Arcscan&apos;s
        Etherscan-compatible endpoint. To re-run:
      </p>
      <pre><code>{`ETHERSCAN_API_KEY=arcscan npx hardhat verify \\
  --network arcTestnet <ADDRESS> <...CTOR_ARGS>`}</code></pre>
      <p>
        Arcscan does not presently issue API keys — any non-empty string is
        accepted. The Etherscan v2 deprecation warning from hardhat-verify is
        benign on this chain.
      </p>
    </DocShell>
  );
}
