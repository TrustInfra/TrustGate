"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { RecentQuery } from "@/hooks/useHomeStats";

const TICKER_SPEED_PX_PER_SEC = 40;

const TICKER_TIER_CHIP: Record<string, string> = {
  HIGH_ELITE: "bg-tier-high-muted text-tier-high border-tier-high/30",
  HIGH: "bg-tier-high-muted text-tier-high border-tier-high/30",
  MEDIUM: "bg-tier-medium-muted text-tier-medium border-tier-medium/30",
  LOW: "bg-tier-low-muted text-tier-low border-tier-low/30",
  BLOCKED: "bg-tier-low-muted text-tier-low border-tier-low/30",
};

function tickerTierClass(tier: string): string {
  return (
    TICKER_TIER_CHIP[tier] ?? "bg-bg-surface text-text-muted border-border"
  );
}

interface LiveTickerProps {
  items: RecentQuery[];
}

export default function LiveTicker({ items }: LiveTickerProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState(60);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const halfWidth = el.scrollWidth / 2;
    if (halfWidth <= 0) return;
    setDurationSec(Math.max(20, halfWidth / TICKER_SPEED_PX_PER_SEC));
  }, [items.length]);

  if (items.length === 0) return null;

  const loop: RecentQuery[] = [...items, ...items];

  return (
    <section
      aria-label="Recent oracle queries"
      className="border-y border-border overflow-hidden"
    >
      <div className="flex items-stretch">
        <div className="shrink-0 flex items-center gap-2 px-4 sm:px-6 py-3 border-r border-border bg-bg-raised">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-tier-high opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-tier-high" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted whitespace-nowrap">
            Live Feed
          </span>
        </div>

        <div className="tg-ticker-wrapper flex-1 min-w-0">
          <div
            ref={trackRef}
            className="tg-ticker-track flex items-center gap-8 whitespace-nowrap py-3 pl-4"
            style={{
              width: "max-content",
              animationDuration: `${durationSec}s`,
            }}
          >
            {loop.map((q, i) => (
              <div
                key={`${q.at}-${i}`}
                className="flex items-center gap-3"
              >
                <span className="font-mono text-[11px] text-text-muted">
                  {q.addressMasked}
                </span>
                <span className="text-sm font-display font-bold text-text tabular-nums">
                  {q.score}
                </span>
                <span
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-mono font-medium border",
                    tickerTierClass(q.tier)
                  )}
                >
                  {q.tier}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}