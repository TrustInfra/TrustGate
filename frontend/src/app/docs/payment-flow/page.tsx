import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Payment Flow — TrustGate Docs" };

export default function PaymentFlow() {
  return (
    <DocShell
      eyebrow="Payment Flow"
      title="From Deposit to Release"
      lede="The depositor side and the agent side never share signing authority. Each step is an independent transaction initiated by the party responsible for it."
    >
      <h2>Depositor side</h2>
      <pre><code>{`// 1. Approve USDC to TrustGate
usdc.approve(trustGate, amount)

// 2. Credit pooled balance
trustGate.deposit(amount)

// 3. Set per-agent cap
trustGate.setAgentAllowance(agent, maxSpend)`}</code></pre>
      <p>
        Allowances are per-(depositor, agent) pairs. Setting an allowance to
        zero stops new claims but does not invalidate ones already pending.
        Existing balance can be withdrawn at any time through{" "}
        <code>withdraw(amount)</code>, subject to funds not locked in pending
        claims.
      </p>

      <h2>Agent side</h2>
      <pre><code>{`// Claim against a specific depositor
trustGate.claim(depositor, amount)`}</code></pre>
      <p>
        The call reverts if the agent is not Active, if <code>amount</code>{" "}
        exceeds allowance, or if the depositor balance is insufficient. On
        success, the contract reads{" "}
        <code>TrustScoring.getTier(agent)</code> and branches:
      </p>
      <ul>
        <li>
          <strong>HIGH</strong> — USDC transferred; claim marked Released in
          the same tx.
        </li>
        <li>
          <strong>MEDIUM</strong> — Claim recorded with{" "}
          <code>releaseTime = block.timestamp + 24 hours</code>. Status:
          Pending.
        </li>
        <li>
          <strong>LOW</strong> — Claim recorded, awaiting{" "}
          <code>approveEscrow</code>. Status: Pending.
        </li>
      </ul>

      <h2>Release</h2>
      <pre><code>{`// Agent: after 24h (MEDIUM) or after approval (LOW)
trustGate.release(claimId)

// Depositor: only needed for LOW tier escrow
trustGate.approveEscrow(claimId)

// Depositor: abort any Pending claim
trustGate.cancel(claimId)`}</code></pre>

      <h2>State transitions</h2>
      <p>
        A <code>Claim</code> struct moves through three terminal states. Only
        one can win:
      </p>
      <ul>
        <li><strong>Released</strong> — USDC transferred to the agent.</li>
        <li><strong>Cancelled</strong> — USDC returned to the depositor&apos;s pooled balance.</li>
        <li><strong>Expired</strong> — reserved for future use (not currently triggered).</li>
      </ul>
      <p>
        Every transition emits an event. Frontends and indexers can follow
        the full lifecycle through <code>ClaimCreated</code>,{" "}
        <code>ClaimReleased</code>, <code>ClaimCancelled</code>, and{" "}
        <code>EscrowApproved</code>.
      </p>
    </DocShell>
  );
}
