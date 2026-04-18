"use client";

import { cn } from "@/lib/utils";

interface TrustTierBadgeProps {
  tier: number;
  score?: number;
  size?: "sm" | "md";
  className?: string;
}

const tierConfig: Record<number, { label: string; bg: string; text: string; dot: string }> = {
  2: {
    label: "HIGH",
    bg: "bg-tier-high-muted",
    text: "text-tier-high",
    dot: "bg-tier-high",
  },
  1: {
    label: "MEDIUM",
    bg: "bg-tier-medium-muted",
    text: "text-tier-medium",
    dot: "bg-tier-medium",
  },
  0: {
    label: "LOW",
    bg: "bg-tier-low-muted",
    text: "text-tier-low",
    dot: "bg-tier-low",
  },
};

export default function TrustTierBadge({
  tier,
  score,
  size = "md",
  className,
}: TrustTierBadgeProps) {
  const config = tierConfig[tier] ?? tierConfig[0];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md font-mono font-medium",
        config.bg,
        config.text,
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      {config.label}
      {score !== undefined && (
        <span className="opacity-60">({score})</span>
      )}
    </span>
  );
}
