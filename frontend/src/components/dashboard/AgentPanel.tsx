"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { isAddress } from "viem";
import {
  Bot,
  Plus,
  XCircle,
  Wallet,
  Zap,
  Clock,
  Lock,
  CheckCircle2,
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

  const { data: trustScore } = useReadContract({
    address: CONTRACT_ADDRESSES.trustScoring,
    abi: trustScoringAbi,
    functionName: "getTrustScore",
    args: [agentAddress as `0x${string}`],
    query: { enabled: !!hasScore },
  });

  const { data: trustTier } = useReadContract({
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

  const { isLoading: isConfirmingScore } = useWaitForTransactionReceipt({
    hash: scoreTxHash,
  });

  const [scoreInput, setScoreInput] = useState("");

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

  const handleSetScore = () => {
    if (!scoreInput) return;
    setScore({
      address: CONTRACT_ADDRESSES.trustScoring,
      abi: trustScoringAbi,
      functionName: "setTrustScore",
      args: [agentAddress as `0x${string}`, BigInt(scoreInput)],
    }, {
      onSuccess: () => setScoreInput(""),
    });
  };

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

      {/* Set Trust Score (agent owner can score their own agents) */}
      {isActive && (
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          <Input
            placeholder="Score (0-100)"
            type="number"
            min="0"
            max="100"
            value={scoreInput}
            onChange={(e) => setScoreInput(e.target.value)}
            className="flex-1 py-1.5 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleSetScore}
            loading={isSettingScore || isConfirmingScore}
            disabled={!scoreInput}
          >
            Set Score
          </Button>
        </div>
      )}
    </Card>
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

export default function AgentPanel() {
  const { address } = useAccount();
  const [agentAddr, setAgentAddr] = useState("");
  const [metadataURI, setMetadataURI] = useState("");

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

  const { writeContract: register, data: registerTxHash, isPending: isRegistering } =
    useWriteContract();
  const { isLoading: isConfirmingRegister } = useWaitForTransactionReceipt({
    hash: registerTxHash,
  });

  const handleRegister = () => {
    if (!agentAddr) return;
    register({
      address: CONTRACT_ADDRESSES.agentRegistry,
      abi: agentRegistryAbi,
      functionName: "registerAgent",
      args: [agentAddr as `0x${string}`, metadataURI],
    }, {
      onSuccess: () => {
        setAgentAddr("");
        setMetadataURI("");
        refetchAgents();
      },
    });
  };

  const agents = (ownedAgents as string[]) ?? [];

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
          <Input
            label="Agent Wallet Address"
            placeholder="0x..."
            value={agentAddr}
            onChange={(e) => setAgentAddr(e.target.value)}
          />
          <Input
            label="Metadata URI (optional)"
            placeholder="ipfs://... or https://..."
            value={metadataURI}
            onChange={(e) => setMetadataURI(e.target.value)}
            hint="Pointer to off-chain agent metadata (capabilities, model, etc.)"
          />
          <Button
            onClick={handleRegister}
            loading={isRegistering || isConfirmingRegister}
            disabled={!agentAddr || !address}
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
