import "server-only";

import { CHAIN_ID } from "../chain";
import { isContractAddress } from "../contract-detect";
import { isVerifiedIssuer } from "../discovery/verified-issuers";
import {
  applyConvictionDelta,
  convictionDelta,
  mergeConvictionInputs,
  type ConvictionInput,
  type ConvictionResult,
} from "./conviction";
import {
  readClaims,
  readPositions,
  readSubject,
  vaultDeployed,
} from "./read";
import type { CanonicalSubject } from "./canonicalize";
import { lookupStakerQuality } from "./staker-quality-lookup";

export interface AppliedConviction extends ConvictionResult {
  score: number;
}

const MAX_STAKERS = 200;

function identity(kind: "wallet" | "token", address: string): CanonicalSubject {
  const a = address.toLowerCase() as `0x${string}`;
  const canonical =
    kind === "token"
      ? `eip155:${CHAIN_ID}/erc20:${a}`
      : `eip155:${CHAIN_ID}:${a}`;
  return { kind, canonical, display: a, input: a };
}

async function weightedPositions(
  subjectId: `0x${string}`,
  scoredAddress: string
): Promise<ConvictionInput> {
  const empty: ConvictionInput = {
    supportUsd: 0,
    challengeUsd: 0,
    supportPeople: 0,
    challengePeople: 0,
    rawStakers: 0,
    qualityMass: 0,
  };
  const positions = await readPositions(subjectId);
  const active = positions.filter(
    (p) => Number(p.support) > 0 || Number(p.challenge) > 0
  );
  const unique: typeof active = [];
  const seen = new Set<string>();
  for (const p of active) {
    const k = p.staker.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }
  const sample = unique.slice(0, MAX_STAKERS);
  if (sample.length === 0) return empty;

  let supportUsd = 0;
  let challengeUsd = 0;
  let supportPeople = 0;
  let challengePeople = 0;
  let qualityMass = 0;

  const weights = await Promise.all(
    sample.map((p) => lookupStakerQuality(p.staker, scoredAddress))
  );

  for (let i = 0; i < sample.length; i++) {
    const q = weights[i];
    const support = Number(sample[i].support) || 0;
    const challenge = Number(sample[i].challenge) || 0;
    if (support <= 0 && challenge <= 0) continue;
    qualityMass += q;
    if (support > 0) {
      supportUsd += support * q;
      supportPeople += q;
    }
    if (challenge > 0) {
      challengeUsd += challenge * q;
      challengePeople += q;
    }
  }

  return {
    supportUsd,
    challengeUsd,
    supportPeople,
    challengePeople,
    rawStakers: sample.length,
    qualityMass,
  };
}

async function gather(address: string): Promise<ConvictionInput> {
  if (!vaultDeployed()) {
    return {
      supportUsd: 0,
      challengeUsd: 0,
      supportPeople: 0,
      challengePeople: 0,
      rawStakers: 0,
      qualityMass: 0,
    };
  }
  const det = await isContractAddress(address);
  const kind: "wallet" | "token" =
    det.rpcOk && det.isContract ? "token" : "wallet";
  const subject = await readSubject(identity(kind, address));
  if (!subject.exists) {
    return {
      supportUsd: 0,
      challengeUsd: 0,
      supportPeople: 0,
      challengePeople: 0,
      rawStakers: 0,
      qualityMass: 0,
    };
  }
  const parts: ConvictionInput[] = [
    await weightedPositions(subject.id, address),
  ];
  const claims = await readClaims(subject.id);
  for (const c of claims) {
    parts.push(await weightedPositions(c.id, address));
  }
  return mergeConvictionInputs(parts);
}

/**
 * Fold claim conviction into a published score. VERIFIED issuers unchanged.
 * Staker quality is applied before the delta: empty/new wallets count ~0.
 */
export async function applySubjectConviction(
  address: string,
  score: number,
  cap = 100
): Promise<AppliedConviction> {
  if (isVerifiedIssuer(address)) {
    return {
      score,
      delta: 0,
      netUsd: 0,
      netPeople: 0,
      flags: [],
      observations: [],
    };
  }
  let input: ConvictionInput = {
    supportUsd: 0,
    challengeUsd: 0,
    supportPeople: 0,
    challengePeople: 0,
    rawStakers: 0,
    qualityMass: 0,
  };
  try {
    input = await gather(address);
  } catch (err) {
    console.warn(
      "[conviction] read failed:",
      err instanceof Error ? err.message : err
    );
  }
  const result = convictionDelta(input);
  return {
    ...result,
    score: applyConvictionDelta(score, result.delta, cap),
  };
}
