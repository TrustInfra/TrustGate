import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "How It Works — TrustGate Docs" };

export default function HowItWorks() {
  return (
    <DocShell
      eyebrow="How It Works"
      title="From Deposit to Claim"
      lede="TrustGate moves through five onchain stages. Each is a single contract call — there is no off-chain control plane, no manual signoff, and no oracle in the critical path."
    >
      <h2>The five-step flow</h2>

      <h3>1. Depositor funds TrustGate</h3>
      <p>
        A depositor approves USDC to the <code>TrustGate</code> contract and
        calls <code>deposit(amount)</code>. The contract credits a pooled
        balance the depositor controls and can withdraw at any time.
      </p>

      <h3>2. Depositor sets per-agent allowances</h3>
      <p>
        For every agent the depositor wants to pay, they call{" "}
        <code>setAgentAllowance(agent, maxSpend)</code>. Allowances are hard
        spending caps — not shared pools — and apply only to the address that
        set them.
      </p>

      <h3>3. Agent registers via AgentRegistry</h3>
      <p>
        The agent (or anyone acting on its behalf) calls{" "}
        <code>AgentRegistry.registerAgent(agentAddress, metadataURI)</code>.
        Registration is permissionless. The msg.sender becomes the agent owner
        and gains the right to deactivate or update metadata. A new agent
        starts at score 0 and tier LOW until scoring runs.
      </p>

      <h3>4. Agent claims payment</h3>
      <p>
        The agent calls <code>TrustGate.claim(depositor, amount)</code>. In
        the same transaction, TrustGate reads the agent&apos;s tier from{" "}
        <code>TrustScoring</code>, debits the depositor&apos;s allowance, and
        routes the funds based on the tier.
      </p>

      <h3>5. Score determines routing</h3>
      <p>
        Routing is not a configuration toggle — it is a direct function of the
        score. A single integer tier value picks one of four code paths:
      </p>

      <h2>Routing logic</h2>
      <p>
        The flow below summarises{" "}
        <code>TrustGate.claim()</code> when called against an active depositor
        allowance:
      </p>

      <pre><code>{`             ┌──────────────────────────┐
             │  Agent.claim(deposit, x)  │
             └────────────┬─────────────┘
                          ▼
             ┌──────────────────────────┐
             │  Read tier from oracle   │
             └────────────┬─────────────┘
                          ▼
        ┌─────────────────┴─────────────────┐
        │            What tier?              │
        └─┬───────────┬──────────────┬──────┘
          ▼           ▼              ▼
       BLOCKED       LOW          MEDIUM            HIGH / HIGH_ELITE
       revert       escrow      24h time-lock        instant transfer
                  (depositor    (releaseTime =        (USDC sent
                   approval     now + 86400s,         in same tx)
                   required)    cancelable)`}</code></pre>

      <p>
        At any time before release, the depositor can call{" "}
        <code>cancel(claimId)</code> to reclaim a Pending or Escrowed claim.
        This is why LOW tier defaults to escrow — cancellation leaves no
        counterparty risk to the depositor.
      </p>

      <h2>Why Arc plus Circle Nanopayments</h2>
      <p>
        Two infrastructure choices make sub-cent agent payments viable:
      </p>
      <ul>
        <li>
          <strong>USDC is the native gas token on Arc.</strong> The same asset
          that settles the payment also pays the transaction fee — there is
          no second token to manage, no DEX swap, and no separate gas budget
          for the agent.
        </li>
        <li>
          <strong>Per-tx fees are sub-cent.</strong> A claim on Arc costs
          roughly $0.0008 in USDC versus $2 – $5 on traditional L1s. That is
          a 99.97% reduction, which is the difference between viable agent
          micropayments and theoretical ones.
        </li>
        <li>
          <strong>Settlement and routing decisions live on the same chain.</strong>{" "}
          The trust oracle, the allowance ledger, and the USDC transfer all
          execute in a single atomic transaction. No bridge, no off-chain
          relayer, no custodial intermediate.
        </li>
      </ul>

      <h2>What runs offchain</h2>
      <p>
        The frontend reads contract state through wagmi and viem and computes
        each agent&apos;s onchain score by hitting Arc RPC directly through a
        small server-side route at <code>/api/arc-score/[address]</code>. The
        trust score itself is written onchain via{" "}
        <code>TrustScoring.setTrustScore()</code> — every routing decision
        TrustGate makes consults the contract, not the API.
      </p>
    </DocShell>
  );
}
