import type { CSSProperties } from "react";
import type { BatchScore } from "./types";
import { getTierDisplay } from "./display";
import { DeployerTrustBadge } from "./DeployerTrustBadge";

// ============================================================================
// TrustBadge: the opt-in trust signal a partner drops into their own row or
// card. It defaults to a COMPACT form on purpose: a tiny "{score} {SHORT}" mark
// in the tier color (for example a small yellow "58 MID"), so it tucks into a
// dense list like OKX or pump.fun without disturbing the layout. We provide the
// signal; we do not take over the UI.
//
//   variant="compact" (default): tiny score + short tier, tier-colored.
//   variant="full": the larger pill with full label and confidence, for our
//                   own detail views.
//
// ELITE and VERIFIED show the short tier only, never a number. Mining tokens
// delegate to the deployer-trust treatment, in the matching variant.
// ============================================================================

export interface TrustBadgeProps {
  score: BatchScore;
  variant?: "compact" | "full";
  showConfidence?: boolean; // full variant only
  className?: string;
  style?: CSSProperties;
}

function formatConfidence(c: BatchScore["confidence"]): string {
  if (typeof c === "number") return `${Math.round(c)}% confidence`;
  return `${c} confidence`;
}

export function TrustBadge({
  score,
  variant = "compact",
  showConfidence = true,
  className,
  style,
}: TrustBadgeProps) {
  if (score.state === "mining") {
    return (
      <DeployerTrustBadge
        score={score}
        variant={variant}
        className={className}
        style={style}
      />
    );
  }

  const t = getTierDisplay(score.tier);

  // ---- compact: the default, deliberately tiny -----------------------------
  if (variant === "compact") {
    const compactStyle: CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "1px 5px",
      borderRadius: 4,
      fontSize: 10,
      fontWeight: 700,
      lineHeight: 1.4,
      color: t.color,
      backgroundColor: t.bg,
      whiteSpace: "nowrap",
      fontFamily: "inherit",
      opacity: t.deprioritized ? 0.92 : 1,
      ...style,
    };
    return (
      <span
        className={className}
        style={compactStyle}
        data-trustgate-tier={score.tier}
        title={`TrustGate: ${t.label}`}
      >
        {t.showScore && <span>{score.score}</span>}
        <span style={{ opacity: 0.85, letterSpacing: 0.2 }}>{t.short}</span>
      </span>
    );
  }

  // ---- full: larger pill for detail views ----------------------------------
  const showConf = showConfidence && score.tier !== "VERIFIED";
  const fullStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "4px 10px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    color: t.color,
    backgroundColor: t.bg,
    border: `1px solid ${t.border}`,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    opacity: t.deprioritized ? 0.9 : 1,
    ...style,
  };
  return (
    <span className={className} style={fullStyle} data-trustgate-tier={score.tier}>
      <span>{t.label}</span>
      {t.showScore && (
        <span
          style={{
            fontWeight: 700,
            opacity: 0.95,
            paddingLeft: 2,
            borderLeft: `1px solid ${t.border}`,
            marginLeft: 1,
          }}
        >
          {score.score}
        </span>
      )}
      {showConf && (
        <span style={{ fontWeight: 500, opacity: 0.7, fontSize: 12 }}>
          {formatConfidence(score.confidence)}
        </span>
      )}
    </span>
  );
}
