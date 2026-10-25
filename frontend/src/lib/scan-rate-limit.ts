// Per-isolate cap for the public address scan. Serverless isolates do not
// share this map, so it bounds one instance rather than the whole deployment.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const MAX_KEYS = 2_000;

const buckets = new Map<string, number[]>();

export function resetScanRateLimit(): void {
  buckets.clear();
}

export function scanClientKey(ip: string | null | undefined): string {
  const value = ip?.trim() ?? "";
  if (/^[0-9a-fA-F:.]+$/.test(value) && value.length <= 64) return value;
  return "shared";
}

export function allowScan(key: string, now = Date.now()): boolean {
  const fresh = (buckets.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS);
  if (fresh.length >= MAX_PER_WINDOW) {
    buckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  buckets.set(key, fresh);
  if (buckets.size > MAX_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest !== undefined) buckets.delete(oldest);
  }
  return true;
}
