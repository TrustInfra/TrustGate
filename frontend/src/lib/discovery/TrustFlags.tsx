import type { CSSProperties } from "react";
import type { FlagCode } from "./types";
import { getFlagDisplay, getSeverityColor } from "./display";

// ============================================================================
// TrustFlags: opt-in plain-language flag chips. Consumes a token's flags array
// and renders one chip per flag, colored by severity, reading wording and color
// from the display config so it never drifts from the badge.
//
// Clean tokens render nothing. By default each chip shows its behavioral
// description as a hover title. showDescriptions stacks the description inline
// for a detail view. Unknown flag codes ride the humanize fallback.
//
// Like the badge, this imposes nothing on a partner's layout beyond the chips
// it returns. Placement is theirs.
// ============================================================================

export interface TrustFlagsProps {
  flags: FlagCode[];
  size?: "sm" | "md";
  showDescriptions?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SIZES = {
  sm: { fontSize: 10, padX: 6, padY: 2, gap: 4, radius: 5 },
  md: { fontSize: 12, padX: 8, padY: 3, gap: 6, radius: 6 },
} as const;

export function TrustFlags({
  flags,
  size = "md",
  showDescriptions = false,
  className,
  style,
}: TrustFlagsProps) {
  if (!flags || flags.length === 0) return null;

  const s = SIZES[size];

  const wrapStyle: CSSProperties = {
    display: "inline-flex",
    flexWrap: "wrap",
    gap: s.gap,
    fontFamily: "inherit",
    ...style,
  };

  return (
    <span className={className} style={wrapStyle}>
      {flags.map((code) => {
        const f = getFlagDisplay(code);
        const c = getSeverityColor(f.severity);

        const chipStyle: CSSProperties = {
          display: "inline-flex",
          flexDirection: showDescriptions ? "column" : "row",
          alignItems: showDescriptions ? "flex-start" : "center",
          gap: showDescriptions ? 1 : 0,
          padding: `${s.padY}px ${s.padX}px`,
          borderRadius: s.radius,
          fontSize: s.fontSize,
          fontWeight: 600,
          lineHeight: 1.25,
          color: c.color,
          backgroundColor: c.bg,
          border: `1px solid ${c.color}33`,
          whiteSpace: showDescriptions ? "normal" : "nowrap",
        };

        return (
          <span
            key={code}
            style={chipStyle}
            title={!showDescriptions && f.description ? f.description : undefined}
            data-trustgate-flag={code}
          >
            <span>{f.label}</span>
            {showDescriptions && f.description && (
              <span
                style={{
                  fontWeight: 400,
                  opacity: 0.85,
                  fontSize: s.fontSize - 1,
                }}
              >
                {f.description}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
