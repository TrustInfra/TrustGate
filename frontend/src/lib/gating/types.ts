/**
 * Behavioral access gating — types.
 * TrustGate issues scores/attestations. Protocols own ladders and policy.
 */

export type SubjectType = "wallet" | "token";
export type ScoringEnvironment = "testnet" | "mainnet";

/** Use-class drives default attestation TTL (protocol may override). */
export type AttestationUseClass =
  | "financial_high"
  | "governance"
  | "allowlist"
  | "display";

export interface TrustAttestationPayload {
  attestationId: string;
  subject: `0x${string}`;
  subjectType: SubjectType;
  chainId: number;
  score: number;
  tier: string;
  confidence: number;
  scoringVersion: string;
  environment: ScoringEnvironment;
  issuedAt: number; // unix seconds
  expiresAt: number; // unix seconds
  flagsHash: `0x${string}`; // keccak of sorted flags joined
  issuer: `0x${string}`;
}

export interface TrustAttestation extends TrustAttestationPayload {
  flags: string[];
  signature: `0x${string}`;
  /** Human disclaimer — always present */
  disclaimer: string;
}

/** Protocol-owned ladder rung. TrustGate never authors production ladders. */
export interface LadderBand {
  minScore: number;
  maxScore?: number; // inclusive; omit = no upper
  /** Capability label (protocol-defined) */
  capability: string;
  /** Optional numeric limit (e.g. max borrow) — protocol units */
  maxAmount?: number;
  params?: Record<string, string | number | boolean>;
}

export interface LadderConfig {
  /** Protocol id / name for audit logs only */
  protocolId: string;
  bands: LadderBand[];
  /** Require confidence >= this (optional multi-factor hint) */
  minConfidence?: number;
  /** Pin allowed scoring versions */
  allowedScoringVersions?: string[];
  /** Max attestation age seconds (overrides expiresAt if tighter) */
  maxAttestationAgeSeconds?: number;
  /** Require at least one non-score factor ack from protocol */
  multiFactorAcknowledged?: boolean;
}

export interface LadderEvaluation {
  allowed: boolean;
  matchedBand: LadderBand | null;
  reasons: string[];
  /** Always remind: protocol owns policy */
  policyOwner: "protocol";
}

export interface GatingCheckRequest {
  wallet: `0x${string}`;
  /** Requested capability amount (e.g. borrow size) */
  requestedAmount?: number;
  capability?: string;
  ladder: LadderConfig;
  /** Optional token subject for dual-signal */
  tokenAddress?: `0x${string}`;
  tokenLadder?: LadderConfig;
  useClass?: AttestationUseClass;
  chainId?: number;
  /** Fail-closed if missing multi-factor ack */
  requireMultiFactorAck?: boolean;
}

export interface GatingCheckResult {
  allowed: boolean;
  walletEvaluation: LadderEvaluation;
  tokenEvaluation?: LadderEvaluation;
  attestation?: TrustAttestation;
  walletScore?: number;
  walletTier?: string;
  walletConfidence?: number;
  tokenScore?: number;
  reasons: string[];
  disclaimer: string;
}

export const GATING_DISCLAIMER =
  "TrustGate scores behaviour, not value or safety. TrustGate provides a trust signal only. The protocol owns access policy, borrow limits, and collateral valuation. This is not a credit decision.";
