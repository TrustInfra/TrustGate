/** Public Trust Intelligence fields (Phase 3). No formula weights. */

export type ScoreStability =
  | "stable"
  | "improving"
  | "deteriorating"
  | "volatile"
  | "insufficient_history";

export interface TrustSnapshot {
  snapshotId: string;
  subject: string;
  subjectType: "wallet" | "token" | "contract";
  score: number;
  tier: string;
  confidence: number;
  flags: string[];
  summary: string[];
  scoreStability: ScoreStability;
  directionDrivers: string[];
  scoringVersion: string;
  queriedAt: string;
}

export interface TrustIntelligence {
  confidence: number;
  summary: string[];
  scoreStability: ScoreStability;
  directionDrivers: string[];
  snapshotId: string;
  scoringVersion: string;
  /** ISO timestamp of this evaluation */
  queriedAt: string;
}

export interface IntelligenceInput {
  subject: string;
  subjectType: "wallet" | "token" | "contract";
  score: number;
  tier: string;
  /** 0–100 data density */
  confidence: number;
  flags: string[];
  limitations?: string[];
  scoringVersion: string;
  /** Optional human-safe observations already computed */
  observations?: string[];
}
