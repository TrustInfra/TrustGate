import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { isContractAddress } from "@/lib/contract-detect";
import { rescoreWallet } from "@/lib/wallet-rescore";
import {
  detectContractKind,
  isVerifiedIssuer,
} from "@/lib/contract-scoring";
import { scoreTokenForBatch } from "@/lib/batch/score-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

// Testnet fallback used by gating / protocol-guard when the paid oracle is
// unavailable. rescoreWallet still applies Arcscan bot flags and marks.
const WALLET_RAW_SCORE = 50;

type SubjectKind = "Address" | "Token" | "Contract";
type Verdict = "fraudulent" | "malicious" | "suspicious" | "legitimate";

const STRONG_FLAGS = new Set([
  "WASH_TRADING",
  "HONEYPOT_PATTERN",
  "COORDINATED_EXIT_HISTORY",
  "EXIT_SYNC",
  "REPEATED_EXIT_SYNC",
]);

const SOFT_FLAGS = new Set([
  "HOLDER_CONCENTRATION",
  "LOW_HOLDER_QUALITY",
  "INTERACTION_VELOCITY",
  "INTERVAL_PATTERN",
  "SELF_INTERACTION",
  "CLEAN_HISTORY_ANOMALY",
  "COORDINATED_BUY",
  "SINGLE_WALLET_DOMINANCE",
  "UPGRADE_PATTERN_RISK",
  "STAKING_GAMING",
  "CREATOR_DUMPING",
]);

const EVIDENCE: Record<string, string> = {
  WASH_TRADING: "wash-trading patterns",
  HOLDER_CONCENTRATION: "concentrated holder distribution",
  EXIT_SYNC: "synchronized exits",
  HONEYPOT_PATTERN: "honeypot-style transfer restrictions",
  INTERACTION_VELOCITY: "automated transaction velocity",
  COORDINATED_BUY: "coordinated buying",
  LOW_HOLDER_QUALITY: "low holder quality",
  COORDINATED_EXIT_HISTORY: "coordinated exit history",
  REPEATED_EXIT_SYNC: "repeated synchronized exits",
  INTERVAL_PATTERN: "patterned transaction intervals",
  SELF_INTERACTION: "self-interaction loops",
  CLEAN_HISTORY_ANOMALY: "anomalous clean-history pattern",
  SINGLE_WALLET_DOMINANCE: "single-wallet dominance",
  UPGRADE_PATTERN_RISK: "risky upgrade patterns",
  STAKING_GAMING: "staking gaming behavior",
  CREATOR_DUMPING: "creator dumping",
};

function plain(sentence: string): NextResponse {
  return new NextResponse(sentence, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

function hedge(kind: SubjectKind, address: string): NextResponse {
  return plain(
    `${kind} ${address} could not be fully assessed and should be treated as suspicious pending further review.`
  );
}

async function classify(address: string): Promise<SubjectKind> {
  if (isVerifiedIssuer(address)) return "Token";

  const check = await isContractAddress(address);
  const det =
    check.isContract || !check.rpcOk
      ? await detectContractKind(address)
      : null;

  if (det?.kind === "erc20" || det?.kind === "nft") return "Token";
  if (det?.kind === "other-contract") return "Contract";
  if (check.isContract) return "Contract";
  return "Address";
}

async function scoreSubject(
  address: string,
  kind: SubjectKind
): Promise<{ score: number; tier: string; flags: string[] }> {
  if (isVerifiedIssuer(address)) {
    return { score: 100, tier: "VERIFIED", flags: [] };
  }

  if (kind === "Address") {
    const rescored = await rescoreWallet(WALLET_RAW_SCORE, address);
    return {
      score: rescored.score,
      tier: rescored.tier,
      flags: rescored.flags,
    };
  }

  const batch = await scoreTokenForBatch(address);
  if (batch.error === "not_a_token") {
    const rescored = await rescoreWallet(WALLET_RAW_SCORE, address);
    return {
      score: rescored.score,
      tier: rescored.tier,
      flags: rescored.flags,
    };
  }
  if (batch.error) {
    throw new Error(batch.error);
  }

  return {
    score: batch.score,
    tier: batch.tier,
    flags: batch.flags.map((f) => String(f)),
  };
}

function mapVerdict(
  score: number,
  tier: string,
  flags: string[]
): { verdict: Verdict; evidence: string } {
  const upper = [...new Set(flags.map((f) => f.toUpperCase()))];
  const hasHoneypot = upper.includes("HONEYPOT_PATTERN");
  const strong = upper.filter((f) => STRONG_FLAGS.has(f));
  const soft = upper.filter((f) => SOFT_FLAGS.has(f));

  const ranked = [
    ...upper.filter((f) => f === "HONEYPOT_PATTERN"),
    ...strong.filter((f) => f !== "HONEYPOT_PATTERN"),
    ...soft.filter((f) => !STRONG_FLAGS.has(f)),
  ];
  const phrases = ranked
    .slice(0, 2)
    .map((f) => EVIDENCE[f] ?? f.toLowerCase().replace(/_/g, " "));

  const tierU = tier.toUpperCase();
  const blocked = tierU === "BLOCKED" || score === 0;
  const low = tierU === "LOW" || (score > 0 && score < 40);

  let verdict: Verdict;
  if (hasHoneypot) verdict = "malicious";
  else if (strong.length > 0 || blocked) verdict = "fraudulent";
  else if (low || soft.length > 0) verdict = "suspicious";
  else verdict = "legitimate";

  let evidence: string;
  if (phrases.length === 2) evidence = `${phrases[0]} and ${phrases[1]}`;
  else if (phrases.length === 1) evidence = phrases[0];
  else if (verdict === "legitimate") {
    evidence = "consistent transaction history and no risk flags";
  } else if (verdict === "suspicious") {
    evidence = "thin or inconsistent on-chain activity";
  } else {
    evidence = "very low trust standing";
  }

  return { verdict, evidence };
}

/**
 * GET /api/agent/risk-check
 * Query: address (required), chain (optional, default arc; non-arc still scored on Arc).
 * Free in-process TrustGate scoring. Never calls x402-gated oracle routes.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const address = req.nextUrl.searchParams.get("address")?.trim() ?? "";
  // Accepted but unused: TrustGate's scoring libraries are Arc Testnet only.
  req.nextUrl.searchParams.get("chain");

  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "invalid_address" }, { status: 400 });
  }

  let kind: SubjectKind = "Address";
  try {
    kind = await classify(address);
    const scored = await scoreSubject(address, kind);
    const { verdict, evidence } = mapVerdict(
      scored.score,
      scored.tier,
      scored.flags
    );
    return plain(
      `${kind} ${address} appears ${verdict} based on ${evidence}.`
    );
  } catch {
    return hedge(kind, address);
  }
}
