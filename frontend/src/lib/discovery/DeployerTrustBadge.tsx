import type { CSSProperties } from "react";
import type { BatchScore } from "./types";
import { getTierDisplay } from "./display";

// ============================================================================
// DeployerTrustBadge: the honest treatment for mining-state tokens, which have
// no pool yet and so no token score. Shows the DEPLOYER wallet's trust, clearly
// labeled. Mirrors TrustBadge's variants.
//
//   variant="compact" (default): tiny "MINING {short} {score}", quiet, fits a
//                                dense list.
//   variant="full": the larger Mining + Deployer pill for detail views.
// ============================================================================

export interface DeployerTrustBadgeProps {
  score: BatchScore;
  variant?: "compact" | "full";
  className?: string;
  style?: CSSProperties;
}

const MINING_COLOR = "#64748B";

export function DeployerTrustBadge({
  score,
  variant = "compact",
  className,
  style,
}: DeployerTrustBadgeProps) {
  const t = getTierDisplay(score.tier);

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
      backgroundColor: `${MINING_COLOR}1A`,
      whiteSpace: "nowrap",
      fontFamily: "inherit",
      ...style,
    };
    return (
      <span
        className={className}
        style={compactStyle}
        data-trustgate-state="mining"
        data-trustgate-tier={score.tier}
        title="Mining: no pool yet, showing deployer wallet trust"
      >
        <span style={{ color: MINING_COLOR, letterSpacing: 0.2 }}>MINING</span>
        <span style={{ color: t.color }}>
          {t.short}
          {t.showScore ? ` ${score.score}` : ""}
        </span>
      </span>
    );
  }

  // ---- full ----------------------------------------------------------------
  const containerStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "stretch",
    borderRadius: 8,
    overflow: "hidden",
    border: `1px solid ${MINING_COLOR}33`,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: "nowrap",
    ...style,
  };
  return (
    <span
      className={className}
      style={containerStyle}
      data-trustgate-state="mining"
      data-trustgate-tier={score.tier}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 10px",
          color: MINING_COLOR,
          backgroundColor: `${MINING_COLOR}1A`,
          fontWeight: 700,
          letterSpacing: 0.3,
        }}
        title="No liquidity pool yet. The token is not scored. Showing the deployer wallet's trust."
      >
        Mining
      </span>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "4px 10px",
          color: t.color,
          backgroundColor: t.bg,
        }}
      >
        <span style={{ fontWeight: 500, opacity: 0.75 }}>Deployer</span>
        <span>{t.label}</span>
        {t.showScore && (
          <span style={{ fontWeight: 700, opacity: 0.95 }}>{score.score}</span>
        )}
      </span>
    </span>
  );
}
