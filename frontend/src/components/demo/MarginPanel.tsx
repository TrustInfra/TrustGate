"use client";

import { TrendingDown, Flame, Sparkles, Activity, ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface MarginPanelProps {
  totalTx: number;
  allowedTx: number;
  blockedTx: number;
  totalVolumeUsdc: number;
  standardCostUsd: number;
  trustGateCostUsd: number;
  tierBreakdown: { high: number; medium: number; low: number };
}

function formatUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(5)}`;
}

function formatUsdc(n: number): string {
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return n.toFixed(2);
}

function Row({
  label,
  value,
  valueClass,
  mono = true,
}: {
  label: string;
  value: string;
  valueClass?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={cn(mono && "font-mono", "text-sm text-text tabular-nums", valueClass)}>
        {value}
      </span>
    </div>
  );
}

export default function MarginPanel({
  totalTx,
  allowedTx,
  blockedTx,
  totalVolumeUsdc,
  standardCostUsd,
  trustGateCostUsd,
  tierBreakdown,
}: MarginPanelProps) {
  const savings = Math.max(standardCostUsd - trustGateCostUsd, 0);
  const savingsPct = standardCostUsd > 0 ? (savings / standardCostUsd) * 100 : 0;
  const perTxStandard = totalTx > 0 ? standardCostUsd / totalTx : 0;
  const perTxTrustGate = totalTx > 0 ? trustGateCostUsd / totalTx : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Cost comparison headline */}
      <div className="card-static p-5 border-l-4 border-l-accent">
        <div className="flex items-center gap-2 mb-4">
          <TrendingDown size={14} className="text-accent" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Settlement Margin
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted mb-1">
              <Flame size={11} className="text-tier-low" />
              Standard L1
            </div>
            <p className="text-xl font-display font-bold text-text-secondary tabular-nums">
              {formatUsd(standardCostUsd)}
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-1">
              {formatUsd(perTxStandard)} / tx
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted mb-1">
              <Sparkles size={11} className="text-accent" />
              TrustGate
            </div>
            <p className="text-xl font-display font-bold text-accent tabular-nums">
              {formatUsd(trustGateCostUsd)}
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-1">
              {formatUsd(perTxTrustGate)} / tx
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                You save
              </p>
              <p className="text-2xl font-display font-extrabold text-tier-high tabular-nums">
                {formatUsd(savings)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
                Margin
              </p>
              <p className="text-2xl font-display font-extrabold text-tier-high tabular-nums">
                {savingsPct.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Volume + activity */}
      <div className="card-static p-5">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={14} className="text-accent" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Session Activity
          </span>
        </div>
        <Row label="Total transactions" value={totalTx.toString()} />
        <Row label="Total volume" value={`${formatUsdc(totalVolumeUsdc)} USDC`} />
        <Row
          label="Allowed"
          value={allowedTx.toString()}
          valueClass="text-tier-high"
        />
        <Row
          label="Blocked"
          value={blockedTx.toString()}
          valueClass="text-tier-low"
        />
      </div>

      {/* Tier breakdown */}
      <div className="card-static p-5">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck size={14} className="text-accent" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
            Tier Distribution
          </span>
        </div>
        <TierRow
          label="HIGH"
          value={tierBreakdown.high}
          total={totalTx}
          textClass="text-tier-high"
          barClass="bg-tier-high"
        />
        <TierRow
          label="MEDIUM"
          value={tierBreakdown.medium}
          total={totalTx}
          textClass="text-tier-medium"
          barClass="bg-tier-medium"
        />
        <TierRow
          label="LOW"
          value={tierBreakdown.low}
          total={totalTx}
          textClass="text-tier-low"
          barClass="bg-tier-low"
        />
      </div>

      {/* Notice */}
      <div className="card-static p-4 flex items-start gap-2.5">
        <ShieldAlert size={14} className="text-text-muted shrink-0 mt-0.5" />
        <p className="text-[11px] text-text-muted leading-relaxed">
          Simulated feed. Gas benchmark: $2.50 per L1 USDC transfer at 30 gwei.
          TrustGate cost reflects batched on-chain settlement plus off-chain
          allowance checks at $0.0008 per nanopayment.
        </p>
      </div>
    </div>
  );
}

function TierRow({
  label,
  value,
  total,
  textClass,
  barClass,
}: {
  label: string;
  value: number;
  total: number;
  textClass: string;
  barClass: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="py-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className={cn("text-[11px] font-mono font-medium", textClass)}>
          {label}
        </span>
        <span className="text-xs text-text-secondary font-mono tabular-nums">
          {value} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-bg-surface overflow-hidden">
        <div
          className={cn("h-full transition-all duration-300", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
