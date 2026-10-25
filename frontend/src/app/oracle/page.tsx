'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { isContractAddress } from '@/lib/contract-detect';
import {
  HistoryEntry,
  loadHistory,
  maskAddress,
  prependEntry,
  relativeTime,
  saveHistory,
} from '@/lib/recent-history';
import TrustSourceShell from '@/components/trust-source/TrustSourceShell';
import {
  toPublicScoreView,
  type PublicScoreBody,
  type PublicScoreView,
} from '@/lib/public-score';

const HISTORY_KEY = 'trustgate_oracle_history';
const FAILURE_COOLDOWN_MS = 3000;

// Playground totals still come from the paid oracle proxy. Address scans
// call /api/arc-score and do not go through this proxy.
const ORACLE_PROXY = '/api/oracle';

type QueryPhase = 'idle' | 'fetch' | 'done' | 'error';

interface Stats {
  totalQueries: number;
  totalUsdcEarned: string;
  uniqueAddressesScored: number;
  averageScore: number;
}

const TIER_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500/15 text-red-300 border-red-500/30',
  LOW: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  HIGH: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  HIGH_ELITE: 'bg-zinc-100/10 text-zinc-100 border-zinc-400/40',
};

function phaseLabel(phase: QueryPhase): string {
  if (phase === 'fetch') return 'Reading onchain history…';
  return 'Scan address';
}

