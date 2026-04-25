export const metadata = {
  title: 'Agent Loop — TrustGate',
  description: 'How the autonomous agent payment loop works.',
};

export default function AgentLoopDocsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-zinc">
        <p className="text-sm uppercase tracking-widest text-emerald-400">Docs</p>
        <h1>Autonomous Agent Loop</h1>
        <p className="lead text-zinc-400">
          A standalone Node worker that demonstrates trust-gated agent commerce on Arc
          testnet. Every 30 seconds, registered agents are scored, and if their score
          clears the HIGH threshold (75) they autonomously claim USDC from TrustGate.
        </p>

        <h2>How it works</h2>
        <ol>
          <li>
            The worker reads agent config from <code>scripts/agents.json</code> and loads
            each private key from environment variables (<code>AGENT_1_KEY</code>,{' '}
            <code>AGENT_2_KEY</code>, etc.).
          </li>
          <li>
            Every cycle (default 30s), for each agent it fetches the current trust score
            from <code>/api/arc-score/&lt;address&gt;</code>.
          </li>
          <li>
            If the score is ≥ 75, the worker calls{' '}
            <code>TrustGate.claimPayment(depositor, amount)</code> using the agent's
            private key. The transaction lands on Arc testnet and is visible on Arcscan.
          </li>
          <li>
            A summary table is printed every cycle: address, score, tier, last claim
            time, total USDC earned, total claims.
          </li>
          <li>
            Status is written to a shared volume so the live dashboard can poll it.
          </li>
        </ol>

        <h2>Why it matters</h2>
        <p>
          Most "AI agent" demos either run offchain or move tokens with no trust signal at
          all. TrustGate's agent loop is the simplest honest demonstration of the
          opposite: an agent's onchain history determines whether it can move money, and
          the whole loop runs without a human in the middle.
        </p>

        <h2>Configuration</h2>
        <p>Environment variables on the Railway worker:</p>
        <ul>
          <li>
            <code>ARC_RPC_URL</code> — Arc testnet RPC
          </li>
          <li>
            <code>TRUSTGATE_CONTRACT</code> — TrustGate address (
            <code>0x52E17bC482d00776d73811680CbA9914e83E33CC</code>)
          </li>
          <li>
            <code>SCORE_API_BASE</code> — TrustGate frontend score API
          </li>
          <li>
            <code>CYCLE_INTERVAL_MS</code> — defaults to 30000
          </li>
          <li>
            <code>PER_AGENT_COOLDOWN_MS</code> — minimum gap between claims per agent,
            defaults to 60000
          </li>
          <li>
            <code>HIGH_THRESHOLD</code> — auto-claim threshold, defaults to 75
          </li>
          <li>
            <code>AGENT_*_KEY</code> — private keys, one per agent
          </li>
        </ul>

        <h2>Safety</h2>
        <p>
          The worker pre-checks <code>claimableAmount(depositor, recipient)</code> before
          calling <code>claimPayment</code>, so it doesn't burn gas on doomed
          transactions. Per-agent cooldown prevents runaway tx volume if the score API
          flickers around the threshold.
        </p>
      </article>
    </main>
  );
}
