"use client";

import { cn } from "@/lib/utils";

export type TrustSource = "behavioral" | "graph";

interface TrustSourceToggleProps {
  value: TrustSource;
  onChange: (value: TrustSource) => void;
  className?: string;
}

const LIME = "#c8f135";
const GOLD = "#f5c842";

export default function TrustSourceToggle({
  value,
  onChange,
  className,
}: TrustSourceToggleProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
        Trust source (platform only)
      </p>
      <div
        className="inline-flex w-fit items-center gap-1 rounded border border-[#1f1f1f] bg-[#0a0a0a] p-1"
        role="tablist"
        aria-label="Trust source"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === "behavioral"}
          onClick={() => onChange("behavioral")}
          className={cn(
            "rounded px-3 py-1.5 font-mono text-xs font-medium transition",
            value === "behavioral"
              ? "text-[#0a0a0a]"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          style={
            value === "behavioral"
              ? { backgroundColor: LIME }
              : undefined
          }
        >
          Behavioral (TrustGate)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === "graph"}
          onClick={() => onChange("graph")}
          className={cn(
            "rounded px-3 py-1.5 font-mono text-xs font-medium transition",
            value === "graph"
              ? "text-[#0a0a0a]"
              : "text-zinc-500 hover:text-zinc-300"
          )}
          style={
            value === "graph" ? { backgroundColor: GOLD } : undefined
          }
        >
          Knowledge Graph
        </button>
      </div>
    </div>
  );
}