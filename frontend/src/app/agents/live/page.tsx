'use client';

import { useEffect, useState } from 'react';

interface AgentEntry {
  label: string;
  address: string;
  score: number | null;
  tier: string | null;
  lastClaimAt: string | null;
  lastTxHash: string | null;
  lastTxUrl: string | null;
  totalUsdcEarned: string;
  totalClaims: number;
}

interface AgentStatus {
  running: boolean;
  lastCycleAt: string;
  cycleCount: number;
  cycleIntervalMs: number;
  threshold: number;
  totalClaims: number;
  totalUsdcMoved: string;
  agents: AgentEntry[];
}

const TIER_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500/15 text-red-300 border-red-500/30',
  LOW: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  HIGH: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  HIGH_ELITE: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export default function LiveAgentsPage() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch('/api/oracle/agent-status', { cache: 'no-store' });
        if (!r.ok) {
          if (!cancelled) setStale(true);
          return;
        }
        const data = (await r.json()) as AgentStatus;
        if (!cancelled) {
          setStatus(data);
          setStale(false);
        }
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    tick();
    const id = setInterval(tick, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <header className="mb-10">
          <p className="text-sm uppercase tracking-widest text-emerald-400">Live</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            Autonomous Agent Loop
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Real agents earning real USDC on Arc testnet. No humans. No buttons.
          </p>
        </header>

        <div className="mb-6 flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
              status?.running && !stale
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-zinc-700 bg-zinc-800/40 text-zinc-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status?.running && !stale ? 'animate-pulse bg-emerald-400' : 'bg-zinc-600'
              }`}
            />
            {status?.running && !stale ? 'Loop running' : 'Loop offline'}
          </span>
          {status?.lastCycleAt && (
            <span className="text-xs text-zinc-500">
              last cycle {new Date(status.lastCycleAt).toLocaleTimeString()} · cycle #
              {status.cycleCount}
            </span>
          )}
        </div>

        <section className="mb-10 grid grid-cols-2 gap-4 md:grid-cols-3">
          <BigStat label="Autonomous Transactions" value={status?.totalClaims ?? '—'} />
          <BigStat
            label="USDC Moved Autonomously"
            value={status ? `${status.totalUsdcMoved}` : '—'}
          />
          <BigStat
            label="HIGH Threshold"
            value={status?.threshold ?? '—'}
            sub="auto-claim above this"
          />
        </section>

        <section>
          <h2 className="mb-4 text-2xl font-semibold">Agents</h2>
          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Label</th>
                  <th className="px-4 py-3">Address</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Last Claim</th>
                  <th className="px-4 py-3">Earned</th>
                  <th className="px-4 py-3">Claims</th>
                </tr>
              </thead>
              <tbody>
                {(status?.agents || []).map((a) => (
                  <tr key={a.address} className="border-t border-zinc-800/50">
                    <td className="px-4 py-3 font-medium">{a.label}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {a.address.slice(0, 6)}…{a.address.slice(-4)}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{a.score ?? '—'}</td>
                    <td className="px-4 py-3">
                      {a.tier && (
                        <span
                          className={`rounded border px-2 py-0.5 text-xs ${
                            TIER_COLORS[a.tier] || ''
                          }`}
                        >
                          {a.tier}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {a.lastTxUrl ? (
                        <a
                          href={a.lastTxUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-xs text-emerald-400 hover:underline"
                        >
                          {a.lastTxHash?.slice(0, 10)}…
                        </a>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{a.totalUsdcEarned}</td>
                    <td className="px-4 py-3 tabular-nums">{a.totalClaims}</td>
                  </tr>
                ))}
                {!status?.agents?.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                      Waiting for first cycle from agent loop worker…
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function BigStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-zinc-500">{sub}</p>}
    </div>
  );
}
