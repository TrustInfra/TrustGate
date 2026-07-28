import { getStore } from "@/lib/store/memory-store";

/**
 * Persistent behavioral marks on wallets (Phase 3 feedback loop).
 * Wallets seen in coordinated exits accumulate marks that wallet scoring
 * can apply as soft penalties — cannot coast on HIGH while repeatedly dumping.
 */

const MARKS_NS = "wallet-behavior-marks";

export type MarkCode =
  | "COORDINATED_EXIT_PARTICIPANT"
  | "REPEATED_EXIT_SYNC"
  | "STAKING_GAMING";

export interface WalletMark {
  code: MarkCode;
  count: number;
  lastSeenAt: string;
  contexts: string[]; // token addresses or proposal ids, max 8
}

export function getWalletMarks(address: string): WalletMark[] {
  return getStore<WalletMark[]>(MARKS_NS).get(address.toLowerCase()) ?? [];
}

export function addWalletMark(
  address: string,
  code: MarkCode,
  context?: string
): WalletMark {
  const key = address.toLowerCase();
  const store = getStore<WalletMark[]>(MARKS_NS);
  const marks = store.get(key) ?? [];
  const existing = marks.find((m) => m.code === code);
  const now = new Date().toISOString();

  if (existing) {
    existing.count += 1;
    existing.lastSeenAt = now;
    if (context) {
      existing.contexts = [
        context.toLowerCase(),
        ...existing.contexts.filter((c) => c !== context.toLowerCase()),
      ].slice(0, 8);
    }
    store.set(key, marks);
    return existing;
  }

  const created: WalletMark = {
    code,
    count: 1,
    lastSeenAt: now,
    contexts: context ? [context.toLowerCase()] : [],
  };
  marks.push(created);
  store.set(key, marks);
  return created;
}

/** Soft score penalty from marks (capped). Does not expose internal weights publicly. */
export function markScorePenalty(address: string): number {
  const marks = getWalletMarks(address);
  let penalty = 0;
  for (const m of marks) {
    if (m.code === "COORDINATED_EXIT_PARTICIPANT") {
      penalty += Math.min(15, m.count * 4);
    } else if (m.code === "REPEATED_EXIT_SYNC") {
      penalty += Math.min(20, m.count * 8);
    } else if (m.code === "STAKING_GAMING") {
      penalty += Math.min(12, m.count * 6);
    }
  }
  return Math.min(25, penalty);
}

export function markFlags(address: string): string[] {
  const marks = getWalletMarks(address);
  const flags: string[] = [];
  for (const m of marks) {
    if (m.code === "COORDINATED_EXIT_PARTICIPANT" && m.count >= 1) {
      flags.push("COORDINATED_EXIT_HISTORY");
    }
    if (m.code === "REPEATED_EXIT_SYNC" && m.count >= 1) {
      flags.push("REPEATED_EXIT_SYNC");
    }
    if (m.code === "STAKING_GAMING") {
      flags.push("STAKING_GAMING");
    }
  }
  return flags;
}

/**
 * When a token shows EXIT_SYNC, mark sampled heavy holders as participants.
 * Callers pass holder addresses observed in the temporal analysis window.
 */
export function markCoordinatedExitParticipants(
  tokenAddress: string,
  participantAddresses: string[]
): void {
  const unique = [...new Set(participantAddresses.map((a) => a.toLowerCase()))];
  for (const w of unique.slice(0, 40)) {
    const marks = getWalletMarks(w);
    const prior = marks.find((m) => m.code === "COORDINATED_EXIT_PARTICIPANT");
    addWalletMark(w, "COORDINATED_EXIT_PARTICIPANT", tokenAddress);
    if (prior && prior.count + 1 >= 2) {
      addWalletMark(w, "REPEATED_EXIT_SYNC", tokenAddress);
    }
  }
}
