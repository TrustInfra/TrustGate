import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "API Reference — TrustGate Docs" };

const ORACLE_URL =
  process.env.NEXT_PUBLIC_ORACLE_URL ?? "http://38.49.216.201:3001";

export default function ApiReferencePage() {
  return (
    <DocShell
      eyebrow="API Reference"
      title="Oracle API"
      lede="A public, payable HTTP API that returns onchain trust scores for any Arc wallet. Each query costs 0.001 USDC, settled on Arc through the x402 payment standard."
    >
      <h2>Base URL</h2>
      <pre><code>{ORACLE_URL}</code></pre>
      <p>
        The base URL is exposed to the frontend through the{" "}
        <code>NEXT_PUBLIC_ORACLE_URL</code> environment variable. All
        endpoints accept JSON and respond with JSON.
      </p>

      <h2>Payment: x402</h2>
      <p>
        Paid endpoints use the{" "}
        <a
          href="https://www.x402.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          x402 payment standard
        </a>
        . An unpaid request returns HTTP 402 with a payment requirement that
        names the recipient address and amount. The client settles the
        transfer on Arc, then re-sends the same request with an{" "}
        <code>X-Payment</code> header carrying the proof. Successful payment
        replays return HTTP 200 with the score body.
      </p>
      <pre><code>{`# Step 1 — unpaid request
GET ${ORACLE_URL}/trust/0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62
→ 402 Payment Required
  {
    "amount": "0.001",
    "currency": "USDC",
    "network": "arc-testnet",
    "recipient": "0x...",
    "memo": "trust-query"
  }

# Step 2 — settle 0.001 USDC on Arc, then replay with proof
GET ${ORACLE_URL}/trust/0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62
X-Payment: <base64(JSON{txHash, nonce})>
→ 200 OK
  { ...score body... }`}</code></pre>

      <h2>GET /trust/:address</h2>
      <p>
        Returns the trust score, tier, and routing recommendation for a
        single Arc wallet. The address must be a 40-character hex string
        with the{" "}
        <code>0x</code> prefix.
      </p>

      <h3>Request</h3>
      <pre><code>{`curl -H "X-Payment: <token>" \\
  ${ORACLE_URL}/trust/0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`}</code></pre>

      <h3>Response (200)</h3>
      <pre><code>{`{
  "address": "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62",
  "score": 57,
  "tier": "MEDIUM",
  "recommendation": "Time-locked routing (24h hold)",
  "queriedAt": "2026-04-25T10:42:13.094Z",
  "network": "arc-testnet",
  "source": "Arc Onchain Activity"
}`}</code></pre>

      <h3>Fields</h3>
      <ul>
        <li>
          <strong>address</strong> — the queried wallet, lowercased to
          checksum-equivalent form.
        </li>
        <li>
          <strong>score</strong> — integer 0 – 100.
        </li>
        <li>
          <strong>tier</strong> — one of{" "}
          <code>BLOCKED | LOW | MEDIUM | HIGH | HIGH_ELITE</code>.
        </li>
        <li>
          <strong>recommendation</strong> — the routing path TrustGate would
          take for this score, in plain English.
        </li>
        <li>
          <strong>queriedAt</strong> — ISO-8601 timestamp of the snapshot.
        </li>
      </ul>

      <h2>POST /trust/batch</h2>
      <p>
        Score up to 10 addresses in a single request. The whole batch
        settles in one x402 payment of <code>0.001 USDC × addressCount</code>.
      </p>

      <h3>Request</h3>
      <pre><code>{`curl -X POST -H "X-Payment: <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "addresses": [
      "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62",
      "0x52E17bC482d00776d73811680CbA9914e83E33CC"
    ]
  }' \\
  ${ORACLE_URL}/trust/batch`}</code></pre>

      <h3>Response (200)</h3>
      <pre><code>{`{
  "results": [
    { "address": "0x60C0...5c62", "score": 57, "tier": "MEDIUM" },
    { "address": "0x52E1...33CC", "score": 92, "tier": "HIGH" }
  ],
  "queriedAt": "2026-04-25T10:42:13.094Z",
  "network": "arc-testnet"
}`}</code></pre>

      <h2>GET /health</h2>
      <p>
        Liveness probe. No payment required. Returns 200 with a small
        version object the operator can use for monitoring.
      </p>

      <h3>Response (200)</h3>
      <pre><code>{`{
  "status": "ok",
  "uptimeSeconds": 12345,
  "version": "1.0.0"
}`}</code></pre>

      <h2>Errors</h2>
      <ul>
        <li>
          <strong>400</strong> — invalid address or batch over 10 entries.
        </li>
        <li>
          <strong>402</strong> — payment required. Body contains the
          requirement to settle.
        </li>
        <li>
          <strong>422</strong> — payment proof rejected (wrong amount,
          wrong recipient, replayed nonce).
        </li>
        <li>
          <strong>502</strong> — upstream Arc RPC or Arcscan returned an
          error. Retry once after a backoff.
        </li>
      </ul>
    </DocShell>
  );
}
