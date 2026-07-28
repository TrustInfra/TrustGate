import {
  type Hex,
  type PrivateKeyAccount,
  hashTypedData,
  keccak256,
  stringToHex,
  verifyTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  AttestationUseClass,
  ScoringEnvironment,
  TrustAttestation,
  TrustAttestationPayload,
} from "./types";
import { GATING_DISCLAIMER } from "./types";

export const ATTESTATION_TYPES = {
  TrustAttestation: [
    { name: "attestationId", type: "string" },
    { name: "subject", type: "address" },
    { name: "subjectType", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "score", type: "uint256" },
    { name: "tier", type: "string" },
    { name: "confidence", type: "uint256" },
    { name: "scoringVersion", type: "string" },
    { name: "environment", type: "string" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
    { name: "flagsHash", type: "bytes32" },
    { name: "issuer", type: "address" },
  ],
} as const;

export function domain(chainId: number) {
  return {
    name: "TrustGateAttestation",
    version: "1",
    chainId,
  } as const;
}

/** Default TTL seconds by use class */
export function defaultTtlSeconds(useClass: AttestationUseClass): number {
  switch (useClass) {
    case "financial_high":
      return 6 * 60 * 60; // 6h
    case "governance":
      return 2 * 24 * 60 * 60; // 2d
    case "allowlist":
      return 7 * 24 * 60 * 60; // 7d
    case "display":
      return 24 * 60 * 60; // 1d
    default:
      return 6 * 60 * 60;
  }
}

export function hashFlags(flags: string[]): `0x${string}` {
  const sorted = [...flags].map((f) => f.toUpperCase()).sort();
  return keccak256(stringToHex(sorted.join("|")));
}

export function getIssuerAccount(): {
  account: PrivateKeyAccount;
  isDemo: boolean;
} {
  const raw = process.env.ATTESTATION_SIGNER_PRIVATE_KEY;
  if (raw && /^0x[0-9a-fA-F]{64}$/.test(raw)) {
    return {
      account: privateKeyToAccount(raw as Hex),
      isDemo: false,
    };
  }
  // Demo-only key for local/dev so the path works without secrets.
  // MUST be replaced in production via ATTESTATION_SIGNER_PRIVATE_KEY.
  const demo =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
  return {
    account: privateKeyToAccount(demo),
    isDemo: true,
  };
}

export function getAuthorizedIssuers(): Set<string> {
  const set = new Set<string>();
  const { account } = getIssuerAccount();
  set.add(account.address.toLowerCase());
  const extra = (process.env.ATTESTATION_AUTHORIZED_ISSUERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^0x[0-9a-f]{40}$/.test(s));
  for (const a of extra) set.add(a);
  return set;
}

export async function signAttestation(input: {
  subject: `0x${string}`;
  subjectType: "wallet" | "token";
  chainId: number;
  score: number;
  tier: string;
  confidence: number;
  scoringVersion: string;
  environment: ScoringEnvironment;
  flags: string[];
  useClass?: AttestationUseClass;
  ttlSeconds?: number;
}): Promise<TrustAttestation & { isDemoSigner: boolean }> {
  const { account, isDemo } = getIssuerAccount();
  const now = Math.floor(Date.now() / 1000);
  const ttl =
    input.ttlSeconds ??
    defaultTtlSeconds(input.useClass ?? "financial_high");
  const attestationId = `att_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  const flagsHash = hashFlags(input.flags);

  const payload: TrustAttestationPayload = {
    attestationId,
    subject: input.subject.toLowerCase() as `0x${string}`,
    subjectType: input.subjectType,
    chainId: input.chainId,
    score: Math.max(0, Math.min(100, Math.round(input.score))),
    tier: input.tier,
    confidence: Math.max(0, Math.min(100, Math.round(input.confidence))),
    scoringVersion: input.scoringVersion,
    environment: input.environment,
    issuedAt: now,
    expiresAt: now + ttl,
    flagsHash,
    issuer: account.address,
  };

  const signature = await account.signTypedData({
    domain: domain(input.chainId),
    types: ATTESTATION_TYPES,
    primaryType: "TrustAttestation",
    message: {
      ...payload,
      chainId: BigInt(payload.chainId),
      score: BigInt(payload.score),
      confidence: BigInt(payload.confidence),
      issuedAt: BigInt(payload.issuedAt),
      expiresAt: BigInt(payload.expiresAt),
    },
  });

  return {
    ...payload,
    flags: input.flags,
    signature,
    disclaimer: GATING_DISCLAIMER,
    isDemoSigner: isDemo,
  };
}

export async function verifyAttestationSignature(
  attestation: TrustAttestation,
  opts?: { nowSeconds?: number; authorizedIssuers?: Set<string> }
): Promise<{
  valid: boolean;
  reasons: string[];
  digest?: `0x${string}`;
}> {
  const reasons: string[] = [];
  const now = opts?.nowSeconds ?? Math.floor(Date.now() / 1000);

  if (now > attestation.expiresAt) {
    reasons.push("Attestation expired — fail-closed");
  }
  if (attestation.issuedAt > now + 60) {
    reasons.push("Attestation issuedAt is in the future");
  }

  const expectedHash = hashFlags(attestation.flags ?? []);
  if (
    attestation.flagsHash &&
    expectedHash.toLowerCase() !== attestation.flagsHash.toLowerCase()
  ) {
    reasons.push("flagsHash mismatch");
  }

  const issuers = opts?.authorizedIssuers ?? getAuthorizedIssuers();
  if (!issuers.has(attestation.issuer.toLowerCase())) {
    reasons.push("Issuer not in authorized registry");
  }

  let sigOk = false;
  try {
    sigOk = await verifyTypedData({
      address: attestation.issuer,
      domain: domain(attestation.chainId),
      types: ATTESTATION_TYPES,
      primaryType: "TrustAttestation",
      message: {
        attestationId: attestation.attestationId,
        subject: attestation.subject,
        subjectType: attestation.subjectType,
        chainId: BigInt(attestation.chainId),
        score: BigInt(attestation.score),
        tier: attestation.tier,
        confidence: BigInt(attestation.confidence),
        scoringVersion: attestation.scoringVersion,
        environment: attestation.environment,
        issuedAt: BigInt(attestation.issuedAt),
        expiresAt: BigInt(attestation.expiresAt),
        flagsHash: attestation.flagsHash,
        issuer: attestation.issuer,
      },
      signature: attestation.signature,
    });
  } catch {
    sigOk = false;
  }

  if (!sigOk) reasons.push("Invalid EIP-712 signature");

  const digest = hashTypedData({
    domain: domain(attestation.chainId),
    types: ATTESTATION_TYPES,
    primaryType: "TrustAttestation",
    message: {
      attestationId: attestation.attestationId,
      subject: attestation.subject,
      subjectType: attestation.subjectType,
      chainId: BigInt(attestation.chainId),
      score: BigInt(attestation.score),
      tier: attestation.tier,
      confidence: BigInt(attestation.confidence),
      scoringVersion: attestation.scoringVersion,
      environment: attestation.environment,
      issuedAt: BigInt(attestation.issuedAt),
      expiresAt: BigInt(attestation.expiresAt),
      flagsHash: attestation.flagsHash,
      issuer: attestation.issuer,
    },
  });

  return {
    valid: reasons.length === 0,
    reasons,
    digest,
  };
}
