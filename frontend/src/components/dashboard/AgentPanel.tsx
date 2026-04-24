"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { BaseError, ContractFunctionRevertedError, isAddress } from "viem";
import {
  Bot,
  Plus,
  XCircle,
  Wallet,
  Zap,
  Clock,
  Lock,
  CheckCircle2,
  Activity,
  AlertTriangle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/GlassCard";
import TrustTierBadge from "@/components/ui/TrustTierBadge";
import AddressDisplay from "@/components/ui/AddressDisplay";
import { CONTRACT_ADDRESSES } from "@/lib/constants";
import { agentRegistryAbi } from "@/lib/abi/AgentRegistry";
import { trustScoringAbi } from "@/lib/abi/TrustScoringPlaintext";
import { trustGateAbi } from "@/lib/abi/TrustGate";
import {
  agentStatusLabel,
  formatTimestamp,
  formatUsdc,
  parseUsdc,
} from "@/lib/utils";
import { calculateArcTrustScore, type ArcScoreResult } from "@/lib/arcScoring";

const REGISTRY_ERROR_MESSAGES: Record<string, string> = {
  ZeroAddress: "Agent address cannot be the zero address.",
  AgentAlreadyRegistered:
    "This address is already registered. Each agent can only be registered once.",
  AgentNotFound: "Agent not found in the registry.",
  NotAgentOwner: "Only the registering wallet can modify this agent.",
  AgentNotActive: "Agent is not currently active.",
};

function decodeContractError(error: unknown): string {
  if (!error) return "Unknown error";
  if (error instanceof BaseError) {
    const reverted = error.walk(
      (e) => e instanceof ContractFunctionRevertedError
    ) as ContractFunctionRevertedError | null;
    if (reverted?.data?.errorName) {
      const name = reverted.data.errorName;
      return REGISTRY_ERROR_MESSAGES[name] ?? `Contract reverted: ${name}`;
    }
    if (reverted?.reason) {
      return `Contract reverted: ${reverted.reason}`;
    }
    return error.shortMessage || error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

type RoutingType = "instant" | "delayed" | "escrowed";

function routingForTier(tier: number | undefined): RoutingType | null {
  if (tier === 2) return "instant";
  if (tier === 1) return "delayed";
  if (tier === 0) return "escrowed";
  return null;
}

const ROUTING_META: Record<
  RoutingType,
  { label: string; detail: string; color: string; Icon: typeof Zap }
> = {
  instant: {
    label: "Instant",
    detail: "USDC transfers immediately on claim.",
    color: "text-tier-high",
    Icon: Zap,
  },
  delayed: {
    label: "Time-locked",
    detail: "Claim releases after a 24h delay — agent pulls funds after expiry.",
    color: "text-tier-medium",
    Icon: Clock,
  },
  escrowed: {
    label: "Escrowed",
    detail: "Claim waits in escrow — depositor must explicitly approve release.",
    color: "text-tier-low",
    Icon: Lock,
  },
};

function AgentCard({
  agentAddress,
  ownerAddress,
}: {
  agentAddress: string;
  ownerAddress: string;
}) {
  const { data: agentData } = useReadContract({
    address: CONTRACT_ADDRESSES.agentRegistry,
    abi: agentRegistryAbi,
    functionName: "getAgent",
    args: [agentAddress as `0x${string}`],
  });

  const { data: hasScore } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "hasScore",
    args: [agentAddress as `0x${string}`],
  });

  const { data: trustScore, refetch: refetchScore } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "getTrustScore",
    args: [agentAddress as `0x${string}`],
    query: { enabled: !!hasScore },
  });

  const { data: trustTier, refetch: refetchTier } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "getTrustTierPlaintext",
    args: [agentAddress as `0x${string}`],
    query: { enabled: !!hasScore },
  });

  // Check claimable amount from owner
  const { data: claimable } = useReadContract({
    address: CONTRACT_ADDRESSES.trustGate,
    abi: trustGateAbi,
    functionName: "getClaimableAmount",
    args: [ownerAddress as `0x${string}`, agentAddress as `0x${string}`],
  });

  const { writeContract: deactivate, isPending: isDeactivating } =
    useWriteContract();

  const { writeContract: setScore, data: scoreTxHash, isPending: isSettingScore } =
    useWriteContract();

  const { isLoading: isConfirmingScore, isSuccess: isScoreConfirmed } =
    useWaitForTransactionReceipt({
      hash: scoreTxHash,
    });

  const [isQueryingArc, setIsQueryingArc] = useState(false);
  const [scoreResult, setScoreResult] = useState<ArcScoreResult | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);

  useEffect(() => {
    if (isScoreConfirmed) {
      refetchScore();
      refetchTier();
    }
  }, [isScoreConfirmed, refetchScore, refetchTier]);

  if (!agentData) return null;

  const [, status, registeredAt, metadataURI] = agentData as [
    string, number, bigint, string
  ];
  const statusNum = Number(status);
  const isActive = statusNum === 1;

  const handleDeactivate = () => {
    deactivate({
      address: CONTRACT_ADDRESSES.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "deactivateAgent",
      args: [agentAddress as `0x${string}`],
    });
  };

  const handleCalculateScore = async () => {
    setScoreError(null);
    setScoreResult(null);
    setIsQueryingArc(true);
    try {
      const result = await calculateArcTrustScore(agentAddress);
      setScoreResult(result);

      if (result.blocked) {
        setScoreError(
          "Wallet has no onchain activity on Arc — cannot assign a trust score."
        );
        return;
      }

      setScore({
        address: CONTRACT_ADDRESSES.trustScoring,
        abi: trustScoringAbi,
        functionName: "setTrustScore",
        args: [agentAddress as `0x${string}`, BigInt(result.finalScore)],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setScoreError(`Arc RPC query failed: ${message}`);
    } finally {
      setIsQueryingArc(false);
    }
  };

  const isScoreBusy = isQueryingArc || isSettingScore || isConfirmingScore;
  const loadingLabel = isQueryingArc
    ? "Querying Arc RPC"
    : isSettingScore
    ? "Awaiting wallet"
    : isConfirmingScore
    ? "Confirming on Arc"
    : null;

  return (
    <Card hover={false} className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <AddressDisplay address={agentAddress} />
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                isActive
                  ? "text-tier-high"
                  : statusNum === 2
                  ? "text-tier-medium"
                  : "text-text-muted"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isActive
                    ? "bg-tier-high"
                    : statusNum === 2
                    ? "bg-tier-medium"
                    : "bg-text-muted"
                }`}
              />
              {agentStatusLabel(statusNum)}
            </span>
            {hasScore && trustTier !== undefined && (
              <TrustTierBadge
                tier={Number(trustTier)}
                score={trustScore ? Number(trustScore) : undefined}
                size="sm"
              />
            )}
          </div>
        </div>
        {isActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeactivate}
            loading={isDeactivating}
            title="Deactivate agent"
          >
            <XCircle size={14} />
          </Button>
        )}
      </div>

      {metadataURI && (
        <p className="text-[11px] text-text-muted truncate mb-2">
          {metadataURI}
        </p>
      )}

      <div className="flex items-center gap-4 text-[11px] text-text-muted mb-3">
        <span>Registered {formatTimestamp(registeredAt)}</span>
        {claimable !== undefined && (
          <span>Claimable: {formatUsdc(claimable as bigint)} USDC</span>
        )}
      </div>

      {/* Calculate Trust Score from Arc onchain activity */}
      {isActive && (
        <div className="pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-medium text-text">
                Arc onchain activity score
              </p>
              <p className="text-[10px] text-text-muted">
                Auto-calculated from tx count, USDC balance, and contract calls
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCalculateScore}
              disabled={isScoreBusy}
            >
              {isScoreBusy ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  {loadingLabel}
                </>
              ) : (
                <>
                  <Activity size={12} />
                  Calculate Score
                </>
              )}
            </Button>
          </div>

          {scoreError && !scoreResult?.blocked && (
            <div className="p-2.5 rounded-md bg-tier-low/10 border border-tier-low/30 flex items-start gap-2">
              <AlertTriangle size={12} className="text-tier-low mt-0.5 shrink-0" />
              <p className="text-[11px] text-tier-low">{scoreError}</p>
            </div>
          )}

          {scoreResult && (
            <ScoreBreakdown
              result={scoreResult}
              confirmed={isScoreConfirmed}
              confirming={isConfirmingScore || isSettingScore}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function ScoreBreakdown({
  result,
  confirmed,
  confirming,
}: {
  result: ArcScoreResult;
  confirmed: boolean;
  confirming: boolean;
}) {
  const tierColor =
    result.tier === "HIGH_ELITE" || result.tier === "HIGH"
      ? "text-tier-high"
      : result.tier === "MEDIUM"
      ? "text-tier-medium"
      : result.tier === "LOW"
      ? "text-tier-low"
      : "text-text-muted";

  const tierLabel =
    result.tier === "HIGH_ELITE" ? "HIGH ELITE" : result.tier;

  return (
    <div className="p-3 rounded-md bg-bg-surface border border-border space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          Score breakdown
        </span>
        {result.tier === "HIGH_ELITE" && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-tier-high">
            <ShieldCheck size={10} />
            Verified
          </span>
        )}
      </div>

      <BreakdownRow
        label={result.components.transactions.label}
        points={result.components.transactions.points}
        note={result.components.transactions.note}
      />
      <BreakdownRow
        label={result.components.usdcBalance.label}
        points={result.components.usdcBalance.points}
        note={result.components.usdcBalance.note}
        muted={result.components.usdcBalance.points === 0}
      />
      <BreakdownRow
        label={result.components.contractInteractions.label}
        points={result.components.contractInteractions.points}
        note={result.components.contractInteractions.note}
        muted={result.components.contractInteractions.points === 0}
      />
      <BreakdownRow
        label={result.components.contractDeployments.label}
        points={result.components.contractDeployments.points}
        note={result.components.contractDeployments.note}
        muted={result.components.contractDeployments.points === 0}
      />

      {result.capped && (
        <p className="text-[10px] text-text-muted italic">
          Capped at 97 — only wallets with 100+ contract interactions can reach 100
        </p>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-[11px] font-semibold text-text">Total score</span>
        <span className="font-mono text-sm font-semibold text-text">
          {result.finalScore} / 100
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-secondary">Tier</span>
        <span className={`text-[11px] font-semibold ${tierColor}`}>
          {tierLabel}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-text-muted">Score source</span>
        <span className="text-[10px] font-mono text-text-muted">
          Arc Onchain Activity
        </span>
      </div>

      {confirming && (
        <div className="flex items-center gap-1.5 pt-1 text-[10px] text-text-muted">
          <Loader2 size={10} className="animate-spin" />
          Writing score to TrustScoring contract...
        </div>
      )}
      {confirmed && (
        <div className="flex items-center gap-1.5 pt-1 text-[10px] text-tier-high">
          <CheckCircle2 size={10} />
          Score committed onchain
        </div>
      )}
    </div>
  );
}

function BreakdownRow({
  label,
  points,
  note,
  muted,
}: {
  label: string;
  points: number;
  note: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[11px] text-text-secondary">{label}</p>
        <p className={`text-[10px] ${muted ? "text-text-muted italic" : "text-text-muted"}`}>
          {note}
        </p>
      </div>
      <span
        className={`font-mono text-xs font-semibold shrink-0 ${
          muted ? "text-text-muted" : "text-text"
        }`}
      >
        {points > 0 ? `+${points}` : points} pts
      </span>
    </div>
  );
}

function ClaimPaymentCard() {
  const { address } = useAccount();
  const [depositorAddr, setDepositorAddr] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Is the connected wallet itself a registered agent?
  const { data: myAgent } = useReadContract({
    address: CONTRACT_ADDRESSES.agentRegistry,
    abi: agentRegistryAbi,
    functionName: "getAgent",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const isActiveAgent =
    !!myAgent && Number((myAgent as [string, number, bigint, string])[1]) === 1;

  // Agent's own trust tier (determines routing)
  const { data: hasScore } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "hasScore",
    args: address ? [address] : undefined,
    query: { enabled: !!address && isActiveAgent },
  });

  const { data: myTier } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "getTrustTierPlaintext",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!hasScore },
  });

  const { data: myScore } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "getTrustScore",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!hasScore },
  });

  const { data: scoreExpired } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "isScoreExpired",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!hasScore },
  });

  // Claimable from entered depositor
  const depositorValid = isAddress(depositorAddr);
  const { data: claimable } = useReadContract({
    address: CONTRACT_ADDRESSES.trustGate,
    abi: trustGateAbi,
    functionName: "getClaimableAmount",
    args:
      depositorValid && address
        ? [depositorAddr as `0x${string}`, address]
        : undefined,
    query: { enabled: depositorValid && !!address && isActiveAgent },
  });

  const {
    writeContract: claim,
    data: claimTxHash,
    isPending: isClaiming,
    reset: resetClaim,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isClaimed } =
    useWaitForTransactionReceipt({ hash: claimTxHash });

  if (!isActiveAgent) return null;

  const routing = routingForTier(myTier !== undefined ? Number(myTier) : undefined);
  const claimableBig = (claimable as bigint | undefined) ?? 0n;

  let amountBig = 0n;
  let amountError: string | undefined;
  try {
    amountBig = amountInput ? parseUsdc(amountInput) : 0n;
  } catch {
    amountError = "Invalid amount";
  }
  if (!amountError && amountInput && amountBig === 0n) {
    amountError = "Amount must be greater than zero";
  }
  if (!amountError && amountBig > claimableBig && claimable !== undefined) {
    amountError = `Exceeds claimable (${formatUsdc(claimableBig)} USDC)`;
  }

  const blocker = !hasScore
    ? "Your agent wallet has no trust score yet — ask a scorer to set one before claiming."
    : scoreExpired
    ? "Your trust score has expired. Request a refresh before claiming."
    : undefined;

  const canClaim =
    !blocker &&
    depositorValid &&
    !amountError &&
    amountBig > 0n &&
    routing !== null &&
    !isClaiming &&
    !isConfirming;

  const handlePreview = () => setShowConfirm(true);

  const handleConfirm = () => {
    if (!canClaim) return;
    claim(
      {
        address: CONTRACT_ADDRESSES.trustGate,
        abi: trustGateAbi,
        functionName: "claim",
        args: [depositorAddr as `0x${string}`, amountBig],
      },
      {
        onSuccess: () => {
          setAmountInput("");
          setShowConfirm(false);
        },
      }
    );
  };

  const handleReset = () => {
    setShowConfirm(false);
    resetClaim();
  };

  return (
    <Card hover={false} className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet size={16} className="text-accent" />
        <h3 className="text-sm font-display font-semibold text-text">
          Claim Payment
        </h3>
      </div>

      <p className="text-xs text-text-muted mb-4">
        Claim USDC from a depositor&apos;s allowance. Routing is enforced by your
        trust tier — it cannot be overridden.
      </p>

      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <span className="text-[11px] uppercase tracking-wider text-text-muted">
          Your wallet
        </span>
        {hasScore && myTier !== undefined ? (
          <TrustTierBadge
            tier={Number(myTier)}
            score={myScore ? Number(myScore) : undefined}
            size="sm"
          />
        ) : (
          <span className="text-[11px] text-text-muted">Unscored</span>
        )}
      </div>

      {blocker && (
        <div className="mb-4 p-3 rounded-lg bg-tier-low/10 border border-tier-low/30">
          <p className="text-[11px] text-tier-low">{blocker}</p>
        </div>
      )}

      <div className="space-y-3">
        <Input
          label="Depositor Address"
          placeholder="0x... address of the depositor funding you"
          value={depositorAddr}
          onChange={(e) => {
            setDepositorAddr(e.target.value);
            setShowConfirm(false);
          }}
          error={
            depositorAddr && !depositorValid ? "Not a valid address" : undefined
          }
        />
        <Input
          label="Amount (USDC)"
          placeholder="0.00"
          type="number"
          step="0.000001"
          min="0"
          value={amountInput}
          onChange={(e) => {
            setAmountInput(e.target.value);
            setShowConfirm(false);
          }}
          hint={
            depositorValid && claimable !== undefined
              ? `Claimable: ${formatUsdc(claimableBig)} USDC`
              : undefined
          }
          error={amountError}
        />

        {/* Preview */}
        {depositorValid && amountBig > 0n && !amountError && routing && (
          <div className="p-4 rounded-lg bg-bg-surface border border-border">
            <p className="text-[11px] uppercase tracking-wider text-text-muted mb-3">
              Claim preview
            </p>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-text-secondary">Amount</span>
              <span className="text-sm font-mono font-semibold text-text">
                {formatUsdc(amountBig)} USDC
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-xs text-text-secondary pt-0.5">Routing</span>
              <div className="flex flex-col items-end text-right">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold ${ROUTING_META[routing].color}`}
                >
                  {(() => {
                    const { Icon } = ROUTING_META[routing];
                    return <Icon size={12} />;
                  })()}
                  {ROUTING_META[routing].label}
                </span>
                <span className="text-[11px] text-text-muted mt-1 max-w-[220px]">
                  {ROUTING_META[routing].detail}
                </span>
              </div>
            </div>
          </div>
        )}

        {isClaimed && (
          <div className="p-3 rounded-lg bg-tier-high/10 border border-tier-high/30 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-tier-high" />
            <p className="text-[11px] text-tier-high">
              Claim submitted. Check the Claims tab for status.
            </p>
          </div>
        )}

        {/* Actions */}
        {!showConfirm ? (
          <Button
            onClick={handlePreview}
            disabled={!canClaim}
            className="w-full"
          >
            <Wallet size={16} />
            Claim Payment
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isClaiming || isConfirming}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              loading={isClaiming || isConfirming}
              disabled={!canClaim}
              className="flex-1"
            >
              Confirm Claim
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

const MIN_GAS_USDC_WEI = 10_000_000_000_000_000n; // 0.01 USDC at 18 native decimals

export default function AgentPanel() {
  const { address } = useAccount();
  const [agentAddr, setAgentAddr] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    if (address && !agentAddr) {
      setAgentAddr(address);
    }
  }, [address, agentAddr]);

  // Read agents owned by connected address
  const { data: ownedAgents, refetch: refetchAgents } = useReadContract({
    address: CONTRACT_ADDRESSES.agentRegistry,
    abi: agentRegistryAbi,
    functionName: "getAgentsByOwner",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Read total active agents
  const { data: totalActive } = useReadContract({
    address: CONTRACT_ADDRESSES.agentRegistry,
    abi: agentRegistryAbi,
    functionName: "totalActiveAgents",
  });

  // Native USDC gas balance on Arc
  const { data: gasBalance } = useBalance({
    address,
    query: { enabled: !!address, refetchInterval: 20_000 },
  });

  // Preflight: check if the agent address is already registered
  const agentAddrValid = isAddress(agentAddr);
  const { data: existingAgent } = useReadContract({
    address: CONTRACT_ADDRESSES.agentRegistry,
    abi: agentRegistryAbi,
    functionName: "getAgent",
    args: agentAddrValid ? [agentAddr as `0x${string}`] : undefined,
    query: { enabled: agentAddrValid, refetchOnWindowFocus: false },
  });

  const existingStatus = existingAgent
    ? Number((existingAgent as [string, number, bigint, string])[1])
    : 0;
  const existingOwner = existingAgent
    ? ((existingAgent as [string, number, bigint, string])[0] as string)
    : undefined;
  const alreadyRegistered = existingStatus !== 0;

  const {
    writeContract: register,
    data: registerTxHash,
    isPending: isRegistering,
    reset: resetRegister,
  } = useWriteContract();
  const { isLoading: isConfirmingRegister, isSuccess: isRegistered } =
    useWaitForTransactionReceipt({
      hash: registerTxHash,
    });

  useEffect(() => {
    if (isRegistered) {
      setAgentAddr(address ?? "");
      setMetadataURI("");
      setRegisterError(null);
      refetchAgents();
    }
  }, [isRegistered, address, refetchAgents]);

  const insufficientGas =
    !!gasBalance && gasBalance.value < MIN_GAS_USDC_WEI;

  const preflightBlocker = (() => {
    if (!address) return "Connect a wallet to register an agent.";
    if (!agentAddr) return null;
    if (!agentAddrValid) return "Not a valid Ethereum address.";
    if (alreadyRegistered) {
      if (
        existingOwner &&
        existingOwner.toLowerCase() === address.toLowerCase()
      ) {
        return "You have already registered this agent.";
      }
      return "This address is already registered by another wallet.";
    }
    if (insufficientGas) {
      return "Insufficient USDC for gas on Arc — add at least 0.01 USDC to your wallet.";
    }
    return null;
  })();

  const handleUseWallet = () => {
    if (address) {
      setAgentAddr(address);
      setRegisterError(null);
    }
  };

  const handleRegister = () => {
    if (!agentAddr || !agentAddrValid || alreadyRegistered) return;
    setRegisterError(null);
    resetRegister();
    register(
      {
        address: CONTRACT_ADDRESSES.agentRegistry,
        abi: agentRegistryAbi,
        functionName: "registerAgent",
        args: [agentAddr as `0x${string}`, metadataURI],
      },
      {
        onError: (err) => {
          const decoded = decodeContractError(err);
          console.error("[registerAgent] failed:", err);
          console.error("[registerAgent] decoded reason:", decoded);
          setRegisterError(decoded);
        },
      }
    );
  };

  const agents = (ownedAgents as string[]) ?? [];
  const canSubmit =
    !!address &&
    agentAddrValid &&
    !alreadyRegistered &&
    !insufficientGas &&
    !isRegistering &&
    !isConfirmingRegister;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <Card hover={false} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Your Agents
            </p>
            <p className="text-2xl font-display font-bold text-text">
              {agents.length}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-1">
              Network Total
            </p>
            <p className="text-2xl font-display font-bold text-text-secondary">
              {totalActive?.toString() ?? "0"}
            </p>
          </div>
        </div>
      </Card>

      {/* Claim Payment (visible only when connected wallet is an active agent) */}
      <ClaimPaymentCard />

      {/* Register Agent */}
      <Card hover={false} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={16} className="text-accent" />
          <h3 className="text-sm font-display font-semibold text-text">
            Register Agent
          </h3>
        </div>
        <p className="text-xs text-text-muted mb-4">
          Registration is permissionless. Trust scores handle quality filtering --
          low-trust agents receive escrowed payments rather than being blocked.
        </p>
        <div className="space-y-3">
          <div>
            <Input
              label="Agent Wallet Address"
              placeholder="0x..."
              value={agentAddr}
              onChange={(e) => {
                setAgentAddr(e.target.value.trim());
                setRegisterError(null);
              }}
              hint={
                address &&
                agentAddr.toLowerCase() === address.toLowerCase()
                  ? "Using your connected wallet"
                  : "Defaults to your connected wallet — the caller becomes the agent owner"
              }
            />
            {address && agentAddr.toLowerCase() !== address.toLowerCase() && (
              <button
                type="button"
                onClick={handleUseWallet}
                className="mt-1 text-[11px] text-accent hover:underline"
              >
                Use connected wallet
              </button>
            )}
          </div>

          <Input
            label="Metadata URI (optional)"
            placeholder="ipfs://... or https://..."
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            hint="Pointer to off-chain agent metadata (capabilities, model, etc.)"
          />

          {gasBalance && (
            <p className="text-[11px] text-text-muted">
              Gas balance: {Number(gasBalance.formatted).toFixed(4)}{" "}
              {gasBalance.symbol}
            </p>
          )}

          {preflightBlocker && (
            <div className="p-2.5 rounded-md bg-tier-medium/10 border border-tier-medium/30 flex items-start gap-2">
              <AlertTriangle
                size={12}
                className="text-tier-medium mt-0.5 shrink-0"
              />
              <p className="text-[11px] text-tier-medium">{preflightBlocker}</p>
            </div>
          )}

          {registerError && (
            <div className="p-2.5 rounded-md bg-tier-low/10 border border-tier-low/30 flex items-start gap-2">
              <XCircle size={12} className="text-tier-low mt-0.5 shrink-0" />
              <p className="text-[11px] text-tier-low break-words">
                {registerError}
              </p>
            </div>
          )}

          {isRegistered && (
            <div className="p-2.5 rounded-md bg-tier-high/10 border border-tier-high/30 flex items-center gap-2">
              <CheckCircle2 size={12} className="text-tier-high" />
              <p className="text-[11px] text-tier-high">
                Agent registered successfully.
              </p>
            </div>
          )}

          <Button
            onClick={handleRegister}
            loading={isRegistering || isConfirmingRegister}
            disabled={!canSubmit}
          >
            <Bot size={16} />
            Register Agent
          </Button>
        </div>
      </Card>

      {/* Agent List */}
      {agents.length > 0 && (
        <div>
          <h3 className="text-sm font-display font-semibold text-text mb-3">
            Your Agents
          </h3>
          <div className="grid gap-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent}
                agentAddress={agent}
                ownerAddress={address!}
              />
            ))}
          </div>
        </div>
      )}

      {agents.length === 0 && address && (
        <div className="text-center py-12">
          <Bot size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            No agents registered yet. Register your first agent above.
          </p>
        </div>
      )}
    </div>
  );
}
