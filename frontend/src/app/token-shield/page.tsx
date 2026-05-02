"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ConnectKitButton } from "connectkit";
import { CONTRACT_ADDRESSES, arcTestnet } from "@/lib/constants";
import { erc20Abi } from "@/lib/abi/ERC20";

const TOKEN_ORACLE_PROXY = "/api/oracle/token";
const TOKEN_STATS_PROXY = "/api/oracle/oracle/token/stats";

const PAYMENT_AMOUNT_RAW = 1000n;
const PAYMENT_AMOUNT_HUMAN = "0.001";
const PAYMENT_RECIPIENT = CONTRACT_ADDRESSES.trustGate;
const USDC_ADDRESS = CONTRACT_ADDRESSES.usdc;

type QueryPhase =
  | "idle"
  | "challenge"
  | "switch-network"
  | "sign"
  | "confirm"
  | "fetch"
  | "done"
  | "error";

interface TokenScoreResult {
  address?: string;
  score: number;
  tier: string;
  trend?: string;
  updatedAt?: string;
  lastUpdated?: string;
  recommendation?: string;
}

interface TokenStatsRecentQuery {
  addressMasked?: string;
  address?: string;
  score: number;
  tier: string;
  paid?: boolean;
  at: string;
}

interface TokenStats {
  totalQueries?: number;
  uniqueTokensScored?: number;
  averageScore?: number;
  recentQueries?: TokenStatsRecentQuery[];
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
  BLOCKED: "bg-red-500/15 text-red-300 border-red-500/30",
  HIGH_RISK: "bg-red-500/15 text-red-300 border-red-500/30",
  LOW: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  RISKY: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  MODERATE: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  HIGH: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  SAFE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  HIGH_ELITE: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  TRUSTED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
};

const TIER_FALLBACK = "bg-zinc-800 text-zinc-300 border-zinc-700";

function tierClass(tier: string): string {
  return TIER_COLORS[tier.toUpperCase()] ?? TIER_FALLBACK;
}

function isTokenScoreResult(value: unknown): value is TokenScoreResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.score === "number" && typeof v.tier === "string";
}

function phaseLabel(phase: QueryPhase): string {
  switch (phase) {
    case "challenge":
      return "Requesting payment quote...";
    case "switch-network":
      return "Switching to Arc Testnet...";
    case "sign":
      return "Awaiting wallet signature...";
    case "confirm":
      return "Confirming on Arc...";
    case "fetch":
      return "Fetching token score...";
    default:
      return `Check Token (${PAYMENT_AMOUNT_HUMAN} USDC)`;
  }
}

function maskAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTimestamp(value: string | undefined): string {
  if (!value) return "—";
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleString();
}

