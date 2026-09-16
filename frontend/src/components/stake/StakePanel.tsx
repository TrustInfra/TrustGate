"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectKitButton } from "connectkit";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import { erc20Abi } from "@/lib/abi/ERC20";
import { subjectStakeAbi } from "@/lib/abi/SubjectStake";
import {
  ARC_MIN_MAX_FEE_PER_GAS_WEI,
  ARC_MIN_PRIORITY_FEE_WEI,
  CONTRACT_ADDRESSES,
  USDC_DECIMALS,
  arc,
} from "@/lib/chain";
import { isContractAddress } from "@/lib/contract-detect";
import { ensureArcMainnet } from "@/lib/ensure-arc";
import {
  canonicalizeSubject,
  type CanonicalSubject,
} from "@/lib/stake/canonicalize";
import { SUBJECT_KINDS, type SubjectKind } from "@/lib/stake/kinds";
import { vaultDeployed, type ClaimSummary, type PositionOnchain } from "@/lib/stake/read";

type Side = 0 | 1;
type Column = "positive" | "negative";

interface SubjectPayload {
  subject: CanonicalSubject;
  onchain: {
    exists: boolean;
    kind: string;
    canonical: string;
    supportTotal: string;
    challengeTotal: string;
    stakerCount: number;
    supportStakers: number;
    challengeStakers: number;
    statement: string;
    id: `0x${string}`;
  };
  claims: ClaimSummary[];
  position: {
    support: string;
    challenge: string;
    supportReason: string;
    challengeReason: string;
  } | null;
}

interface ClaimPayload {
  onchain: SubjectPayload["onchain"] & { parentId: `0x${string}` };
  positions: PositionOnchain[];
  position: SubjectPayload["position"];
}

