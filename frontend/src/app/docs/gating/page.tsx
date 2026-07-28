import Link from "next/link";

export const metadata = {
  title: "Behavioral Access Gating -- TrustGate Docs",
  description:
    "Protocol-owned ladders on TrustGate trust signals. Signed expiring attestations. Not a credit score.",
};

export default function GatingDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
        Integration
      </p>
      <h1 className="font-display text-3xl font-bold tracking-wide text-text">
        Behavioral access gating
      </h1>
      <p className="text-text-secondary">
        TrustGate provides a hard-to-fake behavioral trust <strong>signal</strong>{" "}
        and optional signed, time-bound attestation. Your protocol owns the{" "}
        <strong>ladder</strong> — what each score is allowed to do. TrustGate does
        not set borrow limits, assert token price, or act as a credit bureau.{" "}
        <strong>Gating and Protocol Guard are free for protocols</strong> —
        no subscription required.
      </p>

      <div className="not-prose my-6 rounded border border-border bg-bg-surface p-4 text-sm text-text-secondary">
        <p className="font-mono text-xs text-text-muted">Liability fence</p>
        <p className="mt-2">
          TrustGate said the wallet scored N at time T under scoringVersion V.
          The protocol chose what N allows. Scores behaviour, not value or
          safety.
        </p>
      </div>

      <h2>APIs</h2>
      <ul>
        <li>
          <code>POST /api/gating/attest</code> — issue EIP-712 attestation
        </li>
        <li>
          <code>POST /api/gating/verify</code> — fail-closed off-chain verify
        </li>
        <li>
          <code>POST /api/gating/check</code> — score + protocol ladder +
          attestation
        </li>
      </ul>

      <h3>Check body (protocol owns ladder)</h3>
      <pre className="overflow-x-auto rounded border border-border bg-background p-4 text-xs">
{`{
  "wallet": "0x…",
  "requestedAmount": 500000,
  "capability": "borrow",
  "ladder": {
    "protocolId": "my-dao",
    "minConfidence": 40,
    "multiFactorAcknowledged": true,
    "bands": [
      { "minScore": 25, "maxScore": 48, "capability": "borrow", "maxAmount": 20000 },
      { "minScore": 49, "maxScore": 60, "capability": "borrow", "maxAmount": 100000 },
      { "minScore": 61, "maxScore": 90, "capability": "borrow", "maxAmount": 500000 }
    ]
  },
  "useClass": "financial_high"
}`}
      </pre>

      <p>
        Demo only: <code>ladderPreset: &quot;example_lending&quot;</code> or{" "}
        <code>&quot;example_governance&quot;</code> — not TrustGate policy.
      </p>

      <h2>On-chain verification</h2>
      <p>
        Deploy <code>contracts/TrustAttestationVerifier.sol</code>. Authorize the
        TrustGate issuer address. Call <code>verify(attestation, signature,
        subject)</code> before releasing funds. Fail-closed on expiry, bad
        signature, wrong subject, or unauthorized issuer.
      </p>

      <h2>Multi-factor (required guidance)</h2>
      <p>
        Do not sole-gate on <code>score &gt;= X</code>. Combine with collateral,
        protocol history, staking, and DAO participation. TrustGate is one risk
        input among several.
      </p>

      <h2>Env</h2>
      <ul>
        <li>
          <code>ATTESTATION_SIGNER_PRIVATE_KEY</code> — production issuer key
        </li>
        <li>
          <code>ATTESTATION_AUTHORIZED_ISSUERS</code> — optional extra issuers
        </li>
        <li>
          <code>SCORING_ENVIRONMENT=testnet|mainnet</code> — labels attestation
          calibration
        </li>
      </ul>

      <p className="mt-8">
        <Link href="/gating" className="text-accent hover:underline">
          Open gating pilot UI
        </Link>
      </p>
    </article>
  );
}
