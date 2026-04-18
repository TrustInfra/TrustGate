"use client";

import { useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Bot, Plus, XCircle, ShieldAlert, ShieldCheck } from "lucide-react";
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
} from "@/lib/utils";

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