function fmtUsd(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function mask(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function StakePanel({
  initialQuery = "",
  initialKind,
}: {
  initialQuery?: string;
  initialKind?: SubjectKind;
}) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: arc.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [query, setQuery] = useState(initialQuery);
  const [kindOverride, setKindOverride] = useState<SubjectKind | "auto">(
    initialKind ?? "auto"
  );
  const [payload, setPayload] = useState<SubjectPayload | null>(null);
  const [column, setColumn] = useState<Column>("positive");
  const [openClaimId, setOpenClaimId] = useState<`0x${string}` | null>(null);
  const [claim, setClaim] = useState<ClaimPayload | null>(null);
  const [showReasons, setShowReasons] = useState(false);
  const [reasonSide, setReasonSide] = useState<Column>("positive");

  const [amount, setAmount] = useState("1");
  const [reason, setReason] = useState("");
  const [statement, setStatement] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => {
    return canonicalizeSubject(query, {
      kind: kindOverride === "auto" ? undefined : kindOverride,
    });
  }, [query, kindOverride]);

  const loadIdentity = useCallback(async () => {
    if (!parsed) {
      setPayload(null);
      return;
    }
    setError(null);
    try {
      const params = new URLSearchParams({
        kind: parsed.kind,
        canonical: parsed.canonical,
      });
      if (address) params.set("staker", address);
      const res = await fetch(`/api/stake/subject?${params}`, { cache: "no-store" });
      const data = (await res.json()) as SubjectPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "load_failed");
      setPayload({ ...data, claims: data.claims ?? [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [parsed, address]);

  const loadClaim = useCallback(async (id: `0x${string}`) => {
    try {
      const params = new URLSearchParams({ id });
      if (address) params.set("staker", address);
      const res = await fetch(`/api/stake/claim?${params}`, { cache: "no-store" });
      const data = (await res.json()) as ClaimPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "load_failed");
      setClaim(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    }
  }, [address]);

  useEffect(() => {
    void loadIdentity();
  }, [loadIdentity]);

  useEffect(() => {
    if (openClaimId) void loadClaim(openClaimId);
    else setClaim(null);
  }, [openClaimId, loadClaim]);

  async function ensureChain() {
    await ensureArcMainnet({ chainId, switchChainAsync });
  }

  async function resolveSubject(): Promise<CanonicalSubject | null> {
    if (!parsed) return null;
    if (parsed.kind === "wallet" || parsed.kind === "token") {
      const hex = parsed.display;
      if (/^0x[0-9a-fA-F]{40}$/.test(hex) && kindOverride === "auto") {
        const { isContract } = await isContractAddress(hex);
        return canonicalizeSubject(hex, {
          addressKind: isContract ? "token" : "wallet",
        });
      }
    }
    return parsed;
  }

  async function approve(raw: bigint) {
    if (!publicClient || !address) throw new Error("No public client");
    const allowance = await publicClient.readContract({
      address: CONTRACT_ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "allowance",
      args: [address, CONTRACT_ADDRESSES.subjectStake],
    });
    if (allowance >= raw) return;
    setStatus("Approve USDC");
    const hash = await writeContractAsync({
      chainId: arc.id,
      address: CONTRACT_ADDRESSES.usdc,
      abi: erc20Abi,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.subjectStake, raw],
      maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE_WEI,
    });
    await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
  }

  async function onStakeIdentity(side: Side) {
    const subject = await resolveSubject();
    if (!subject) {
      setError("Enter a subject");
      return;
    }
    await sendStake(async (raw) => {
      const hash = await writeContractAsync({
        chainId: arc.id,
        address: CONTRACT_ADDRESSES.subjectStake,
        abi: subjectStakeAbi,
        functionName: "stake",
        args: [subject.kind, subject.canonical, side, raw, reason.trim()],
        maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE_WEI,
      });
      return hash;
    });
  }

  async function onStakeClaim(side: Side) {
    const subject = await resolveSubject();
    if (!subject) {
      setError("Enter a subject first");
      return;
    }
    const text = statement.trim();
    if (text.length < 4) {
      setError("Claim must be at least 4 characters");
      return;
    }
    if (reason.trim().length < 4) {
      setError("Reason must be at least 4 characters");
      return;
    }
    await sendStake(async (raw) => {
      const hash = await writeContractAsync({
        chainId: arc.id,
        address: CONTRACT_ADDRESSES.subjectStake,
        abi: subjectStakeAbi,
        functionName: "stakeClaim",
        args: [subject.kind, subject.canonical, text, side, raw, reason.trim()],
        maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE_WEI,
      });
      return hash;
    });
  }

  async function onStakeOpenClaim(side: Side) {
    const subject = await resolveSubject();
    if (!subject || !claim) return;
    if (reason.trim().length < 4) {
      setError("Reason must be at least 4 characters");
      return;
    }
    await sendStake(async (raw) => {
      const hash = await writeContractAsync({
        chainId: arc.id,
        address: CONTRACT_ADDRESSES.subjectStake,
        abi: subjectStakeAbi,
        functionName: "stakeClaim",
        args: [
          subject.kind,
          subject.canonical,
          claim.onchain.statement,
          side,
          raw,
          reason.trim(),
        ],
        maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS_WEI,
      maxPriorityFeePerGas: ARC_MIN_PRIORITY_FEE_WEI,
      });
      return hash;
    });
  }

  async function sendStake(write: (raw: bigint) => Promise<`0x${string}`>) {
    if (!vaultDeployed()) {
      setError("SubjectStake is not deployed on Arc yet.");
      return;
    }
    if (!isConnected || !address) {
      setError("Connect a wallet");
      return;
    }
    const raw = parseUnits(amount || "0", USDC_DECIMALS);
    if (raw < 1_000_000n) {
      setError("Minimum stake is 1 USDC");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureChain();
      if (!publicClient) throw new Error("No public client");
      await approve(raw);
      setStatus("Staking");
      const hash = await write(raw);
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      setStatus("Staked");
      await loadIdentity();
      if (openClaimId) await loadClaim(openClaimId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "stake_failed");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  const claims = payload?.claims ?? [];
  const positiveClaims = claims.filter((c) => c.supportStakers > 0);
  const negativeClaims = claims.filter((c) => c.challengeStakers > 0);
  const visibleClaims = column === "positive" ? positiveClaims : negativeClaims;

  const reasons = (claim?.positions ?? []).filter((p) => {
    if (reasonSide === "positive") return Number(p.support) > 0;
    return Number(p.challenge) > 0;
  });

  return (
    <div className="rounded border border-border bg-bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-medium">On-chain claims</h2>
        <ConnectKitButton />
      </div>
      {!vaultDeployed() && (
        <p className="mt-3 font-mono text-xs text-text-muted">
          Vault is not deployed yet. Layout is live; writes wait for SubjectStake
          on Arc Mainnet.
        </p>
      )}
      <p className="mt-2 font-mono text-xs text-text-muted">
        Look up anything. Claims about it sit in two columns: positive left,
        negative right. Open a claim to see who backed it, who challenged it,
        and why.
      </p>

      <input
        className="mt-5 w-full rounded border border-border bg-background px-3 py-2 font-mono text-sm"
        placeholder="x.com/handle, github.com/org, 0x…, https://site, anything"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpenClaimId(null);
        }}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <KindChip
          label="auto"
          active={kindOverride === "auto"}
          onClick={() => setKindOverride("auto")}
        />
        {SUBJECT_KINDS.filter((k) => k !== "claim").map((k) => (
          <KindChip
            key={k}
            label={k}
            active={kindOverride === k}
            onClick={() => setKindOverride(k)}
          />
        ))}
      </div>

      {parsed && (
        <div className="mt-8 border-t border-border pt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
            {parsed.kind}
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-wide break-all">
            {parsed.display}
          </h3>

          <div className="mt-5 flex flex-wrap items-center gap-6">
            <OverallStat
              label="Backing"
              people={payload?.onchain.supportStakers ?? 0}
              usd={payload?.onchain.supportTotal ?? "0"}
              positive
            />
            <OverallStat
              label="Against"
              people={payload?.onchain.challengeStakers ?? 0}
              usd={payload?.onchain.challengeTotal ?? "0"}
            />
            <span className="font-mono text-xs text-text-muted">
              {payload?.onchain.stakerCount ?? 0} people on this identity
            </span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStakeIdentity(0)}
              className="rounded border border-accent px-3 py-1.5 text-xs text-accent disabled:opacity-50"
            >
              Back identity
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onStakeIdentity(1)}
              className="rounded border border-border px-3 py-1.5 text-xs text-text-muted disabled:opacity-50"
            >
              Challenge identity
            </button>
          </div>
        </div>
      )}

      {parsed && !openClaimId && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium">Claims</h3>
              <p className="mt-1 font-mono text-xs text-text-muted">
                Positive on the left. Negative on the right. Circles are people,
                not dollars.
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <ColumnButton
              label="Positive"
              count={positiveClaims.reduce((n, c) => n + c.supportStakers, 0)}
              active={column === "positive"}
              positive
              onClick={() => setColumn("positive")}
            />
            <ColumnButton
              label="Negative"
              count={negativeClaims.reduce((n, c) => n + c.challengeStakers, 0)}
              active={column === "negative"}
              onClick={() => setColumn("negative")}
            />
          </div>

          <ul className="mt-5 divide-y divide-border border border-border">
            {visibleClaims.length === 0 ? (
              <li className="px-4 py-8 text-center font-mono text-xs text-text-muted">
                No {column} claims yet. File one below.
              </li>
            ) : (
              visibleClaims.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenClaimId(c.id);
                      setShowReasons(false);
                      setReasonSide(column);
                    }}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-bg-hover"
                  >
                    <span className="text-sm">{c.statement}</span>
                    <CountCircle
                      value={
                        column === "positive"
                          ? c.supportStakers
                          : c.challengeStakers
                      }
                      positive={column === "positive"}
                    />
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="mt-8 rounded border border-border p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              New claim
            </p>
            <input
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="has tag Layer 1"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              maxLength={160}
            />
            <textarea
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Why you are backing or challenging this"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              rows={3}
            />
            <AmountRow amount={amount} onChange={setAmount} />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onStakeClaim(0)}
                className="rounded border border-accent px-3 py-1.5 text-xs text-accent disabled:opacity-50"
              >
                Back claim
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onStakeClaim(1)}
                className="rounded border border-border px-3 py-1.5 text-xs text-text-muted disabled:opacity-50"
              >
                Challenge claim
              </button>
            </div>
          </div>
        </section>
      )}

      {openClaimId && claim && (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setOpenClaimId(null)}
            className="font-mono text-xs text-text-muted hover:text-text"
          >
            Back to claims
          </button>
          <h3 className="mt-4 text-xl font-semibold tracking-wide">
            {claim.onchain.statement || "Claim"}
          </h3>
          <p className="mt-2 font-mono text-xs text-text-muted">
            {fmtUsd(claim.onchain.supportTotal)} USDC backing ·{" "}
            {fmtUsd(claim.onchain.challengeTotal)} USDC against
          </p>

          <div className="mt-5 flex gap-3">
            <ColumnButton
              label="Positive"
              count={claim.onchain.supportStakers}
              active={reasonSide === "positive"}
              positive
              onClick={() => {
                setReasonSide("positive");
                setShowReasons(true);
              }}
            />
            <ColumnButton
              label="Negative"
              count={claim.onchain.challengeStakers}
              active={reasonSide === "negative"}
              onClick={() => {
                setReasonSide("negative");
                setShowReasons(true);
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowReasons((v) => !v)}
            className="mt-4 font-mono text-xs text-accent"
          >
            {showReasons ? "Hide reasons" : "See why people staked on this"}
          </button>

          {showReasons && (
            <div className="mt-4 overflow-x-auto border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-background font-mono text-[10px] uppercase tracking-wider text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Staker</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {reasons.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-6 text-center font-mono text-xs text-text-muted"
                      >
                        No {reasonSide} positions yet.
                      </td>
                    </tr>
                  ) : (
                    reasons.map((p) => (
                      <tr key={p.staker} className="border-t border-border">
                        <td className="px-3 py-2 font-mono text-xs">
                          {reasonSide === "positive" ? "for" : "against"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {fmtUsd(
                            reasonSide === "positive" ? p.support : p.challenge
                          )}{" "}
                          USDC
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">
                          {mask(p.staker)}
                        </td>
                        <td className="px-3 py-2 text-text-secondary">
                          {reasonSide === "positive"
                            ? p.supportReason || "—"
                            : p.challengeReason || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 rounded border border-border p-4">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
              Stake on this claim
            </p>
            <textarea
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              placeholder="Why you are backing or challenging this"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={280}
              rows={3}
            />
            <AmountRow amount={amount} onChange={setAmount} />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onStakeOpenClaim(0)}
                className="rounded border border-accent px-3 py-1.5 text-xs text-accent disabled:opacity-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onStakeOpenClaim(1)}
                className="rounded border border-border px-3 py-1.5 text-xs text-text-muted disabled:opacity-50"
              >
                Challenge
              </button>
            </div>
          </div>
        </section>
      )}

      {status && (
        <p className="mt-4 font-mono text-xs text-text-muted">{status}</p>
      )}
      {error && (
        <p className="mt-2 font-mono text-xs text-tier-low">{error}</p>
      )}
    </div>
  );
}

function KindChip({
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
      className={`rounded border px-2 py-1 font-mono text-[10px] uppercase tracking-wider ${
        active ? "border-accent text-accent" : "border-border text-text-muted"
      }`}
    >
      {label}
    </button>
  );
}

function CountCircle({
  value,
  positive,
}: {
  value: number;
  positive?: boolean;
}) {
  return (
    <span
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-[11px] ${
        positive
          ? "bg-accent text-bg"
          : "border border-border text-text-secondary"
      }`}
    >
      {value}
    </span>
  );
}

function ColumnButton({
  label,
  count,
  active,
  positive,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  positive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs ${
        active
          ? positive
            ? "border-accent text-accent"
            : "border-text-secondary text-text"
          : "border-border text-text-muted"
      }`}
    >
      {label}
      <CountCircle value={count} positive={positive} />
    </button>
  );
}

function OverallStat({
  label,
  people,
  usd,
  positive,
}: {
  label: string;
  people: number;
  usd: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <CountCircle value={people} positive={positive} />
      <div>
        <p className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
          {label}
        </p>
        <p className="text-sm tabular-nums">{fmtUsd(usd)} USDC</p>
      </div>
    </div>
  );
}

function AmountRow({
  amount,
  onChange,
}: {
  amount: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {["1", "5", "10", "25"].map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`rounded border px-2 py-1 font-mono text-xs ${
            amount === v
              ? "border-accent text-accent"
              : "border-border text-text-muted"
          }`}
        >
          {v}
        </button>
      ))}
      <input
        className="w-24 rounded border border-border bg-background px-2 py-1 font-mono text-sm"
        value={amount}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        aria-label="USDC amount"
      />
      <span className="font-mono text-xs text-text-muted">USDC</span>
    </div>
  );
}
