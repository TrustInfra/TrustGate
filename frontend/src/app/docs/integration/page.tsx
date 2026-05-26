import Link from "next/link";
import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Integration — TrustGate Docs" };

const ORACLE_URL =
  process.env.NEXT_PUBLIC_ORACLE_URL ?? "https://your-oracle-host.example.com";

export default function IntegrationPage() {
  return (
    <DocShell
      eyebrow="Integration"
      title="Integrating TrustGate"
      lede="Two ways to consume TrustGate. Read trust scores from the public oracle to gate agent-to-agent commerce in your own protocol, or call the contracts directly from another contract or backend."
    >
      <h2>Pattern 1 — Oracle-as-a-service</h2>
      <p>
        Hit the public oracle, settle 0.001 USDC per query, get a typed
        score back. Best for off-chain agents and backend services that
        need to gate behaviour on counterparty trust.
      </p>

      <h3>TypeScript / Node</h3>
      <pre><code>{`import { fetch } from "undici";

const ORACLE = process.env.NEXT_PUBLIC_ORACLE_URL!;

async function getTrust(address: string) {
  // Step 1 — challenge
  const challenge = await fetch(\`\${ORACLE}/trust/\${address}\`);
  if (challenge.status === 200) return challenge.json();

  if (challenge.status !== 402) {
    throw new Error(\`Oracle error \${challenge.status}\`);
  }

  const requirement = await challenge.json();

  // Step 2 — settle the 0.001 USDC payment on Arc
  const txHash = await sendUsdcToOracle({
    to: requirement.recipient,
    amount: requirement.amount,
    memo: requirement.memo,
  });

  // Step 3 — replay with X-Payment proof
  const paid = await fetch(\`\${ORACLE}/trust/\${address}\`, {
    headers: {
      "X-Payment": Buffer.from(JSON.stringify({ txHash })).toString("base64"),
    },
  });

  return paid.json();
}

const trust = await getTrust("0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62");
if (trust.tier === "HIGH" || trust.tier === "HIGH_ELITE") {
  // proceed instantly
} else if (trust.tier === "MEDIUM") {
  // proceed but expect a 24h hold on settlement
} else {
  // require manual review
}`}</code></pre>

      <p>
        See <Link href="/docs/api-reference">API Reference</Link> for the
        full request and response shapes, including batch scoring up to
        ten addresses in a single payment.
      </p>

      <h2>Pattern 2 — Contract integration</h2>
      <p>
        Call <code>AgentRegistry</code> and <code>TrustScoring</code>{" "}
        directly from your own contract. Suitable for protocols that want
        to gate access at the contract level without depending on an
        offchain oracle.
      </p>

      <h3>Reading a tier from another contract</h3>
      <pre><code>{`interface ITrustScoring {
  function getTrustTierPlaintext(address account) external view returns (uint8);
  function hasScore(address account) external view returns (bool);
}

contract MyProtocol {
  ITrustScoring public immutable trust;

  constructor(address trustAddr) { trust = ITrustScoring(trustAddr); }

  modifier onlyHighTrust(address agent) {
    require(trust.hasScore(agent), "unscored");
    require(trust.getTrustTierPlaintext(agent) >= 2, "not high trust");
    _;
  }
}`}</code></pre>

      <p>
        Tier values are <code>0 = LOW</code>, <code>1 = MEDIUM</code>,{" "}
        <code>2 = HIGH</code>. <code>HIGH_ELITE</code> shares the on-chain
        tier with <code>HIGH</code> — the elite distinction is only relevant
        in UI surfaces.
      </p>

      <h3>Registering agents programmatically</h3>
      <p>
        Any wallet or contract can register agents by calling{" "}
        <code>AgentRegistry.registerAgent(agent, metadataURI)</code>. The
        msg.sender becomes the agent owner and gains lifecycle control:
      </p>

      <pre><code>{`import { writeContract } from "@wagmi/core";
import { agentRegistryAbi } from "./abi/AgentRegistry";

await writeContract({
  address: "0x73d3cf7f2734C334927f991fe87D06d595d398b4",
  abi: agentRegistryAbi,
  functionName: "registerAgent",
  args: [agentAddress, "ipfs://Qm..."],
});`}</code></pre>

      <p>
        The metadata URI is free-form. Most integrators point it at an IPFS
        document describing the agent&apos;s purpose, model, owner, and any
        external attestations.
      </p>

      <h2>Going further</h2>
      <p>
        TrustGate&apos;s scoring is intentionally narrow — onchain Arc
        activity, nothing else. Protocols that need richer trust models can
        layer their own predicates on top: configurable weights for staking
        history, KYC tier, audit attestations, or third-party risk scores.
        That ground is where Sofia-style trust models slot in: keep the
        on-chain enforcement primitive simple, push the scoring complexity
        into pluggable predicate weights that can evolve without redeploying
        the gate. We expect this surface to grow alongside Arc.
      </p>
    </DocShell>
  );
}
