import type { Tier, FlagCode, KnownFlag } from "./types";

// ============================================================================
// Single source of truth for how trust signals look. The badge component and
// the flag component both read from here, so presentation never drifts between
// them. Colors are self-contained defaults (hex with alpha) so an opt-in
// component renders correctly even when a partner drops it into a page with no
// shared theme. Partners can override styling at the component level.
//
// Nothing in here exposes a scoring threshold or formula. Flag descriptions
// are behavioral only.
// ============================================================================

export interface TierDisplay {
  label: string;
  color: string; // text / accent
  bg: string; // subtle fill
  border: string;
  short: string; // tiny label for the compact badge (MEDIUM becomes MID)
  showScore: boolean; // ELITE and VERIFIED show tier only, no number
  deprioritized: boolean; // BLOCKED and LOW: marked and pushed down, never hidden
}

export const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  VERIFIED: {
    label: "Verified",
    short: "VERIFIED",
    color: "#2563EB",
    bg: "#2563EB1A",
    border: "#2563EB33",
    showScore: false,
    deprioritized: false,
  },
  ELITE: {
    label: "Elite",
    short: "ELITE",
    color: "#059669",
    bg: "#0596691A",
    border: "#05966933",
    showScore: false,
    deprioritized: false,
  },
  HIGH: {
    label: "High",
    short: "HIGH",
    color: "#22C55E",
    bg: "#22C55E1A",
    border: "#22C55E33",
    showScore: true,
    deprioritized: false,
  },
  MEDIUM: {
    label: "Medium",
    short: "MID",
    color: "#F59E0B",
    bg: "#F59E0B1A",
    border: "#F59E0B33",
    showScore: true,
    deprioritized: false,
  },
  LOW: {
    label: "Low",
    short: "LOW",
    color: "#F97316",
    bg: "#F973161A",
    border: "#F9731633",
    showScore: true,
    deprioritized: true,
  },
  BLOCKED: {
    label: "Blocked",
    short: "BLOCKED",
    color: "#EF4444",
    bg: "#EF44441A",
    border: "#EF444433",
    showScore: true,
    deprioritized: true,
  },
};

export function getTierDisplay(tier: Tier): TierDisplay {
  return TIER_DISPLAY[tier];
}

// ----------------------------------------------------------------------------

export type FlagSeverity = "high" | "medium" | "info";

export interface FlagDisplay {
  label: string; // short plain-language name
  description: string; // one-line behavioral explanation, no thresholds
  severity: FlagSeverity;
}

export const FLAG_DISPLAY: Record<KnownFlag, FlagDisplay> = {
  HONEYPOT_PATTERN: {
    label: "Honeypot pattern",
    description: "Buys go through but sells look restricted.",
    severity: "high",
  },
  COORDINATED_BUY: {
    label: "Coordinated buying",
    description: "A cluster of buys arrived together rather than organically.",
    severity: "medium",
  },
  EXIT_SYNC: {
    label: "Synchronized exit",
    description: "Multiple credible holders sold in the same window.",
    severity: "high",
  },
  LOW_HOLDER_QUALITY: {
    label: "Low holder quality",
    description: "Holder base leans on fresh or airdropped wallets.",
    severity: "medium",
  },
};

const SEVERITY_COLOR: Record<FlagSeverity, { color: string; bg: string }> = {
  high: { color: "#EF4444", bg: "#EF44441A" },
  medium: { color: "#F59E0B", bg: "#F59E0B1A" },
  info: { color: "#64748B", bg: "#64748B1A" },
};

export function getSeverityColor(severity: FlagSeverity) {
  return SEVERITY_COLOR[severity];
}

// Resolve any flag code to a display. Known flags map directly. An unknown
// flag (one Nald adds later before we give it a label) degrades gracefully:
// the raw code gets humanized so it still renders something sensible.
export function getFlagDisplay(code: FlagCode): FlagDisplay {
  if (code in FLAG_DISPLAY) {
    return FLAG_DISPLAY[code as KnownFlag];
  }
  return {
    label: humanizeCode(code),
    description: "",
    severity: "info",
  };
}

function humanizeCode(code: string): string {
  return code
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
