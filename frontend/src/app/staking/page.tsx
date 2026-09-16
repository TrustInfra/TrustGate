"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StakePanel from "@/components/stake/StakePanel";

interface LeaderboardEntry {
  rank: number;
  wallet: string;
  committedScore: number;
  totalPoints?: number;
  stakeEvents: number;
  uniqueStakeContracts: number;
  longestLockDays: number;
  updatedAt: string;
}

interface StakingSignal {
  wallet: string;
  committedScore: number;
  totalPoints?: number;
  stakeEvents: number;
  unstakeEvents: number;
  uniqueStakeContracts: number;
  longestLockDays: number;
  gamingFlags: string[];
  observations: string[];
  scoreBoost: number;
  formula?: {
    diversityBonusApplied: boolean;
    consistencyBonusApplied: boolean;
    decayFactor: number;
    positionsAwarded: number;
    positionsVoided: number;
  };
}

function mask(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function StakingPage() {
  const [tab, setTab] = useState<"stake" | "intelligence">("stake");

  return (
    <main className="min-h-screen bg-background text-text">
      <div className="mx-auto max-w-4xl px-5 py-16">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-accent">
          Arc Mainnet
        </p>
        <h1 className="text-3xl font-semibold tracking-wide">Stake</h1>
        <p className="mt-3 max-w-2xl font-mono text-sm leading-relaxed text-text-secondary">
          Look up anything. File claims about it. Positive claims on the left,
          negative on the right. Circles are people. Open a claim to see who
          backed it, who challenged it, and why they staked.
        </p>

        <div className="mt-8 flex gap-2">
          <TabButton
            label="Stake"
            active={tab === "stake"}
            onClick={() => setTab("stake")}
          />
          <TabButton
            label="Intelligence"
            active={tab === "intelligence"}
            onClick={() => setTab("intelligence")}
          />
        </div>

        <div className="mt-6">
          {tab === "stake" ? <StakePanel /> : <IntelligencePanel />}
        </div>
      </div>
    </main>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-3 py-2 text-sm ${
        active ? "border-accent text-accent" : "border-border text-text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function IntelligencePanel() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("");
  const [signal, setSignal] = useState<StakingSignal | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/staking/leaderboard?limit=50");
      const data = await res.json();
      setEntries(data.entries ?? []);
      setNote(data.note ?? "");
    } catch {
      setError("Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  async function analyze() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      setError("Enter a valid wallet");
      return;
    }
    setAnalyzing(true);
    setError(null);
    setSignal(null);
    try {
      const res = await fetch(`/api/staking/analyze/${wallet}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "analyze_failed");
      setSignal(data);
      await loadBoard();
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div>
      <p className="mb-6 font-mono text-sm leading-relaxed text-text-secondary">
        Points = duration score × size multiplier × token trust multiplier.
        Minimum 7 days before points count. Self-staking and BLOCKED tokens
        earn zero. This tab reads other protocols&apos; stake-like
        transactions. It is not the TrustGate vault.
      </p>

      <section className="rounded border border-border bg-bg-surface p-6">
        <h2 className="text-lg font-medium">Analyze wallet</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className="flex-1 rounded border border-border bg-background px-3 py-2 font-mono text-sm"
            placeholder="0x…"
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
          />
          <button
            type="button"
            disabled={analyzing}
            onClick={analyze}
            className="rounded border border-border px-4 py-2 text-sm font-medium hover:border-accent/40 disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : "Analyze"}
          </button>
        </div>
        {signal && (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Metric label="Commitment" value={String(signal.committedScore)} />
            <Metric
              label="Formula points"
              value={String(signal.totalPoints ?? 0)}
            />
            <Metric label="Stake events" value={String(signal.stakeEvents)} />
            <Metric
              label="Longest lock (d)"
              value={String(signal.longestLockDays)}
            />
            <Metric
              label="Contracts"
              value={String(signal.uniqueStakeContracts)}
            />
            <Metric label="Score boost" value={`+${signal.scoreBoost}`} />
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-lg font-medium">Public leaderboard</h2>
          <button
            type="button"
            onClick={() => void loadBoard()}
            className="font-mono text-xs text-text-muted hover:text-text"
          >
            Refresh
          </button>
        </div>
        {note && (
          <p className="mb-4 font-mono text-xs text-text-muted">{note}</p>
        )}
        {loading ? (
          <p className="text-sm text-text-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="rounded border border-border bg-bg-surface p-6 text-sm text-text-muted">
            No entries yet.
          </p>
        ) : (
          <div className="overflow-hidden rounded border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-bg-surface font-mono text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Wallet</th>
                  <th className="px-4 py-3">Points</th>
                  <th className="px-4 py-3">Commitment</th>
                  <th className="px-4 py-3">Events</th>
                  <th className="px-4 py-3">Lock (d)</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.wallet}
                    className="border-t border-border/80 hover:bg-bg-surface/40"
                  >
                    <td className="px-4 py-3 tabular-nums text-text-muted">
                      {e.rank}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      <Link href={`/oracle?address=${e.wallet}`}>
                        {mask(e.wallet)}
                      </Link>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium">
                      {e.totalPoints ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.committedScore}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{e.stakeEvents}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {e.longestLockDays}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error && (
        <p className="mt-4 font-mono text-xs text-text-muted">{error}</p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