export default function OraclePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<PublicScoreView | null>(null);
  const [phase, setPhase] = useState<QueryPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [contractDetected, setContractDetected] = useState(false);
  const [tab, setTab] = useState<'js' | 'py' | 'curl'>('js');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const inFlightRef = useRef(false);

  // Tick cooldown down every 250ms after a failed query.
  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setTimeout(() => {
      setCooldownLeft((prev) => Math.max(0, prev - 250));
    }, 250);
    return () => clearTimeout(id);
  }, [cooldownLeft]);

  const cooldownActive = cooldownLeft > 0;

  useEffect(() => {
    setHistory(loadHistory(HISTORY_KEY));
  }, []);

  const recordHistory = (entry: HistoryEntry): void => {
    setHistory((prev) => {
      const next = prependEntry(prev, entry);
      saveHistory(HISTORY_KEY, next);
      return next;
    });
  };

  const pickRecent = (addr: string): void => {
    setAddress(addr);
    setError(null);
    if (phase === 'done' || phase === 'error') setPhase('idle');
  };

  const scan = async () => {
    if (inFlightRef.current) return;
    if (cooldownActive) return;
    inFlightRef.current = true;

    try {
      setContractDetected(false);
      if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
        setError('Enter a valid Arc wallet address');
        setPhase('idle');
        return;
      }

      setError(null);
      setResult(null);
      setPhase('fetch');

      const contractCheck = await isContractAddress(address);
      if (contractCheck.isContract) {
        setContractDetected(true);
        setPhase('error');
        return;
      }

      const res = await fetch(`/api/arc-score/${encodeURIComponent(address)}`, {
        cache: 'no-store',
      });
      if (res.status === 429) {
        throw new Error('Too many scans. Try again in a minute.');
      }
      let body: PublicScoreBody;
      try {
        body = (await res.json()) as PublicScoreBody;
      } catch {
        throw new Error(`Score request failed (${res.status})`);
      }
      if (!res.ok || typeof body.score !== 'number' || typeof body.tier !== 'string') {
        throw new Error(`Score request failed (${res.status})`);
      }

      const view = toPublicScoreView(address, body);
      setResult(view);
      recordHistory({
        address,
        score: view.score,
        tier: view.tier,
        at: new Date().toISOString(),
      });
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setPhase('error');
      setCooldownLeft(FAILURE_COOLDOWN_MS);
    } finally {
      inFlightRef.current = false;
    }
  };

  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      try {
        const r = await fetch(`${ORACLE_PROXY}/oracle/stats`, { cache: 'no-store' });
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


  const codeExamples = useMemo(
    () => ({
      js: `const response = await fetch(
  'https://www.trustgated.xyz/api/arc-score/0xYOUR_ADDRESS'
)
const trust = await response.json()`,
      py: `import requests
response = requests.get(
  'https://www.trustgated.xyz/api/arc-score/0xYOUR_ADDRESS'
)`,
      curl: `curl https://www.trustgated.xyz/api/arc-score/0xYOUR_ADDRESS`,
    }),
    []
  );

  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address);
  const cooldownSeconds = Math.ceil(cooldownLeft / 1000);
  const buttonLabel = cooldownActive
    ? `Try again in ${cooldownSeconds}s`
    : phaseLabel(phase);
  const buttonDisabled = busy || !validAddress || cooldownActive;

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
            Paste any Arc address and read its onchain trust score. No wallet
            and no payment. Built for people and for autonomous agents.
          </p>
        </header>

        {/* Live Stats */}
        <section className="mb-16 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Queries" value={stats?.totalQueries ?? '-'} />
          <StatCard label="USDC Earned" value={stats ? `${stats.totalUsdcEarned}` : '-'} />
          <StatCard label="Unique Addresses" value={stats?.uniqueAddressesScored ?? '-'} />
          <StatCard label="Average Score" value={stats?.averageScore ?? '-'} />
        </section>

        {/* Playground */}
        <section className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
          <h2 className="text-2xl font-semibold">Playground</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Paste an Arc wallet address. The scan reads onchain behavior. A
            contract address belongs on Token Shield.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value.trim());
                setError(null);
                setContractDetected(false);
                if (phase === 'done' || phase === 'error') setPhase('idle');
              }}
              placeholder="0x..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !buttonDisabled) void scan();
              }}
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
            <button
              onClick={() => void scan()}
              disabled={buttonDisabled}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Spinner />}
              {buttonLabel}
            </button>
          </div>

          {/* Phase progress */}
          {busy && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-200">{phaseLabel(phase)}</p>
            </div>
          )}

          {contractDetected && (
            <div className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-sm text-zinc-100">
              <p className="font-medium">That is a contract address.</p>
              <p className="mt-1 text-zinc-400">
                The Oracle scores wallets. To check a token or contract, use Token Shield.
              </p>
              <Link
                href="/token-shield"
                className="mt-3 inline-block rounded-md border border-zinc-700 px-3 py-1.5 font-medium text-zinc-100 hover:border-zinc-500"
              >
                Open Token Shield
              </Link>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {error}
            </div>
          )}

          {result && phase === 'done' && (
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-6">
              <TrustSourceShell address={address}>
                <ScoreCard result={result} />
              </TrustSourceShell>
            </div>
          )}
        </section>

        {/* Recent Checks (localStorage, last 5) */}
        {history.length > 0 && (
          <section className="mb-16">
            <h2 className="mb-4 text-2xl font-semibold">Recent Checks</h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Address</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => (
                    <tr
                      key={`${entry.address}-${entry.at}-${i}`}
                      onClick={() => pickRecent(entry.address)}
                      className="border-t border-zinc-800/50 cursor-pointer transition-colors hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-3 font-mono">{maskAddress(entry.address)}</td>
                      <td className="px-4 py-3 tabular-nums">{entry.score}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs ${TIER_COLORS[entry.tier] || ''}`}
                        >
                          {entry.tier}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {relativeTime(entry.at)}
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

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin text-zinc-950"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
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

function ScoreCard({ result }: { result: PublicScoreView }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-4xl font-bold tabular-nums">{result.score}</p>
        <p className="mt-1 text-sm text-zinc-400">
          tier <span className="text-zinc-200">{result.tier}</span>
          {' · recommendation '}
          <span className="text-zinc-200">{result.recommendation}</span>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Transactions
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {result.txCount.toLocaleString()}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Deployments
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {result.deployments.toLocaleString()}
          </p>
        </div>
      </div>

      {result.summary.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Behavioral summary
          </p>
          <ul className="space-y-1.5 text-sm text-zinc-300">
            {result.summary.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="text-zinc-500">·</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
