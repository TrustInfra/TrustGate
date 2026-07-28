"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Protocol Guard (Phase 4) — free monitoring for lending / DAO risk.
 * TrustGate supplies the signal; the protocol owns policy. No paid plan.
 */

interface Subscription {
  id: string;
  protocolName: string;
  monthlyUsdc: number;
  pricing?: string;
  status: string;
  channels: {
    discordWebhookUrl?: string;
    telegramBotToken?: string;
    telegramChatId?: string;
    emailTo?: string;
    onchainEvent?: boolean;
  };
  alertsSent: number;
}

interface CheckResult {
  allowed: boolean;
  walletScore?: number;
  walletTier?: string;
  confidence?: number;
  flags?: string[];
  reasons: string[];
  alerts: Array<{ id: string; title: string; severity: string; body: string }>;
  disclaimer?: string;
  trustSurfaceArea?: {
    surfaceArea: number;
    priority: string;
    factors: Record<string, number>;
  };
  contextualThreshold?: {
    action: string;
    minTier: string;
    minScore: number;
    minConfidence: number;
    description: string;
  };
}

export default function ProtocolGuardPage() {
  const [protocolName, setProtocolName] = useState("");
  const [email, setEmail] = useState("");
  const [discord, setDiscord] = useState("");
  const [telegramToken, setTelegramToken] = useState("");
  const [telegramChat, setTelegramChat] = useState("");
  const [onchainEvent, setOnchainEvent] = useState(true);
  const [sub, setSub] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wallet, setWallet] = useState("");
  const [context, setContext] = useState<
    "borrow" | "vote" | "generic" | "api_execution" | "treasury_control" | "dex_swap"
  >("borrow");
  const [amount, setAmount] = useState("50000");
  const [proposalId, setProposalId] = useState("");
  const [voters, setVoters] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/protocol-guard/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocolName: protocolName || "Demo Protocol",
          contactEmail: email || undefined,
          channels: {
            discordWebhookUrl: discord || undefined,
            telegramBotToken: telegramToken || undefined,
            telegramChatId: telegramChat || undefined,
            emailTo: email || undefined,
            onchainEvent,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "register_failed");
      setSub(data.subscription);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  async function runCheck() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      setError("Enter a valid wallet address");
      return;
    }
    setBusy(true);
    setError(null);
    setCheck(null);
    try {
      const recentVoters = voters
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter((s) => /^0x[0-9a-fA-F]{40}$/.test(s));
      const res = await fetch("/api/protocol-guard/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Optional free registration — checks work without it
          subscriptionId: sub?.id,
          protocolName: protocolName || undefined,
          wallet,
          context,
          amount: amount ? Number(amount) : undefined,
          proposalId: proposalId || undefined,
          recentVoters: recentVoters.length ? recentVoters : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || "check_failed");
      setCheck(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-text">
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Phase 4
        </p>
        <h1 className="text-3xl font-semibold tracking-wide">Protocol Guard</h1>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-text-secondary">
          Free behavioral monitoring for lending and DAO surfaces. TrustGate
          emits the trust signal and delivers alerts; your protocol owns the
          policy. No subscription fee. Not a credit bureau. Not a price oracle.
        </p>

        <div className="mt-6 rounded border border-accent/20 bg-accent/5 px-4 py-3 font-mono text-xs text-text-secondary">
          Pricing: free for protocols. Register only if you want saved alert
          channels. Checks run without registration.
        </div>

        <div className="mt-10 rounded-lg border border-border bg-bg-surface p-6">
          <h2 className="text-lg font-medium">1. Free registration (optional)</h2>
          <p className="mt-1 text-sm text-text-muted">
            Save Discord / Telegram / email delivery targets. No payment.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="Protocol name"
              value={protocolName}
              onChange={(e) => setProtocolName(e.target.value)}
            />
            <input
              className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="Contact email (also email alerts)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="Discord webhook URL (optional)"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="Telegram bot token"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
              />
              <input
                className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="Telegram chat id"
                value={telegramChat}
                onChange={(e) => setTelegramChat(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={onchainEvent}
                onChange={(e) => setOnchainEvent(e.target.checked)}
              />
              Emit onchain event log (in-process audit stream)
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={subscribe}
              className="rounded border border-border bg-background px-4 py-2 text-sm font-medium transition hover:border-accent/40 disabled:opacity-50"
            >
              {busy ? "Working…" : "Register free"}
            </button>
          </div>
          {sub && (
            <div className="mt-4 rounded border border-accent/20 bg-accent/5 p-3 font-mono text-xs">
              <p>
                id: <span className="text-accent">{sub.id}</span>
              </p>
              <p>
                status: {sub.status} · free · alerts sent: {sub.alertsSent}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 rounded-lg border border-border bg-bg-surface p-6">
          <h2 className="text-lg font-medium">2. Pre-action check (free)</h2>
          <p className="mt-1 text-sm text-text-muted">
            Call before releasing borrow capacity or closing a vote window.
            Works with or without registration.
          </p>
          <div className="mt-4 grid gap-3">
            <input
              className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
              placeholder="0x wallet"
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  "borrow",
                  "vote",
                  "api_execution",
                  "treasury_control",
                  "dex_swap",
                  "generic",
                ] as const
              ).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setContext(c)}
                  className={`rounded border px-3 py-1.5 font-mono text-xs uppercase ${
                    context === c
                      ? "border-accent/50 text-accent"
                      : "border-border text-text-muted"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            {context === "borrow" && (
              <input
                className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                placeholder="Amount context (protocol-owned)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
            {context === "vote" && (
              <>
                <input
                  className="rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                  placeholder="Proposal id"
                  value={proposalId}
                  onChange={(e) => setProposalId(e.target.value)}
                />
                <textarea
                  className="min-h-[80px] rounded border border-border bg-background px-3 py-2 font-mono text-sm"
                  placeholder="Recent voter addresses (comma or space separated)"
                  value={voters}
                  onChange={(e) => setVoters(e.target.value)}
                />
              </>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={runCheck}
              className="rounded border border-border bg-background px-4 py-2 text-sm font-medium transition hover:border-accent/40 disabled:opacity-50"
            >
              Run free guard check
            </button>
          </div>

          {check && (
            <div className="mt-4 space-y-3 rounded border border-border p-4">
              <p
                className={`font-mono text-sm font-semibold ${
                  check.allowed ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {check.allowed ? "ALLOWED (no warning/critical)" : "ALERT FIRED"}
              </p>
              <p className="font-mono text-xs text-text-muted">
                score {check.walletScore} · {check.walletTier} · confidence{" "}
                {check.confidence}%
              </p>
              {check.contextualThreshold && (
                <p className="font-mono text-xs text-text-secondary">
                  threshold: {check.contextualThreshold.description} (min score{" "}
                  {check.contextualThreshold.minScore}, conf{" "}
                  {check.contextualThreshold.minConfidence}%, tier{" "}
                  {check.contextualThreshold.minTier}+)
                </p>
              )}
              {check.trustSurfaceArea && (
                <p className="font-mono text-xs text-amber-200/90">
                  Trust Surface Area {check.trustSurfaceArea.surfaceArea} ·
                  priority {check.trustSurfaceArea.priority}
                </p>
              )}
              {check.flags && check.flags.length > 0 && (
                <p className="font-mono text-[11px] text-text-muted">
                  flags: {check.flags.join(", ")}
                </p>
              )}
              <ul className="space-y-1 text-sm text-text-secondary">
                {check.reasons.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
              {check.alerts.map((a) => (
                <div
                  key={a.id}
                  className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-sm"
                >
                  <p className="font-medium text-amber-200">
                    [{a.severity}] {a.title}
                  </p>
                  <p className="mt-1 text-text-muted">{a.body}</p>
                </div>
              ))}
              {check.disclaimer && (
                <p className="text-xs text-text-muted">{check.disclaimer}</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {error}
          </p>
        )}

        <p className="mt-10 font-mono text-xs text-text-muted">
          Related:{" "}
          <Link href="/docs/api-reference" className="text-accent hover:underline">
            API reference
          </Link>{" "}
          ·{" "}
          <Link href="/roadmap" className="text-accent hover:underline">
            Roadmap
          </Link>{" "}
          ·{" "}
          <Link href="/oracle" className="text-accent hover:underline">
            Oracle
          </Link>
        </p>
      </div>
    </main>
  );
}
