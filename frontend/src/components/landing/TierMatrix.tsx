import { cn } from "@/lib/utils";

interface TierRow {
  tier: string;
  score: string;
  settlement: string;
  delay: string;
  accent: "high" | "medium" | "low";
}

const TIERS: TierRow[] = [
  {
    tier: "HIGH",
    score: "75 – 100",
    settlement: "Instant transfer",
    delay: "None",
    accent: "high",
  },
  {
    tier: "MEDIUM",
    score: "40 – 74",
    settlement: "24h time-lock",
    delay: "24 hours",
    accent: "medium",
  },
  {
    tier: "LOW",
    score: "0 – 39",
    settlement: "Escrowed release",
    delay: "Manual approval",
    accent: "low",
  },
];

const accentMap = {
  high: {
    border: "border-l-tier-high",
    text: "text-tier-high",
  },
  medium: {
    border: "border-l-tier-medium",
    text: "text-tier-medium",
  },
  low: {
    border: "border-l-tier-low",
    text: "text-tier-low",
  },
};

export default function TierMatrix() {
  return (
    <div className="card-static overflow-hidden">
      <div className="hidden sm:grid tier-matrix-row bg-bg-raised border-b border-border text-[10px] font-mono uppercase tracking-[0.14em] text-text-muted">
        <span>Tier</span>
        <span>Score Range</span>
        <span>Settlement</span>
        <span>Delay</span>
      </div>

      {TIERS.map((row) => {
        const style = accentMap[row.accent];
        return (
          <div
            key={row.tier}
            className={cn(
              "tier-matrix-row border-l-2",
              style.border
            )}
          >
            <span
              className={cn(
                "font-mono text-xs font-bold uppercase tracking-wider",
                style.text
              )}
            >
              {row.tier}
            </span>
            <span className="font-mono text-sm text-text tabular-nums sm:col-auto">
              {row.score}
            </span>
            <span className="text-sm text-text-secondary col-span-2 sm:col-span-1">
              {row.settlement}
            </span>
            <span className="font-mono text-xs text-text-muted">
              {row.delay}
            </span>
          </div>
        );
      })}
    </div>
  );
}