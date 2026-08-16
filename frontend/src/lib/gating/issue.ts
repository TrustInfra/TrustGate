import "server-only";

import { rescoreWallet } from "@/lib/wallet-rescore";
import { SCORING_VERSION } from "@/lib/scoring-version";
import {
  confidenceEnumToNumber,
  recordIntelligence,
} from "@/lib/trust-intelligence/snapshots";
import { markFlags } from "@/lib/token-behavior/wallet-marks";
import { analyzeTokenTemporal } from "@/lib/token-behavior/temporal";
import {
  applyTemporalScoreDelta,
  readTemporalScoreWeight,
} from "@/lib/token-behavior/heuristics";
import {
  detectContractKind,
  isVerifiedIssuer,
} from "@/lib/contract-scoring";
import { signAttestation } from "./eip712";
import type {
  AttestationUseClass,
  ScoringEnvironment,
  TrustAttestation,
} from "./types";
import { GATING_DISCLAIMER } from "./types";
import { arcTestnet } from "@/lib/constants";

const ORACLE_BASE = (
  process.env.ORACLE_URL ||
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  ""
).replace(/\/+$/, "");

function environment(): ScoringEnvironment {
  const e = (process.env.SCORING_ENVIRONMENT ?? "testnet").toLowerCase();
  return e === "mainnet" ? "mainnet" : "testnet";
}

function scoringVersionLabel(): string {
  const env = environment();
  return `${env}-wallet-${SCORING_VERSION}`;
}

function tokenScoringVersionLabel(): string {
  const env = environment();
  return `${env}-token-${SCORING_VERSION}`;
}

async function rawWalletScore(address: string): Promise<{
  score: number;
  tier: string;
  confidence: number;
  flags: string[];
}> {
  let raw: number | null = null;
  if (ORACLE_BASE) {
    try {
      const res = await fetch(`${ORACLE_BASE}/oracle/${address}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { score?: number };
        if (typeof data.score === "number") raw = data.score;
      }
    } catch {
      // fall through
    }
  }
  if (raw == null) {
    if (environment() === "mainnet") {
      throw new Error("upstream wallet score unavailable — fail-closed");
    }
    raw = 50;
  }
  const rescored = await rescoreWallet(raw, address);
  const flags = [...new Set([...rescored.flags, ...markFlags(address)])];
  const confidence = confidenceEnumToNumber(rescored.confidence);
  recordIntelligence({
    subject: address,
    subjectType: "wallet",
    score: rescored.score,
    tier: rescored.tier,
    confidence,
    flags,
    limitations: rescored.limitations,
    scoringVersion: scoringVersionLabel(),
  });
  return {
    score: rescored.score,
    tier: rescored.tier,
    confidence,
    flags,
  };
}

async function rawTokenScore(address: string): Promise<{
  score: number;
  tier: string;
  confidence: number;
  flags: string[];
}> {
  if (isVerifiedIssuer(address)) {
    return { score: 100, tier: "VERIFIED", confidence: 100, flags: [] };
  }
  const det = await detectContractKind(address);
  if (det.kind === "not-contract" || det.kind === "fetch-failed") {
    return {
      score: 0,
      tier: "BLOCKED",
      confidence: 0,
      flags: ["UNSCORED"],
    };
  }
  const temporal = await analyzeTokenTemporal(address);
  let score =
    45 + applyTemporalScoreDelta(temporal.scoreDelta, readTemporalScoreWeight());
  if (det.info?.isVerified) score += 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const tier =
    score >= 80
      ? "HIGH_ELITE"
      : score >= 60
        ? "HIGH"
        : score >= 40
          ? "MEDIUM"
          : score > 0
            ? "LOW"
            : "BLOCKED";
  const confidence =
    temporal.metrics.transferSample >= 30
      ? 80
      : temporal.metrics.transferSample >= 10
        ? 55
        : 35;
  return {
    score,
    tier,
    confidence,
    flags: temporal.flags,
  };
}

export async function issueWalletAttestation(opts: {
  wallet: `0x${string}`;
  chainId?: number;
  useClass?: AttestationUseClass;
  ttlSeconds?: number;
}): Promise<TrustAttestation & { isDemoSigner: boolean }> {
  const scored = await rawWalletScore(opts.wallet);
  return signAttestation({
    subject: opts.wallet,
    subjectType: "wallet",
    chainId: opts.chainId ?? arcTestnet.id,
    score: scored.score,
    tier: scored.tier,
    confidence: scored.confidence,
    scoringVersion: scoringVersionLabel(),
    environment: environment(),
    flags: scored.flags,
    useClass: opts.useClass ?? "financial_high",
    ttlSeconds: opts.ttlSeconds,
  });
}

export async function issueTokenAttestation(opts: {
  token: `0x${string}`;
  chainId?: number;
  useClass?: AttestationUseClass;
  ttlSeconds?: number;
}): Promise<TrustAttestation & { isDemoSigner: boolean }> {
  const scored = await rawTokenScore(opts.token);
  return signAttestation({
    subject: opts.token,
    subjectType: "token",
    chainId: opts.chainId ?? arcTestnet.id,
    score: scored.score,
    tier: scored.tier,
    confidence: scored.confidence,
    scoringVersion: tokenScoringVersionLabel(),
    environment: environment(),
    flags: scored.flags,
    useClass: opts.useClass ?? "financial_high",
    ttlSeconds: opts.ttlSeconds,
  });
}

export { GATING_DISCLAIMER, rawWalletScore, rawTokenScore, environment };
