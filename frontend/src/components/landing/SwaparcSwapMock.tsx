"use client";

import { useState } from "react";
import { ArrowDown, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

type BadgeKind = "verified" | "medium";

function LiveBadge({
  kind,
  score,
}: {
  kind: BadgeKind;
  score?: number;
}) {
  if (kind === "verified") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-accent bg-accent-muted border border-accent/25">
        Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-tier-medium bg-tier-medium-muted border border-tier-medium/30">
      {score != null && <span>{score}</span>}
      <span className="opacity-80">Medium</span>
    </span>
  );
}

interface TokenRow {
  symbol: string;
  name: string;
  kind: BadgeKind;
  score?: number;
}

const PICKER_TOKENS: TokenRow[] = [
  { symbol: "EURC", name: "Euro Coin", kind: "verified" },
  { symbol: "SWPRC", name: "SwapARC Token", kind: "medium", score: 56 },
  { symbol: "CircBTC", name: "Circle Bitcoin", kind: "verified" },
];

export default function SwaparcSwapMock({
  className,
  defaultOpen = true,
}: {
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "relative w-full max-w-[420px] mx-auto bg-bg-raised border border-border p-5 sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between mb-5">
        <p className="font-display font-bold text-text text-lg tracking-wide">
          Swap
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          Arc Testnet
        </span>
      </div>

      <Field
        label="Sell"
        amount="0.00"
        symbol="USDC"
        kind="verified"
      />

      <div className="flex justify-center -my-2 relative z-10">
        <span className="inline-flex h-8 w-8 items-center justify-center bg-bg-surface border border-border text-text-muted">
          <ArrowDown size={14} />
        </span>
      </div>

      <div className="relative">
        <Field
          label="Buy"
          amount="0.00"
          symbol="EURC"
          kind="verified"
          chevron
          active={open}
          onClick={() => setOpen((v) => !v)}
        />

        {open && (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 bg-bg-surface border border-border shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border text-text-muted">
              <Search size={12} />
              <span className="font-mono text-[11px]">Search token</span>
            </div>
            <ul>
              {PICKER_TOKENS.map((t) => (
                <li
                  key={t.symbol}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 border-t border-border/60 first:border-t-0"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-sm text-text">
                        {t.symbol}
                      </span>
                      <LiveBadge kind={t.kind} score={t.score} />
                    </div>
                    <p className="font-mono text-[10px] text-text-muted mt-0.5">
                      {t.name}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p
        className={cn(
          "font-mono text-[10px] text-text-muted leading-relaxed",
          open ? "mt-52" : "mt-4"
        )}
      >
        Schematic of the Swaparc picker. Colors follow this site. Open Swaparc
        to confirm the live badges.
      </p>
    </div>
  );
}

function Field({
  label,
  amount,
  symbol,
  kind,
  chevron,
  active,
  onClick,
}: {
  label: string;
  amount: string;
  symbol: string;
  kind: BadgeKind;
  chevron?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted mb-2">
          {label}
        </p>
        <p className="font-display font-bold text-3xl text-text tabular-nums">
          {amount}
        </p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-2 px-2.5 py-1.5 bg-bg-surface border",
          active ? "border-accent/40" : "border-border"
        )}
      >
        <span className="font-display font-semibold text-sm text-text">
          {symbol}
        </span>
        <LiveBadge kind={kind} />
        {chevron && (
          <ChevronDown
            size={12}
            className={cn(
              "text-text-muted transition-transform",
              active && "rotate-180"
            )}
          />
        )}
      </span>
    </>
  );

  const cls =
    "flex items-center justify-between gap-3 w-full bg-bg-surface border border-border px-4 py-4 text-left";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}
