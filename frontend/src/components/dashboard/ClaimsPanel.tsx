"use client";

import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { FileText, Clock, CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/GlassCard";
import TrustTierBadge from "@/components/ui/TrustTierBadge";
import AddressDisplay from "@/components/ui/AddressDisplay";
import { CONTRACT_ADDRESSES } from "@/lib/constants";
import { trustGateAbi } from "@/lib/abi/TrustGate";
import { formatUsdc, parseUsdc, statusLabel, timeRemaining, formatTimestamp } from "@/lib/utils";

function ClaimCard({
  claimId,
  userAddress,
}: {
  claimId: number;
  userAddress: string;
}) {
  const { data: claimData } = useReadContract({
    address: CONTRACT_ADDRESSES.trustGate,
    abi: trustGateAbi,
    functionName: "getClaim",
    args: [BigInt(claimId)],
  });

  const { writeContract: release, isPending: isReleasing } = useWriteContract();
  const { writeContract: approveClaim, isPending: isApproving } = useWriteContract();
  const { writeContract: cancel, isPending: isCancelling } = useWriteContract();

  if (!claimData) return null;

  const [depositor, agent, amount, tier, status, releaseTime, createdAt] = claimData as [
    string, string, bigint, number, number, bigint, bigint
  ];

  const statusNum = Number(status);
  const tierNum = Number(tier);
  const isDepositor = depositor.toLowerCase() === userAddress.toLowerCase();
  const isAgent = agent.toLowerCase() === userAddress.toLowerCase();
  const isPending = statusNum === 1;
  const isTimeLocked = tierNum === 1 && isPending;
  const isEscrowed = tierNum === 0 && isPending;
  const canRelease = isTimeLocked && Number(releaseTime) > 0 &&
    Math.floor(Date.now() / 1000) >= Number(releaseTime);
  const canApprove = isEscrowed && isDepositor;

  const handleRelease = () => {
    release({
      address: CONTRACT_ADDRESSES.trustGate,
      abi: trustGateAbi,
      functionName: "releaseClaim",
      args: [BigInt(claimId)],
    });
  };

  const handleApprove = () => {
    approveClaim({
      address: CONTRACT_ADDRESSES.trustGate,
      abi: trustGateAbi,
      functionName: "approveClaim",
      args: [BigInt(claimId)],
    });
  };

  const handleCancel = () => {
    cancel({
      address: CONTRACT_ADDRESSES.trustGate,
      abi: trustGateAbi,
      functionName: "cancelClaim",
      args: [BigInt(claimId)],
    });
  };

  const statusColors: Record<number, string> = {
    1: "text-tier-medium",
    2: "text-tier-high",
    3: "text-text-muted",
  };

  return (
    <Card hover={false} className="p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-text-muted">#{claimId}</span>
          <TrustTierBadge tier={tierNum} size="sm" />
          <span className={`text-xs font-medium ${statusColors[statusNum] ?? "text-text-muted"}`}>
            {statusLabel(statusNum)}
          </span>
        </div>
        <span className="text-lg font-display font-bold text-text">
          {formatUsdc(amount)}
          <span className="text-xs font-body text-text-muted ml-1">USDC</span>
        </span>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-text-muted mb-3">
        <AddressDisplay address={depositor} className="text-[11px]" />
        <ArrowRight size={10} className="text-text-muted" />
        <AddressDisplay address={agent} className="text-[11px]" />
      </div>

      <div className="flex items-center gap-4 text-[11px] text-text-muted">
        <span>Created {formatTimestamp(createdAt)}</span>
        {isTimeLocked && isPending && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {timeRemaining(releaseTime)}
          </span>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          {canRelease && (
            <Button size="sm" onClick={handleRelease} loading={isReleasing}>
              <CheckCircle2 size={14} />
              Release
            </Button>
          )}
          {canApprove && (
            <Button size="sm" onClick={handleApprove} loading={isApproving}>
              <CheckCircle2 size={14} />
              Approve
            </Button>
          )}
          {isTimeLocked && !canRelease && (
            <span className="text-[11px] text-tier-medium flex items-center gap-1">
              <Clock size={12} />
              Time-locked: {timeRemaining(releaseTime)}
            </span>
          )}
          {isDepositor && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              loading={isCancelling}
              className="ml-auto"
            >
              <XCircle size={14} />
              Cancel
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ClaimsPanel() {
  const { address } = useAccount();
  const [claimIds, setClaimIds] = useState<number[]>([]);
  const [lookupId, setLookupId] = useState("");

  // Read claim counter to know total claims
  const { data: claimCounter } = useReadContract({
    address: CONTRACT_ADDRESSES.trustGate,
    abi: trustGateAbi,
    functionName: "claimCounter",
  });

  // Build the list of recent claim IDs
  useEffect(() => {
    if (claimCounter) {
      const total = Number(claimCounter);
      const start = Math.max(1, total - 19); // Show last 20 claims
      const ids: number[] = [];
      for (let i = total; i >= start; i--) {
        ids.push(i);
      }
      setClaimIds(ids);
    }
  }, [claimCounter]);

  const handleLookup = () => {
    if (!lookupId) return;
    const id = parseInt(lookupId);
    if (!isNaN(id) && id > 0 && !claimIds.includes(id)) {
      setClaimIds((prev) => [id, ...prev]);
    }
    setLookupId("");
  };

  return (
    <div className="space-y-6">
      {/* Claim Lookup */}
      <Card hover={false} className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText size={16} className="text-accent" />
          <h3 className="text-sm font-display font-semibold text-text">
            Claims
          </h3>
          {claimCounter && (
            <span className="text-xs text-text-muted ml-auto">
              {claimCounter.toString()} total
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Claim ID"
            type="number"
            min="1"
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" onClick={handleLookup} disabled={!lookupId}>
            Lookup
          </Button>
        </div>
      </Card>

      {/* Claims List */}
      {claimIds.length > 0 ? (
        <div className="grid gap-3">
          {claimIds.map((id) => (
            <ClaimCard key={id} claimId={id} userAddress={address ?? ""} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <FileText size={32} className="mx-auto text-text-muted mb-3" />
          <p className="text-sm text-text-muted">
            No claims yet. Claims appear here when agents claim from depositor allowances.
          </p>
        </div>
      )}
    </div>
  );
}
