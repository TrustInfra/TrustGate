"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { OracleStats, TxStats } from "@/hooks/useHomeStats";

const numberFmt = new Intl.NumberFormat("en-US");

function formatUsdcEarned(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(2);
}

interface StatCell {
  label: string;
  value: string;
  accent?: boolean;
}

interface StatBarProps {
  oracle: OracleStats | null;
  tx: TxStats | null;
  className?: string;
}

export default function StatBar({ oracle, tx, className }: StatBarProps) {
  const primary: StatCell[] = useMemo(
    () => [
      {
        label: "Oracle Queries",
        value: oracle ? numberFmt.format(oracle.totalQueries) : "—",
      },
      {
        label: "Avg Trust Score",
        value: oracle ? oracle.averageScore.toFixed(1) : "—",
      },
      {
        label: "USDC Earned",
        value: oracle ? formatUsdcEarned(oracle.totalUsdcEarned) : "—",
        accent: true,
      },
    ],
    [oracle]
  );

  const secondary: StatCell[] = useMemo(
    () => [
      {
        label: "Transactions",
        value: tx ? numberFmt.format(tx.total_transactions) : "—",
      },
      {
        label: "Unique Wallets",
        value:
          tx && tx.unique_callers !== null
            ? numberFmt.format(tx.unique_callers)
            : "—",
      },
    ],
    [tx]
  );

  return (
    <div
      className={cn(
        "stat-bar w-full opacity-0 animate-slide-up",
        className
      )}
      style={{ animationDelay: "0.45s" }}
      aria-label="Live network statistics"
    >
      <div className="stat-bar-primary">
        {primary.map((cell) => (
          <div key={cell.label} className="stat-bar-cell">
            <p
              className={cn(
                "text-2xl sm:text-3xl lg:text-4xl font-display font-bold tracking-tight tabular-nums",
                cell.accent ? "text-accent" : "text-text"
              )}
            >
              {cell.value}
            </p>
            <p className="text-[10px] font-mono text-text-muted uppercase tracking-[0.14em] mt-2">
              {cell.label}
            </p>
          </div>
        ))}
      </div>

      <div className="stat-bar-secondary">
        {secondary.map((cell) => (
          <div key={cell.label} className="stat-bar-secondary-cell">
            <span className="text-[9px] font-mono text-text-muted uppercase tracking-[0.12em]">
              {cell.label}
            </span>
            <span className="text-xs font-mono font-medium text-text-secondary tabular-nums">
              {cell.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}