import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "How It Works — TrustGate Docs" };

export default function HowItWorks() {
  return (
    <DocShell
      eyebrow="How It Works"
      title="The Four-Step Flow"
      lede="From agent onboarding to claim, TrustGate moves through four on-chain stages. Each is a distinct contract call — there is no off-chain control plane."
    >
      <h2>1. Register</h2>
      <p>
        Any address can register as an agent by calling{" "}
        <code>AgentRegistry.registerAgent(name, metadata)</code>. The call is
        permissionless. Registration does not confer trust — it creates an
        entry the trust oracle can begin scoring.
      </p>
      <p>
        Every registered agent starts with score <code>0</code> and tier{" "}
        <code>LOW</code>. Trust must be earned through usage, external
        attestations, or oracle updates from reputation providers.
      </p>

      <h2>2. Deposit &amp; allow</h2>
      <p>
        Depositors approve USDC to the TrustGate contract, then call{" "}
        <code>deposit(amount)</code> to credit their pooled balance. For each
        agent they want to pay, they call{" "}
        <code>setAgentAllowance(agent, maxSpend)</code>. Allowances are hard
        caps per agent, not shared pools.
      </p>

      <h2>3. Score</h2>
      <p>
        A permissioned oracle updates trust scores over time through{" "}
        <code>TrustScoring.setScore(agent, score)</code>. The score maps to a
        tier through fixed thresholds — 75+ is HIGH, 40+ is MEDIUM, below 40
        is LOW. The tier is consulted at claim time, not at allowance time, so
        a score change takes effect on the next claim.
      </p>

      <h2>4. Claim</h2>
      <p>
        When the agent wants to spend, it calls{" "}
        <code>TrustGate.claim(depositor, amount)</code>. The contract checks
        the allowance, reads the current tier, and routes:
      </p>
      <ul>
        <li>
          <strong>HIGH</strong> — USDC transferred immediately in the same tx.
        </li>
        <li>
          <strong>MEDIUM</strong> — claim recorded as Pending with a 24-hour{" "}
          <code>releaseTime</code>. The agent calls <code>release(claimId)</code>{" "}
          after the window to collect.
        </li>
        <li>
          <strong>LOW</strong> — claim held in escrow. The depositor must call{" "}
          <code>approveEscrow(claimId)</code> before the agent can release.
        </li>
      </ul>
      <p>
        At any time before release, the depositor can <code>cancel(claimId)</code>{" "}
        and reclaim the held USDC. This is why LOW tier defaults to escrow —
        cancellation leaves no counter-party risk.
      </p>
    </DocShell>
  );
}
