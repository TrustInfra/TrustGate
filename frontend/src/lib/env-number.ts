/**
 * Parse a numeric env var. Empty string is missing — `Number("") === 0`
 * would invert "neutral fallback" scoring (caps/thresholds become 0).
 */
export function envNumber(
  name: string,
  fallback: number,
  env: Record<string, string | undefined> = process.env
): number {
  const raw = env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
