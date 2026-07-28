import { getStore } from "@/lib/store/memory-store";
import type {
  IntelligenceInput,
  TrustIntelligence,
  TrustSnapshot,
} from "./types";
import { buildSummary } from "./summary";
import {
  computeStability,
  confidenceEnumToNumber,
  directionDrivers,
} from "./pure";
import { randomBytes } from "crypto";

export {
  computeStability,
  confidenceEnumToNumber,
  directionDrivers,
} from "./pure";

const SNAPSHOT_NS = "trust-snapshots";
const HISTORY_NS = "trust-score-history";
const MAX_HISTORY = 24;
const MAX_SNAPSHOTS_PER_SUBJECT = 48;

interface HistoryPoint {
  score: number;
  at: number;
}

function historyKey(subject: string): string {
  return subject.toLowerCase();
}

function loadHistory(subject: string): HistoryPoint[] {
  return getStore<HistoryPoint[]>(HISTORY_NS).get(historyKey(subject)) ?? [];
}

function saveHistory(subject: string, points: HistoryPoint[]): void {
  getStore<HistoryPoint[]>(HISTORY_NS).set(
    historyKey(subject),
    points.slice(-MAX_HISTORY)
  );
}

function newSnapshotId(): string {
  return `snap_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

/**
 * Record a point-in-time snapshot and return Trust Intelligence fields.
 */
export function recordIntelligence(input: IntelligenceInput): TrustIntelligence {
  const now = Date.now();
  const queriedAt = new Date(now).toISOString();
  const subject = input.subject.toLowerCase();

  const history = loadHistory(subject);
  history.push({ score: input.score, at: now });
  saveHistory(subject, history);

  const stability = computeStability(history.map((h) => h.score));
  const summary = buildSummary(input);
  const drivers = directionDrivers(
    stability,
    input.flags,
    input.limitations
  );
  const snapshotId = newSnapshotId();

  const snapshot: TrustSnapshot = {
    snapshotId,
    subject,
    subjectType: input.subjectType,
    score: input.score,
    tier: input.tier,
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
    flags: input.flags,
    summary,
    scoreStability: stability,
    directionDrivers: drivers,
    scoringVersion: input.scoringVersion,
    queriedAt,
  };

  const snapStore = getStore<TrustSnapshot[]>(SNAPSHOT_NS);
  const prior = snapStore.get(subject) ?? [];
  snapStore.set(subject, [...prior, snapshot].slice(-MAX_SNAPSHOTS_PER_SUBJECT));

  return {
    confidence: snapshot.confidence,
    summary,
    scoreStability: stability,
    directionDrivers: drivers,
    snapshotId,
    scoringVersion: input.scoringVersion,
    queriedAt,
  };
}

export function listSnapshots(
  subject: string,
  limit = 20
): TrustSnapshot[] {
  const all = getStore<TrustSnapshot[]>(SNAPSHOT_NS).get(subject.toLowerCase()) ?? [];
  return all.slice(-limit).reverse();
}

export function getSnapshot(
  subject: string,
  snapshotId: string
): TrustSnapshot | null {
  const all = getStore<TrustSnapshot[]>(SNAPSHOT_NS).get(subject.toLowerCase()) ?? [];
  return all.find((s) => s.snapshotId === snapshotId) ?? null;
}
