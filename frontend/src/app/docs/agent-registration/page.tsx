import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Agent Registration — TrustGate Docs" };

export default function AgentRegistration() {
  return (
    <DocShell
      eyebrow="Agent Registration"
      title="Onboarding an Agent"
      lede="Registration is a single permissionless call. Every subsequent claim, score update, and allowance check keys off the agent address recorded here."
    >
      <h2>The registration call</h2>
      <p>
        An agent is any EOA or contract address. To register, call:
      </p>
      <pre><code>{`AgentRegistry.registerAgent(
  string calldata name,
  string calldata metadata
)`}</code></pre>
      <p>
        <code>name</code> is a display string, <code>metadata</code> is a free-form
        pointer — typically an IPFS CID or URL describing the agent&apos;s
        purpose, owner, and attestations. Neither field is validated on chain.
      </p>

      <h2>Lifecycle states</h2>
      <p>
        Each registered agent has a status tracked in the registry:
      </p>
      <ul>
        <li>
          <strong>Active</strong> — default on registration. Can be scored,
          allowed, and claimed against.
        </li>
        <li>
          <strong>Suspended</strong> — temporary freeze by the agent owner or
          registry admin. Existing claims remain valid; new claims are rejected.
        </li>
        <li>
          <strong>Deactivated</strong> — terminal state. The agent address
          cannot be reused. Pending claims are cancellable by the depositor.
        </li>
      </ul>

      <h2>Owner controls</h2>
      <p>
        The address that registered the agent is its owner and can call{" "}
        <code>deactivate()</code>, <code>suspend()</code>, and{" "}
        <code>reactivate()</code>. Ownership can be transferred through{" "}
        <code>transferOwnership(agent, newOwner)</code>.
      </p>

      <h2>Why permissionless</h2>
      <p>
        A gatekept registry would centralize trust at the registration layer
        — contradicting the whole premise. Instead, trust is enforced
        downstream through the scoring oracle and tier-based routing. A newly
        registered agent starts at score 0 and tier LOW, so registration alone
        grants nothing.
      </p>
    </DocShell>
  );
}
