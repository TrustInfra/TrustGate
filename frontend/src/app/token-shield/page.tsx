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
import {
  HistoryEntry,
  loadHistory,
  maskAddress,
  prependEntry,
  relativeTime,
  saveHistory,
} from "@/lib/recent-history";

const TOKEN_ORACLE_PROXY = "/api/oracle/token";
const TOKEN_STATS_PROXY = "/api/oracle/oracle/token/stats";
const HISTORY_KEY = "trustgate_token_history";

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

type Confidence = "HIGH" | "MEDIUM" | "LOW";

interface TokenScoreResult {
  score: number;
  tier: string;
  contractType?: string;
  txCount?: number;
  flags?: string[];
  confidence?: Confidence;
  label?: string;
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

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  HIGH: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  MEDIUM: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
  LOW: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

function confidenceClass(confidence: Confidence): string {
  return CONFIDENCE_COLORS[confidence] ?? TIER_FALLBACK;
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
    if (phase === "done" || phase === "error") setPhase("idle");
  };

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
        recordHistory({
          address,
          score: data.score,
          tier: data.tier,
          at: new Date().toISOString(),
        });
        setPhase("done");
        return;
      }

      if (challenge.status !== 402) {
        // Read the body once; a Response stream can only be consumed a single
        // time. Try to parse it as JSON, otherwise use the raw text.
        const raw = await challenge.text();
        let body: unknown = null;
        let detail = raw;
        try {
          body = JSON.parse(raw);
          detail = JSON.stringify(body);
        } catch {
          // Non-JSON body — keep the raw text.
        }
        const friendly =
          body && typeof body === "object" && body !== null &&
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : null;
        throw new Error(
          friendly ?? `Oracle returned ${challenge.status}. ${detail}`.trim()
        );
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

      // Fresh per-request opaque nonce. Nald's replay protection is a single
      // global `usedNonces` set — wallet-local blockchain nonces collide
      // across users (two payers both at tx nonce 3 → second one 409s as
      // replay). UUIDs avoid that entirely.
      const nonce = crypto.randomUUID();

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
        // Read the body once; a Response stream can only be consumed a single
        // time. Try to pretty-print it as JSON, otherwise use the raw text.
        const raw = await paid.text();
        let detail = raw;
        try {
          detail = JSON.stringify(JSON.parse(raw));
        } catch {
          // Non-JSON body — keep the raw text.
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
      recordHistory({
        address,
        score: data.score,
        tier: data.tier,
        at: new Date().toISOString(),
      });
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
        {result && phase === "done" && <ResultCard result={result} />}

        {/* Recent Checks (localStorage, last 5) */}
        {history.length > 0 && (
          <section className="mb-12 mt-12">
            <h2 className="mb-3 text-sm uppercase tracking-widest text-zinc-500">
              Recent Checks
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
                  {history.map((entry, i) => (
                    <tr
                      key={`${entry.address}-${entry.at}-${i}`}
                      onClick={() => pickRecent(entry.address)}
                      className="cursor-pointer border-t border-zinc-800/50 transition-colors hover:bg-zinc-900/40"
                    >
                      <td className="px-4 py-3 font-mono">{maskAddress(entry.address)}</td>
                      <td className="px-4 py-3 tabular-nums">{entry.score}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs ${tierClass(entry.tier)}`}
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

function ResultCard({ result }: { result: TokenScoreResult }) {
  const isContract = result.contractType === "CONTRACT";
  const label =
    result.label ?? (isContract ? "Contract Score" : "ERC-20 Token Score");
  const flags = Array.isArray(result.flags) ? result.flags : [];
  return (
    <section className="mb-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
      <p className="text-xs uppercase tracking-widest text-zinc-500">{label}</p>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <div className="text-5xl font-bold tabular-nums">{result.score}</div>
        <span
          className={`rounded border px-2.5 py-1 text-xs font-semibold tracking-wide ${tierClass(result.tier)}`}
        >
          {result.tier}
        </span>
        {result.confidence && (
          <span
            className={`rounded border px-2.5 py-1 text-xs font-semibold tracking-wide ${confidenceClass(result.confidence)}`}
          >
            {result.confidence} CONFIDENCE
          </span>
        )}
      </div>
      {flags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {flags.map((flag) => (
            <span
              key={flag}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold tracking-wide text-amber-200"
            >
              {flag}
            </span>
          ))}
        </div>
      )}
      {typeof result.txCount === "number" && (
        <p className="mt-3 text-sm text-zinc-400 tabular-nums">
          {result.txCount.toLocaleString()} transactions recorded
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
