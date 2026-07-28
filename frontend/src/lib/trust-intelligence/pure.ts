import type { ScoreStability } from "./types";

export function computeStability(scores: number[]): ScoreStability {
  if (scores.length < 2) return "insufficient_history";
  const recent = scores.slice(-6);
  if (recent.length < 2) return "insufficient_history";

  const first = recent[0];
  const last = recent[recent.length - 1];
  const delta = last - first;
  const mean =
    recent.reduce((a, b) => a + b, 0) / Math.max(recent.length, 1);
  const variance =
    recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length;
  const stdev = Math.sqrt(variance);

  if (stdev >= 12) return "volatile";
  if (delta >= 8) return "improving";
  if (delta <= -8) return "deteriorating";
  return "stable";
}

export function directionDrivers(
  stability: ScoreStability,
  flags: string[],
  limitations: string[] = []
): string[] {
  const drivers: string[] = [];

  switch (stability) {
    case "improving":
      drivers.push("Recent scores trending upward");
      break;
    case "deteriorating":
      drivers.push("Recent scores trending downward");
      break;
    case "volatile":
      drivers.push("Score oscillates across recent evaluations");
      break;
    case "stable":
      drivers.push("Score holds within a narrow recent band");
      break;
    default:
      drivers.push("Not enough historical points for trend");
  }

  const upper = flags.map((f) => f.toUpperCase());
  if (upper.some((f) => f.includes("EXIT") || f.includes("COORDINATED"))) {
    drivers.push("Coordination / exit signals weighing on standing");
  }
  if (upper.some((f) => f.includes("STAKING_COMMITTED"))) {
    drivers.push("Staking commitment supports standing");
  }
  if (upper.some((f) => f.includes("BOT") || f.includes("VELOCITY"))) {
    drivers.push("Activity-pattern risk pressure");
  }
  if (limitations.length > 0) {
    drivers.push(limitations[0]);
  }

  return drivers.slice(0, 4);
}

/** Map HIGH/MEDIUM/LOW enum confidence to a 0–100 density score. */
export function confidenceEnumToNumber(
  level: "HIGH" | "MEDIUM" | "LOW" | string | number | undefined
): number {
  if (typeof level === "number" && Number.isFinite(level)) {
    return Math.max(0, Math.min(100, Math.round(level)));
  }
  const s = String(level ?? "MEDIUM").toUpperCase();
  if (s === "HIGH") return 88;
  if (s === "LOW") return 32;
  if (s === "MEDIUM") return 62;
  const n = Number(level);
  if (Number.isFinite(n)) return Math.max(0, Math.min(100, Math.round(n)));
  return 50;
}
