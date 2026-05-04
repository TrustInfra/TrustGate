// Rolling last-N localStorage history shared by /oracle and /token-shield.
// Each entry is appended on a successful score and the array is trimmed to
// MAX_ENTRIES — newest first.

export interface HistoryEntry {
  address: string;
  score: number;
  tier: string;
  at: string; // ISO timestamp
}

const MAX_ENTRIES = 5;

function isValidEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.address === "string" &&
    typeof v.score === "number" &&
    typeof v.tier === "string" &&
    typeof v.at === "string"
  );
}

export function loadHistory(key: string): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveHistory(key: string, entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(entries.slice(0, MAX_ENTRIES))
    );
  } catch {
    // quota exceeded / private mode — silent
  }
}

export function prependEntry(
  current: HistoryEntry[],
  entry: HistoryEntry
): HistoryEntry[] {
  return [entry, ...current].slice(0, MAX_ENTRIES);
}

export function maskAddress(address: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function relativeTime(value: string): string {
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
