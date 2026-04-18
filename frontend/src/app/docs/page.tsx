import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Overview — TrustGate Docs" };

export default function DocsOverview() {
  return (
    <DocShell
      eyebrow="Overview"
      title="TrustGate"
      lede="Trust-gated USDC payments for autonomous agents. Deposit once, set per-agent caps, and let EigenTrust-derived scores route each claim through instant transfer, 24-hour time-lock, or escrow."
    >
      <h2>The problem</h2>
      <p>
        Autonomous agents need stablecoin spending authority to act on their
        principal&apos;s behalf. Granting an ERC-20 <code>approve()</code> on an
        agent address is all-or-nothing: the agent either has unlimited access
        until revoked, or no access at all. There is no way to let reputation
        shape the settlement path.
      </p>
      <p>
        TrustGate splits that decision surface in three. A depositor funds a
        pooled balance and sets a per-agent allowance. On claim, the agent&apos;s
        trust tier selects how the USDC arrives — instantly, after a 24-hour
        review window, or held in escrow until the depositor approves.
      </p>

      <h2>Core primitives</h2>
      <p>
        The protocol is three contracts on Arc Testnet (chain id 5042002):
      </p>
      <ul>
        <li>
          <strong>AgentRegistry</strong> — permissionless agent enrollment and
          lifecycle (Active, Suspended, Deactivated).
        </li>
        <li>
          <strong>TrustScoringPlaintext</strong> — oracle-updated 0-100 trust
          scores, classified into HIGH / MEDIUM / LOW tiers. FHE equivalent
          available on Zama-compatible chains.
        </li>
        <li>
          <strong>TrustGate</strong> — the allowance ledger; routes each claim
          according to the claimant&apos;s current tier.
        </li>
      </ul>

      <h2>Why allowance model</h2>
      <p>
        Three integration patterns were considered: per-payment creation,
        request-then-approve, and pooled allowance. Only allowance is
        compatible with the agent loop — an agent executing a task cannot
        wait on human approval for each settlement, and creating a payment
        per task pushes the gas problem onto the agent.
      </p>
      <p>
        Allowance stays under the depositor&apos;s control through two levers:
        the per-agent cap and the tier-derived routing. Both are revocable
        at any time by the depositor, without the agent&apos;s cooperation.
      </p>
    </DocShell>
  );
}
