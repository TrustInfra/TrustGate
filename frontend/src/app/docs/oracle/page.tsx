export const metadata = {
  title: 'Oracle API — TrustGate',
  description: 'TrustGate Oracle: payable trust scoring API for Arc testnet.',
};

const ORACLE_URL = 'https://trustgate-oracle.up.railway.app';

export default function OracleDocsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <article className="mx-auto max-w-3xl px-6 py-16 prose prose-invert prose-zinc">
        <p className="text-sm uppercase tracking-widest text-emerald-400">Docs</p>
        <h1>Oracle API</h1>
        <p className="lead text-zinc-400">
          The TrustGate Oracle is a public, payable HTTP API that returns onchain trust
          scores for Arc addresses. Scores cost 0.001 USDC per query. Payments are settled
          on Arc testnet using an x402-compatible flow.
        </p>

        <h2>Base URL</h2>
        <pre>
          <code>{ORACLE_URL}</code>
        </pre>

        <h2>Endpoints</h2>

        <h3>GET /health</h3>
        <p>Liveness probe. Returns 200 with version info.</p>

        <h3>GET /oracle/&lt;address&gt;</h3>
        <p>
          Returns the trust score for a single Arc address. Without an{' '}
          <code>X-Payment</code> header, returns HTTP 402 with the payment requirement.
        </p>
        <p>Required header on the paid request:</p>
        <pre>
          <code>X-Payment: base64(JSON)</code>
        </pre>
        <p>where the JSON payload is:</p>
        <pre>
          <code>{`{
  "scheme": "exact",
  "network": "arc-testnet",
  "txHash": "0x...your USDC transfer tx...",
  "from": "0x...payer address...",
  "amount": "0.001",
  "nonce": "any-uuid"
}`}</code>
        </pre>

        <h3>POST /oracle/batch</h3>
        <p>
          Accepts up to 10 addresses. Charges 0.001 USDC per address in a single payment.
          Body:
        </p>
        <pre>
          <code>{`{ "addresses": ["0x...", "0x...", "0x..."] }`}</code>
        </pre>

        <h3>GET /oracle/stats</h3>
        <p>
          Public stats: total queries, USDC earned, unique addresses scored, average
          score, tier distribution, and a sliding window of recent queries.
        </p>

        <h2>Scoring formula</h2>
        <p>The score is computed from four signals on Arc testnet:</p>
        <ul>
          <li>
            <strong>Transaction count:</strong> 0 = blocked, 1–10 = 20 pts, 11–30 = 40,
            31–60 = 60, 61–100 = 75, 100+ = 85.
          </li>
          <li>
            <strong>USDC balance:</strong> &gt;100 USDC = +5 pts.
          </li>
          <li>
            <strong>Contract interactions:</strong> 3–9 = +5, 10–99 = +7, 100+ = +15.
          </li>
          <li>
            <strong>Deployments:</strong> 1+ = +10 pts.
          </li>
        </ul>
        <p>
          Hard cap is 97 unless contract interactions ≥ 100. Maximum score is 100.
        </p>

        <h2>Payment flow</h2>
        <ol>
          <li>
            Send a USDC transfer on Arc testnet to the recipient address shown in the 402
            response (the TrustGate contract).
          </li>
          <li>Wait for the tx to confirm.</li>
          <li>
            Encode the JSON above (with your tx hash and a fresh nonce) as base64 and
            send the request with <code>X-Payment</code> set to that string.
          </li>
        </ol>
        <p>
          Each <code>txHash</code> and each <code>nonce</code> can only be used once.
        </p>

        <h2>Rate limits</h2>
        <p>100 requests per IP per hour.</p>
      </article>
    </main>
  );
}
