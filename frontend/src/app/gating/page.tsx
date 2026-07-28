"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Behavioral access infrastructure demo.
 * TrustGate = signal. Protocol = ladder / policy.
 */

interface CheckResult {
  allowed: boolean;
  walletScore?: number;
  walletTier?: string;
  walletConfidence?: number;
  reasons: string[];
  disclaimer: string;
  guidance?: string;
  walletEvaluation?: {
    allowed: boolean;
    matchedBand: { capability: string; maxAmount?: number; minScore: number } | null;
  };
  attestation?: {
    attestationId: string;
    score: number;
    tier: string;
    expiresAt: number;
    signature: string;
    scoringVersion: string;
    environment: string;
    isDemoSigner?: boolean;
  };
}

export default function GatingPage() {
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("500000");
  const [preset, setPreset] = useState<"example_lending" | "example_governance">(
    "example_lending"
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [verifyOut, setVerifyOut] = useState<string | null>(null);

  async function runCheck() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      setError("Enter a valid wallet address");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    setVerifyOut(null);
    try {
      const res = await fetch("/api/gating/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet,
          requestedAmount: Number(amount) || 0,
          capability: preset === "example_lending" ? "borrow" : "full_governance",
          ladderPreset: preset,
          requireMultiFactorAck: false,
          useClass:
            preset === "example_lending" ? "financial_high" : "governance",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "check_failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAttestation() {
    if (!result?.attestation) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gating/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attestation: result.attestation,
          expectedSubject: wallet,
        }),
      });
      const data = await res.json();
      setVerifyOut(
        data.valid
          ? `Valid — score ${data.score} expires ${new Date((data.expiresAt ?? 0) * 1000).toISOString()}`
          : `Invalid: ${(data.reasons || []).join("; ")}`
      );
    } catch (e) {
      setVerifyOut(e instanceof Error ? e.message : "verify failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-text">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Behavioral access infrastructure
        </p>
        <h1 className="text-3xl font-semibold tracking-wide">
          Protocol Gating
        </h1>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-text-secondary">
          Free for protocols. TrustGate provides a hard-to-fake behavioral trust
          signal and optional signed, expiring attestation. Your protocol owns
          the ladder — what each score is allowed to do. Not a credit score. Not
          a price oracle. Scores behaviour, not value or safety.
        </p>

        <div className="mt-4 rounded border border-accent/20 bg-accent/5 px-4 py-3 font-mono text-xs text-text-secondary">
          Pricing: free. No subscription. Attest / verify / check have no
          protocol fee in this build.
        </div>

        <div className="mt-6 rounded border border-border bg-bg-surface p-4 font-mono text-xs text-text-muted leading-relaxed">
          Liability fence: TrustGate said the wallet scored N at time T under
          scoringVersion V. The protocol chose what N allows.
        </div>

        <section className="mt-10 rounded-lg border border-border bg-bg-surface p-6">
          <h2 className="text-lg font-medium">Pilot check</h2>
          <p className="mt-1 text-sm text-text-muted">
            Demo ladders are illustrative only — not TrustGate policy. Production
            protocols must pass their own ladder bands.
          </p>

          <div className="mt-4 grid gap-3">
            <input
              className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="0x wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreset("example_lending")}
                className={`rounded border px-3 py-1.5 font-mono text-xs uppercase ${
                  preset === "example_lending"
                    ? "border-accent/50 text-accent"
                    : "border-border text-text-muted"
                }`}
              >
                Example lending ladder
              </button>
              <button
                type="button"
                onClick={() => setPreset("example_governance")}
                className={`rounded border px-3 py-1.5 font-mono text-xs uppercase ${
                  preset === "example_governance"
                    ? "border-accent/50 text-accent"
                    : "border-border text-text-muted"
                }`}
              >
                Example governance ladder
              </button>
            </div>
            {preset === "example_lending" && (
              <input
                className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="Requested amount (protocol units)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={runCheck}
              className="rounded border border-border px-4 py-2 text-sm font-medium hover:border-accent/40 disabled:opacity-50"
            >
              {busy ? "Working…" : "Run gating check + issue attestation"}
            </button>
          </div>

          {result && (
            <div className="mt-6 space-y-3 rounded border border-border p-4">
              <p
                className={`font-mono text-sm font-semibold ${
                  result.allowed ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {result.allowed
                  ? "ALLOWED under protocol ladder"
                  : "REJECTED under protocol ladder"}
              </p>
              <p className="font-mono text-xs text-text-muted">
                score {result.walletScore} · {result.walletTier} · confidence{" "}
                {result.walletConfidence}%
              </p>
              {result.walletEvaluation?.matchedBand && (
                <p className="font-mono text-xs text-text-secondary">
                  matched band: {result.walletEvaluation.matchedBand.capability}
                  {result.walletEvaluation.matchedBand.maxAmount != null
                    ? ` · max ${result.walletEvaluation.matchedBand.maxAmount}`
                    : ""}{" "}
                  · min score {result.walletEvaluation.matchedBand.minScore}
                </p>
              )}
              <ul className="space-y-1 text-sm text-text-secondary">
                {result.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
              {result.attestation && (
                <div className="rounded border border-border bg-background p-3 font-mono text-[11px] text-text-muted space-y-1">
                  <p>attestation {result.attestation.attestationId}</p>
                  <p>
                    {result.attestation.scoringVersion} ·{" "}
                    {result.attestation.environment}
                  </p>
                  <p>
                    expires{" "}
                    {new Date(result.attestation.expiresAt * 1000).toISOString()}
                  </p>
                  <p className="break-all">
                    sig {result.attestation.signature.slice(0, 20)}…
                  </p>
                  {result.attestation.isDemoSigner && (
                    <p className="text-amber-200/80">
                      Demo signer — set ATTESTATION_SIGNER_PRIVATE_KEY in
                      production
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={verifyAttestation}
                    className="mt-2 rounded border border-border px-2 py-1 text-text hover:border-accent/40"
                  >
                    Verify attestation
                  </button>
                  {verifyOut && <p className="text-text-secondary">{verifyOut}</p>}
                </div>
              )}
              <p className="text-xs text-text-muted">{result.disclaimer}</p>
              {result.guidance && (
                <p className="text-xs text-text-muted">{result.guidance}</p>
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-lg border border-border bg-bg-surface p-6">
          <h2 className="text-lg font-medium">Integration</h2>
          <ul className="mt-3 space-y-2 font-mono text-xs text-text-secondary">
            <li>POST /api/gating/attest — signed, expiring attestation</li>
            <li>POST /api/gating/verify — fail-closed signature + expiry check</li>
            <li>
              POST /api/gating/check — score + protocol ladder + attestation
            </li>
            <li>
              contracts/TrustAttestationVerifier.sol — on-chain EIP-712 verify
            </li>
          </ul>
          <p className="mt-4 text-sm text-text-muted">
            Lead with on-chain attestation for high-value gates. API path for
            low-friction pilots. Multi-factor risk is mandatory guidance — do not
            sole-gate on score.
          </p>
        </section>

        {error && (
          <p className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {error}
          </p>
        )}

        <p className="mt-10 font-mono text-xs text-text-muted">
          <Link href="/protocol-guard" className="text-accent hover:underline">
            Protocol Guard
          </Link>{" "}
          (alerts) ·{" "}
          <Link href="/oracle" className="text-accent hover:underline">
            Oracle
          </Link>{" "}
          ·{" "}
          <Link href="/docs" className="text-accent hover:underline">
            Docs
          </Link>
        </p>
      </div>
    </main>
  );
}
