"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeroVisualProps {
  avgScore?: number | null;
  className?: string;
}

function HudCorner({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "absolute w-5 h-5 border-accent/40 pointer-events-none",
        className
      )}
      aria-hidden
    />
  );
}

export default function HeroVisual({ avgScore, className }: HeroVisualProps) {
  const scoreLabel =
    avgScore != null && Number.isFinite(avgScore)
      ? avgScore.toFixed(1)
      : "—";

  return (
    <div
      className={cn(
        "relative w-full max-w-[420px] xl:max-w-[480px] mx-auto lg:mx-0 lg:ml-auto",
        "opacity-0 animate-fade-in",
        className
      )}
      style={{ animationDelay: "0.2s" }}
    >
      <div
        className="absolute -inset-8 rounded-full bg-accent/[0.06] blur-3xl pointer-events-none"
        aria-hidden
      />

      <div className="relative card-static p-5 sm:p-6">
        <HudCorner className="top-0 left-0 border-t border-l" />
        <HudCorner className="top-0 right-0 border-t border-r" />
        <HudCorner className="bottom-0 left-0 border-b border-l" />
        <HudCorner className="bottom-0 right-0 border-b border-r" />

        <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-text-muted">
            Signal Layer
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-accent/80">
            Live
          </span>
        </div>

        <div className="relative mt-6 aspect-square flex items-center justify-center overflow-hidden rounded-sm bg-bg/40">
          <Image
            src="/logo.png"
            alt="TrustGate — behavioral trust infrastructure"
            width={480}
            height={480}
            priority
            unoptimized
            className="w-[88%] h-auto object-contain select-none"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/80 pt-4">
          <div className="rounded border border-border/60 bg-bg-raised/50 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
              Avg Score
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-accent tabular-nums">
              {scoreLabel}
            </p>
          </div>
          <div className="rounded border border-border/60 bg-bg-raised/50 px-3 py-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-text-muted">
              Network
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-text tabular-nums">
              Arc
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}