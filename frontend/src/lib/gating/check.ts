import "server-only";

import { evaluateLadder } from "./ladder";
import { computeGatingAllowed } from "./decide";
import { issueWalletAttestation, rawWalletScore, rawTokenScore } from "./issue";
import { verifyAttestationSignature } from "./eip712";
import type {
  GatingCheckRequest,
  GatingCheckResult,
  TrustAttestation,
} from "./types";
import { GATING_DISCLAIMER } from "./types";
import { arcTestnet } from "@/lib/constants";
import { SCORING_VERSION } from "@/lib/scoring-version";

/**
 * Fail-closed gating check.
 * Protocol supplies ladder. TrustGate supplies score + optional attestation.
 */
export async function runGatingCheck(
  req: GatingCheckRequest
): Promise<GatingCheckResult> {
  const reasons: string[] = [];
  const chainId = req.chainId ?? arcTestnet.id;

  if (req.requireMultiFactorAck && !req.ladder.multiFactorAcknowledged) {
    return {
      allowed: false,
      allowedByCallerLadder: false,
      policySource: "caller_ladder",
      scoreIsAuthoritative: true,
      walletEvaluation: {
        allowed: false,
        matchedBand: null,
        reasons: [
          "Multi-factor acknowledgment required — TrustGate must not be sole gate",
        ],
        policyOwner: "protocol",
      },
      reasons: [
        "Fail-closed: protocol must acknowledge multi-factor risk controls",
      ],
      disclaimer: GATING_DISCLAIMER,
    };
  }

  const walletScore = await rawWalletScore(req.wallet);

  let scoringVersionAllowed = true;
  if (req.ladder.allowedScoringVersions?.length) {
    const ver = `${process.env.SCORING_ENVIRONMENT === "mainnet" ? "mainnet" : "testnet"}-wallet-${SCORING_VERSION}`;
    if (!req.ladder.allowedScoringVersions.includes(ver)) {
      scoringVersionAllowed = false;
      reasons.push(
        `scoringVersion ${ver} not in protocol allowlist — fail-closed`
      );
    }
  }

  const walletEvaluation = evaluateLadder(walletScore.score, req.ladder, {
    requestedAmount: req.requestedAmount,
    capability: req.capability ?? "borrow",
    confidence: walletScore.confidence,
  });
  reasons.push(...walletEvaluation.reasons);

  let tokenEvaluation = undefined;
  let tokenScore: number | undefined;
  if (req.tokenAddress && req.tokenLadder) {
    const ts = await rawTokenScore(req.tokenAddress);
    tokenScore = ts.score;
    tokenEvaluation = evaluateLadder(ts.score, req.tokenLadder, {
      confidence: ts.confidence,
    });
    reasons.push(...tokenEvaluation.reasons.map((r) => `token: ${r}`));
  }

  let attestation: (TrustAttestation & { isDemoSigner?: boolean }) | undefined;
  let attestationValid = false;
  try {
    attestation = await issueWalletAttestation({
      wallet: req.wallet,
      chainId,
      useClass: req.useClass ?? "financial_high",
    });
    const v = await verifyAttestationSignature(attestation);
    if (!v.valid) {
      reasons.push(...v.reasons.map((r) => `attestation: ${r}`));
    } else {
      attestationValid = true;
    }
    if (req.ladder.maxAttestationAgeSeconds != null) {
      const age =
        Math.floor(Date.now() / 1000) - attestation.issuedAt;
      if (age > req.ladder.maxAttestationAgeSeconds) {
        attestationValid = false;
        reasons.push("Attestation older than protocol max age — fail-closed");
      }
    }
  } catch (err) {
    reasons.push(
      `Attestation issue failed — fail-closed (${err instanceof Error ? err.message : "error"})`
    );
  }

  const allowed = computeGatingAllowed({
    walletAllowed: walletEvaluation.allowed,
    tokenAllowed: tokenEvaluation ? tokenEvaluation.allowed : undefined,
    attestationValid,
    scoringVersionAllowed,
  });

  return {
    allowed,
    allowedByCallerLadder: allowed,
    policySource: "caller_ladder",
    scoreIsAuthoritative: true,
    walletEvaluation,
    tokenEvaluation,
    attestation,
    walletScore: walletScore.score,
    walletTier: walletScore.tier,
    walletConfidence: walletScore.confidence,
    tokenScore,
    reasons: [...new Set(reasons)],
    disclaimer: GATING_DISCLAIMER,
  };
}

export async function verifyProvidedAttestation(
  attestation: TrustAttestation,
  expectedSubject?: string,
  expectedChainId?: number
): Promise<{
  valid: boolean;
  reasons: string[];
  score?: number;
  tier?: string;
  expiresAt?: number;
  scoringVersion?: string;
}> {
  const reasons: string[] = [];
  if (
    expectedSubject &&
    attestation.subject.toLowerCase() !== expectedSubject.toLowerCase()
  ) {
    reasons.push("Subject mismatch — fail-closed");
  }
  if (
    expectedChainId != null &&
    attestation.chainId !== expectedChainId
  ) {
    reasons.push("chainId mismatch — fail-closed");
  }
  const v = await verifyAttestationSignature(attestation);
  reasons.push(...v.reasons);
  return {
    valid: reasons.length === 0,
    reasons,
    score: attestation.score,
    tier: attestation.tier,
    expiresAt: attestation.expiresAt,
    scoringVersion: attestation.scoringVersion,
  };
}

