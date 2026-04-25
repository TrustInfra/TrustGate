'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from 'wagmi';
import { ConnectKitButton } from 'connectkit';
import { CONTRACT_ADDRESSES, arcTestnet } from '@/lib/constants';
import { erc20Abi } from '@/lib/abi/ERC20';

// Browser calls go through the Next.js proxy at /api/oracle/* to avoid mixed
// content issues — the upstream HTTP oracle URL only lives on the server.
const ORACLE_PROXY = '/api/oracle';

const PAYMENT_AMOUNT_RAW = 1000n; // 0.001 USDC at 6 decimals
const PAYMENT_AMOUNT_HUMAN = '0.001';
const PAYMENT_RECIPIENT = CONTRACT_ADDRESSES.trustGate;
const USDC_ADDRESS = CONTRACT_ADDRESSES.usdc;

type QueryPhase =
  | 'idle'
  | 'challenge'
  | 'switch-network'
  | 'sign'
  | 'confirm'
  | 'fetch'
  | 'done'
  | 'error';

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

interface PaymentRequirement {
  amount?: string;
  currency?: string;
  recipient?: string;
  network?: string;
  memo?: string;
  [k: string]: unknown;
}

const TIER_COLORS: Record<string, string> = {
  BLOCKED: 'bg-red-500/15 text-red-300 border-red-500/30',
  LOW: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  MEDIUM: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  HIGH: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  HIGH_ELITE: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
};

function phaseLabel(phase: QueryPhase): string {
  switch (phase) {
    case 'challenge':
      return 'Requesting payment quote…';
    case 'switch-network':
      return 'Switching to Arc Testnet…';
    case 'sign':
      return 'Awaiting wallet signature…';
    case 'confirm':
      return 'Confirming on Arc…';
    case 'fetch':
      return 'Fetching trust score…';
    default:
      return 'Query Trust Score (0.001 USDC)';
  }
}

export default function OraclePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [address, setAddress] = useState('');
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [phase, setPhase] = useState<QueryPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paymentTx, setPaymentTx] = useState<`0x${string}` | null>(null);
  const [tab, setTab] = useState<'js' | 'py' | 'curl'>('js');

  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const onArc = chainId === arcTestnet.id;
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

  const query = async () => {
    if (!isConnected || !walletAddress) {
      setError('Connect your wallet first.');
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      setError('Enter a valid Arc wallet address');
      return;
    }
    if (!publicClient) {
      setError('Arc public client unavailable. Try refreshing the page.');
      return;
    }

    setError(null);
    setResult(null);
    setPaymentTx(null);

    try {
      // Step 1 — challenge the oracle, expect HTTP 402
      setPhase('challenge');
      const challenge = await fetch(`${ORACLE_PROXY}/oracle/${address}`, {
        cache: 'no-store',
      });

      if (challenge.status === 200) {
        // Dev-mode or already paid path — surface the result directly.
        const data = (await challenge.json()) as ScoreResult;
        setResult(data);
        setPhase('done');
        return;
      }

      if (challenge.status !== 402) {
        let detail = '';
        try {
          detail = JSON.stringify(await challenge.json());
        } catch {
          detail = await challenge.text();
        }
        throw new Error(`Oracle returned ${challenge.status}. ${detail}`.trim());
      }

      // Read the payment requirement (logged for transparency / debugging).
      const requirement = (await challenge.json()) as PaymentRequirement;
      if (typeof window !== 'undefined') {
        // eslint-disable-next-line no-console
        console.log('[oracle] payment requirement:', requirement);
      }

      // Step 2 — make sure the wallet is on Arc testnet
      if (!onArc) {
        setPhase('switch-network');
        try {
          await switchChainAsync({ chainId: arcTestnet.id });
        } catch (err) {
          throw new Error(
            `Switch to Arc Testnet (chain id ${arcTestnet.id}) to continue. ` +
              ((err as Error).message ?? '')
          );
        }
      }

      // Step 3 — sign and broadcast the USDC transfer
      setPhase('sign');
      const txHash = await writeContractAsync({
        chainId: arcTestnet.id,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [PAYMENT_RECIPIENT, PAYMENT_AMOUNT_RAW],
      });
      setPaymentTx(txHash);

      // Step 4 — wait for the receipt on Arc
      setPhase('confirm');
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (receipt.status !== 'success') {
        throw new Error(
          `Payment transaction reverted on Arc. Hash: ${txHash}`
        );
      }

      // Step 5 — replay the oracle request with the proof header
      setPhase('fetch');
      const paid = await fetch(`${ORACLE_PROXY}/oracle/${address}`, {
        cache: 'no-store',
        headers: {
          'X-Payment': txHash,
          'X-Payment-Tx': txHash,
        },
      });
      if (!paid.ok) {
        let detail = '';
        try {
          detail = JSON.stringify(await paid.json());
        } catch {
          detail = await paid.text();
        }
        throw new Error(
          `Oracle rejected payment proof (${paid.status}). ${detail}`.trim()
        );
      }
      const data = (await paid.json()) as ScoreResult;
      setResult(data);
      setPhase('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error('[oracle] query failed:', err);
      setError(humaniseWalletError(message));
      setPhase('error');
    }
  };

  const codeExamples = useMemo(
    () => ({
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
    }),
    []
  );

  const buttonLabel = phaseLabel(phase);
  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address);

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
            Query any Arc testnet address. Costs {PAYMENT_AMOUNT_HUMAN} USDC paid from
            your wallet to the TrustGate contract.
          </p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value.trim());
                setError(null);
                if (phase === 'done' || phase === 'error') setPhase('idle');
              }}
              placeholder="0x..."
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none"
            />
            {!isConnected ? (
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button
                    onClick={show}
                    className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    Connect wallet to query
                  </button>
                )}
              </ConnectKitButton.Custom>
            ) : (
              <button
                onClick={query}
                disabled={busy || !validAddress}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy && <Spinner />}
                {buttonLabel}
              </button>
            )}
          </div>

          {/* Phase progress */}
          {busy && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-200">{phaseLabel(phase)}</p>
              {paymentTx && (
                <p className="mt-1 font-mono text-xs text-zinc-500 break-all">
                  Payment tx: {paymentTx}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              {error}
            </div>
          )}

          {!isConnected && (
            <p className="mt-4 text-xs text-zinc-500">
              The playground sends a real USDC transfer on Arc Testnet. Make sure your
              wallet is on chain id {arcTestnet.id} and has at least{' '}
              {PAYMENT_AMOUNT_HUMAN} USDC plus gas.
            </p>
          )}

          {result && phase === 'done' && (
            <ScoreCard result={result} paymentTx={paymentTx} />
          )}
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
                      <td className="px-4 py-3">{q.paid ? 'Yes' : '—'}</td>
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

function humaniseWalletError(message: string): string {
  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return 'Wallet signature was rejected. Click the button again to retry.';
  }
  if (/insufficient funds|exceeds the balance/i.test(message)) {
    return 'Insufficient USDC for the 0.001 USDC payment plus Arc gas.';
  }
  return message;
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

function ScoreCard({
  result,
  paymentTx,
}: {
  result: ScoreResult;
  paymentTx: `0x${string}` | null;
}) {
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
      {paymentTx && (
        <p className="mt-4 font-mono text-[11px] text-zinc-500 break-all">
          Settled by tx {paymentTx}
        </p>
      )}
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