function relativeTime(value: string): string {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

function humaniseWalletError(message: string): string {
  if (/user rejected|user denied|rejected the request/i.test(message)) {
    return "Wallet signature was rejected. Click the button again to retry.";
  }
  if (/insufficient funds|exceeds the balance/i.test(message)) {
    return `Insufficient USDC for the ${PAYMENT_AMOUNT_HUMAN} USDC payment plus Arc gas.`;
  }
  return message;
}

export default function TokenShieldPage() {
  const [address, setAddress] = useState("");
  const [result, setResult] = useState<TokenScoreResult | null>(null);
  const [phase, setPhase] = useState<QueryPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [paymentTx, setPaymentTx] = useState<`0x${string}` | null>(null);
  const [stats, setStats] = useState<TokenStats | null>(null);

  const { address: walletAddress, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const onArc = chainId === arcTestnet.id;
  const busy = phase !== "idle" && phase !== "done" && phase !== "error";
  const validAddress = /^0x[0-9a-fA-F]{40}$/.test(address);

  useEffect(() => {
    let active = true;
    let id: ReturnType<typeof setInterval> | null = null;

    const fetchStats = async (): Promise<boolean> => {
      try {
        const r = await fetch(TOKEN_STATS_PROXY, { cache: "no-store" });
        if (!active) return false;
        if (!r.ok) return false;
        const data = (await r.json()) as TokenStats;
        if (active) setStats(data);
        return true;
      } catch {
        return false;
      }
    };

    void fetchStats().then((ok) => {
      if (!active || !ok) return;
      id = setInterval(() => {
        void fetchStats().then((stillOk) => {
          if (!stillOk && id) {
            clearInterval(id);
            id = null;
          }
        });
      }, 10_000);
    });

    return () => {
      active = false;
      if (id) clearInterval(id);
    };
  }, []);

  const query = async () => {
    if (!isConnected || !walletAddress) {
      setError("Connect your wallet first.");
      return;
    }
    if (!validAddress) {
      setError("Enter a valid Arc token contract address (0x... 40 hex chars).");
      return;
    }
    if (!publicClient) {
      setError("Arc public client unavailable. Try refreshing the page.");
      return;
    }

    setError(null);
    setResult(null);
    setPaymentTx(null);

    try {
      setPhase("challenge");
      const challenge = await fetch(`${TOKEN_ORACLE_PROXY}/${address}`, {
        cache: "no-store",
      });

      if (challenge.status === 200) {
        const data: unknown = await challenge.json();
        if (!isTokenScoreResult(data)) {
          throw new Error("Oracle returned an unexpected response shape.");
        }
        setResult(data);
        setPhase("done");
        return;
      }

      if (challenge.status !== 402) {
        let detail = "";
        try {
          detail = JSON.stringify(await challenge.json());
        } catch {
          detail = await challenge.text();
        }
        throw new Error(`Oracle returned ${challenge.status}. ${detail}`.trim());
      }

      const requirement = (await challenge.json()) as PaymentRequirement;
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("[token-shield] payment requirement:", requirement);
      }

      if (!onArc) {
        setPhase("switch-network");
        try {
          await switchChainAsync({ chainId: arcTestnet.id });
        } catch (err) {
          throw new Error(
            `Switch to Arc Testnet (chain id ${arcTestnet.id}) to continue. ` +
              ((err as Error).message ?? "")
          );
        }
      }

      setPhase("sign");
      const txHash = await writeContractAsync({
        chainId: arcTestnet.id,
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: "transfer",
        args: [PAYMENT_RECIPIENT, PAYMENT_AMOUNT_RAW],
      });
      setPaymentTx(txHash);

      setPhase("confirm");
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new Error(`Payment transaction reverted on Arc. Hash: ${txHash}`);
      }

      setPhase("fetch");

      let nonce: number;
      try {
        const tx = await publicClient.getTransaction({ hash: txHash });
        nonce = Number(tx.nonce);
      } catch {
        nonce = Number(receipt.transactionIndex);
      }

      const payload = JSON.stringify({
        txHash,
        nonce,
        from: walletAddress,
        network: "Arc Testnet",
        chainId: arcTestnet.id,
        amount: PAYMENT_AMOUNT_HUMAN,
        currency: "USDC",
        recipient: PAYMENT_RECIPIENT,
      });
      const xPaymentHeader =
        typeof btoa === "function"
          ? btoa(payload)
          : Buffer.from(payload, "utf-8").toString("base64");

      const paid = await fetch(`${TOKEN_ORACLE_PROXY}/${address}`, {
        cache: "no-store",
        headers: {
          "X-Payment": xPaymentHeader,
          "X-Payment-Tx": txHash,
        },
      });
      if (!paid.ok) {
        let detail = "";
        try {
          detail = JSON.stringify(await paid.json());
        } catch {
          detail = await paid.text();
        }
        throw new Error(
          `Oracle rejected payment proof (${paid.status}). ${detail}`.trim()
        );
      }
      const data: unknown = await paid.json();
      if (!isTokenScoreResult(data)) {
        throw new Error("Oracle returned an unexpected response shape.");
      }
      setResult(data);
      setPhase("done");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[token-shield] query failed:", err);
      setError(humaniseWalletError(message));
      setPhase("error");
    }
  };

  const buttonLabel = phaseLabel(phase);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <header className="mb-10">
          <p className="text-xs uppercase tracking-widest text-emerald-400">
            Token Shield
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Is this token credible?
          </h1>
          <p className="mt-3 max-w-xl text-sm text-zinc-400">
            Paste any Arc token contract address. Pay {PAYMENT_AMOUNT_HUMAN} USDC.
            Get an instant trust score based on who holds it and how they got it.
          </p>
        </header>

        {/* Input */}
        <section className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
          <div className="flex flex-col gap-3 md:flex-row">
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value.trim());
                setError(null);
                if (phase === "done" || phase === "error") setPhase("idle");
              }}
              placeholder="Token contract address 0x..."
              className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none"
              spellCheck={false}
              autoComplete="off"
            />
            {!isConnected ? (
              <ConnectKitButton.Custom>
                {({ show }) => (
                  <button
                    type="button"
                    onClick={show}
                    className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
                  >
                    Connect wallet to check
                  </button>
                )}
              </ConnectKitButton.Custom>
            ) : (
              <button
                type="button"
                onClick={query}
                disabled={busy || !validAddress}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy && <Spinner />}
                {buttonLabel}
              </button>
            )}
          </div>

          {busy && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-200">{phaseLabel(phase)}</p>
              {paymentTx && (
                <p className="mt-1 break-all font-mono text-xs text-zinc-500">
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
              Token Shield runs a real USDC transfer on Arc Testnet. Make sure your
              wallet is on chain id {arcTestnet.id} and has at least{" "}
              {PAYMENT_AMOUNT_HUMAN} USDC plus gas.
            </p>
          )}
        </section>

        {/* Result */}
        {result && phase === "done" && (
          <ResultCard result={result} paymentTx={paymentTx} queriedAddress={address} />
        )}

        {/* Live Feed */}
        {stats && stats.recentQueries && stats.recentQueries.length > 0 && (
          <section className="mb-12 mt-12">
            <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-500">
              Live Query Feed
            </h2>
            <div className="overflow-hidden rounded-2xl border border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-900/60 text-left text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Token</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentQueries.slice(0, 10).map((q, i) => {
                    const masked =
                      q.addressMasked ??
                      (q.address ? maskAddress(q.address) : "—");
                    return (
                      <tr key={i} className="border-t border-zinc-800/50">
                        <td className="px-4 py-3 font-mono">{masked}</td>
                        <td className="px-4 py-3 tabular-nums">{q.score}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded border px-2 py-0.5 text-xs ${tierClass(q.tier)}`}
                          >
                            {q.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500">
                          {relativeTime(q.at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function ResultCard({
  result,
  paymentTx,
  queriedAddress,
}: {
  result: TokenScoreResult;
  paymentTx: `0x${string}` | null;
  queriedAddress: string;
}) {
  const updated = result.updatedAt ?? result.lastUpdated;
  const trend = result.trend?.toLowerCase();
  const trendShown = trend === "rising" || trend === "falling";
  const trendColor =
    trend === "rising"
      ? "text-emerald-400"
      : trend === "falling"
        ? "text-red-400"
        : "text-zinc-400";
  const trendArrow = trend === "rising" ? "↑" : trend === "falling" ? "↓" : "";

  const displayAddress = result.address ?? queriedAddress;

  return (
    <section className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <p className="break-all font-mono text-xs text-zinc-500">{displayAddress}</p>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <div className="text-5xl font-bold tabular-nums">{result.score}</div>
        <span
          className={`rounded border px-2.5 py-1 text-xs font-semibold tracking-wide ${tierClass(result.tier)}`}
        >
          {result.tier}
        </span>
        {trendShown && (
          <span className={`text-sm font-medium ${trendColor}`}>
            {trendArrow} {trend}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
        <span>Last updated: {formatTimestamp(updated)}</span>
        {result.recommendation && (
          <span>
            Recommendation:{" "}
            <span className="text-zinc-300">{result.recommendation}</span>
          </span>
        )}
      </div>

      <p className="mt-4 text-xs text-zinc-500">
        Score updates automatically over time.
      </p>

      {paymentTx && (
        <p className="mt-4 break-all font-mono text-[11px] text-zinc-600">
          Settled by tx {paymentTx}
        </p>
      )}
    </section>
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
