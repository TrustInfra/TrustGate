'use client';

import { useEffect, useState } from 'react';

const ORACLE_BASE =
  process.env.NEXT_PUBLIC_ORACLE_URL || 'https://trustgate-oracle.up.railway.app';

interface Stats {
  totalQueries: number;
  totalUsdcEarned: string;
  uniqueAddressesScored: number;
  averageScore: number;
  tierDistribution: Record<string, number>;
  recentQueries: Array<{
    addressMasked: string;
    score: number;
    tier: string;
    paid: boolean;
    at: string;
  }>;
}

interface ScoreResult {
  address: string;
  score: number;
  tier: string;
  recommendation: string;
  breakdown: {
    txPoints: number;
    usdcPoints: number;
    contractPoints: number;
    deploymentPoints: number;
    txCount: number;
    usdcBalance: number;
    contractInteractions: number;
    deployments: number;
  };
}

const TIER_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500/15 text-red-300 border-red-500/30',
  LOW: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  HIGH: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  HIGH_ELITE: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

export default function OraclePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'js' | 'py' | 'curl'>('js');

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const r = await fetch(`${ORACLE_BASE}/oracle/stats`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as Stats;
        if (!cancelled) setStats(data);
      } catch {
        /* ignore */
      }
    };
    fetchStats();
    const id = setInterval(fetchStats, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const query = async () => {
    setError(null);
    setResult(null);
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError('Enter a valid Arc wallet address');
      return;
    }
    setLoading(true);
    try {
      // Step 1: hit the oracle without payment, get the 402 challenge
      const challenge = await fetch(`${ORACLE_BASE}/oracle/${address}`);
      if (challenge.status !== 402) {
        // already returned a result somehow (e.g. dev-mode)
        if (challenge.ok) {
          setResult(await challenge.json());
          return;
        }
        setError(`unexpected status ${challenge.status}`);
        return;
      }

      const requirement = await challenge.json();

      // Step 2: prompt user to pay via wallet (handled in PayButton below)
      // For the playground we surface the requirement and let user
      // paste a tx hash + nonce. This keeps the page wallet-agnostic
      // and shows the x402 flow honestly.
      setError(
        `Payment required: ${requirement.amount} USDC to ${requirement.recipient} on Arc Testnet. ` +
          `Send the transfer in your wallet, then paste the tx hash below to retry.`
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const codeExamples = {
    js: `const response = await fetch(
  'https://trustgate-oracle.up.railway.app/oracle/0xYOUR_ADDRESS',
  { headers: { 'X-Payment': x402Token } }
)
const trust = await response.json()`,
    py: `import requests
response = requests.get(
  'https://trustgate-oracle.up.railway.app/oracle/0xYOUR_ADDRESS',
  headers={'X-Payment': x402_token}
)`,
    curl: `curl -H "X-Payment: YOUR_TOKEN" \\
  https://trustgate-oracle.up.railway.app/oracle/0xYOUR_ADDRESS`,
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Hero */}
        <header className="mb-16">
          <p className="text-sm uppercase tracking-widest text-emerald-400">
            TrustGate Oracle
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            The Trust Layer for Arc
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-zinc-400">
            Pay 0.001 USDC, get an instant onchain trust score for any Arc address.
            x402-compatible. Built for autonomous agents.
          </p>
        </header>

        {/* Live Stats */}
        <section className="mb-16 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Queries" value={stats?.totalQueries ?? '—'} />
          <StatCard label="USDC Earned" value={stats ? `${stats.totalUsdcEarned}` : '—'} />
          <StatCard label="Unique Addresses" value={stats?.uniqueAddressesScored ?? '—'} />
          <StatCard label="Average Score" value={stats?.averageScore ?? '—'} />
        </section>

        {/* Playground */}
        <section className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <h2 className="text-2xl font-semibold">Playground</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Query any Arc testnet address. Costs 0.001 USDC.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={query}
              disabled={loading}
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading ? 'Querying…' : 'Query Trust Score (0.001 USDC)'}
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {error}
            </div>
          )}

          {result && <ScoreCard result={result} />}
        </section>

        {/* Live Feed */}
        {stats && stats.recentQueries.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-4 text-2xl font-semibold">Live Query Feed</h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Paid</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentQueries.slice(0, 10).map((q, i) => (
                    <tr key={i} className="border-t border-zinc-800/50">
                      <td className="px-4 py-3 font-mono">{q.addressMasked}</td>
                      <td className="px-4 py-3">{q.score}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs ${TIER_COLORS[q.tier] || ''}`}
                        >
                          {q.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3">{q.paid ? '✓' : '—'}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {new Date(q.at).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Code Examples */}
        <section className="mb-16">
          <h2 className="mb-4 text-2xl font-semibold">Integrate</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40">
            <div className="flex border-b border-zinc-800">
              {(['js', 'py', 'curl'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-5 py-3 text-sm font-medium transition ${
                    tab === t
                      ? 'border-b-2 border-emerald-500 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'js' ? 'JavaScript' : t === 'py' ? 'Python' : 'curl'}
                </button>
              ))}
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-sm text-zinc-200">
              <code>{codeExamples[tab]}</code>
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ScoreCard({ result }: { result: ScoreResult }) {
  return (
    <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-zinc-500">{result.address}</p>
          <p className="mt-2 text-4xl font-bold">{result.score}</p>
          <p className="mt-1 text-sm text-zinc-400">
            tier <span className="text-zinc-200">{result.tier}</span> · recommendation{' '}
            <span className="text-zinc-200">{result.recommendation}</span>
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
        <Cell label="Tx count" value={result.breakdown.txCount} />
        <Cell label="USDC bal" value={result.breakdown.usdcBalance} />
        <Cell label="Contract calls" value={result.breakdown.contractInteractions} />
        <Cell label="Deployments" value={result.breakdown.deployments} />
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-zinc-900/60 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
