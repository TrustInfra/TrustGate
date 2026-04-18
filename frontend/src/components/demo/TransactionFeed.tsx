"use client";

import { useEffect, useRef } from "react";
import { Check, X, Clock, Lock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DemoTx {
  id: string;
  agentLabel: string;
  agentAddr: string;
  tier: 0 | 1 | 2;
  score: number;
  amount: number;
  status: "allowed" | "blocked";
  routing: "instant" | "delayed" | "escrowed" | "rejected";
  timestamp: number;
  reason?: string;
}

const tierMeta: Record<number, { label: string; dot: string; text: string; bg: string }> = {
  2: { label: "HIGH", dot: "bg-tier-high", text: "text-tier-high", bg: "bg-tier-high-muted" },
  1: { label: "MED", dot: "bg-tier-medium", text: "text-tier-medium", bg: "bg-tier-medium-muted" },
  0: { label: "LOW", dot: "bg-tier-low", text: "text-tier-low", bg: "bg-tier-low-muted" },
};

const routingIcon = {
  instant: Zap,
  delayed: Clock,
  escrowed: Lock,
  rejected: X,
};

function formatAmount(n: number): string {
  if (n >= 1) return n.toFixed(2);
  if (n >= 0.01) return n.toFixed(3);
  return n.toFixed(5);
}

function formatTime(ts: number): string {
  const s = new Date(ts).toISOString().slice(11, 23);
  return s;
}

export default function TransactionFeed({ txs }: { txs: DemoTx[] }) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [txs.length]);

  return (
    <div className="card-static overflow-hidden h-[560px] flex flex-col">
      <div className="grid grid-cols-[1fr_60px_100px_110px_90px] gap-3 px-4 py-3 border-b border-border bg-bg-surface/50 text-[10px] font-mono uppercase tracking-wider text-text-muted">
        <span>Agent</span>
        <span>Tier</span>
        <span className="text-right">USDC</span>
        <span>Routing</span>
        <span className="text-right">Status</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto">
        {txs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-text-muted font-mono">
            press start to begin simulation
          </div>
        ) : (
          txs.map((tx) => {
            const tier = tierMeta[tx.tier];
            const Icon = routingIcon[tx.routing];
            const allowed = tx.status === "allowed";
            return (
              <div
                key={tx.id}
                className="grid grid-cols-[1fr_60px_100px_110px_90px] gap-3 px-4 py-2.5 border-b border-border/40 hover:bg-bg-surface/40 transition-colors animate-slide-down"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-text font-mono truncate">
                    {tx.agentLabel}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono">
                    {tx.agentAddr} · {formatTime(tx.timestamp)}
                  </span>
                </div>

                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-1.5 h-5 self-center rounded font-mono text-[10px] font-medium",
                    tier.bg,
                    tier.text
                  )}
                >
                  <span className={cn("h-1 w-1 rounded-full", tier.dot)} />
                  {tier.label}
                </span>

                <span className="text-xs font-mono text-text self-center text-right tabular-nums">
                  {formatAmount(tx.amount)}
                </span>

                <span className="flex items-center gap-1.5 text-[11px] text-text-secondary self-center">
                  <Icon size={12} className={allowed ? tier.text : "text-text-muted"} />
                  <span className="capitalize">
                    {allowed ? tx.routing : "blocked"}
                  </span>
                </span>

                <span
                  className={cn(
                    "inline-flex items-center justify-end gap-1 self-center text-[11px] font-mono font-medium",
                    allowed ? "text-tier-high" : "text-tier-low"
                  )}
                >
                  {allowed ? <Check size={12} /> : <X size={12} />}
                  {allowed ? "ALLOW" : "BLOCK"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
