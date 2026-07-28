import { rescoreWallet } from "@/lib/wallet-rescore";
import {
  confidenceEnumToNumber,
  recordIntelligence,
} from "@/lib/trust-intelligence/snapshots";
import { SCORING_VERSION } from "@/lib/scoring-version";
import { markFlags } from "@/lib/token-behavior/wallet-marks";
import type {
  CheckRequest,
  CheckResult,
  GuardAlert,
  ProtocolSubscription,
} from "./types";
import { deliverAlert } from "./deliver";
import { newAlertId, saveAlert } from "./store";
import { detectCoordinatedVoting } from "./coordination";
import {
  computeTrustSurfaceArea,
  meetsThreshold,
  resolveThreshold,
} from "./thresholds";

export { detectCoordinatedVoting };

const ORACLE_BASE = (
  process.env.ORACLE_URL ||
  process.env.NEXT_PUBLIC_ORACLE_URL ||
  ""
).replace(/\/+$/, "");

async function scoreWalletLight(
  wallet: string
): Promise<{ score: number; tier: string; confidence: number; flags: string[] }> {
  let raw = 50;
  if (ORACLE_BASE) {
    try {
      const res = await fetch(`${ORACLE_BASE}/oracle/${wallet}`, {
        headers: { accept: "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { score?: number };
        if (typeof data.score === "number") raw = data.score;
      }
    } catch {
      // default raw
    }
  }

  const rescored = await rescoreWallet(raw, wallet);
  const flags = [...rescored.flags, ...markFlags(wallet)];
  const confidence = confidenceEnumToNumber(rescored.confidence);
  recordIntelligence({
    subject: wallet,
    subjectType: "wallet",
    score: rescored.score,
    tier: rescored.tier,
    confidence,
    flags,
    limitations: rescored.limitations,
    scoringVersion: SCORING_VERSION,
  });

  return {
    score: rescored.score,
    tier: rescored.tier,
    confidence,
    flags: [...new Set(flags)],
  };
}

function mapContext(
  ctx: CheckRequest["context"]
): string {
  if (ctx === "borrow") return "borrow";
  if (ctx === "vote") return "governance_vote";
  if (ctx === "treasury_control") return "treasury_control";
  if (ctx === "api_execution") return "api_execution";
  if (ctx === "dex_swap") return "dex_swap";
  return "generic";
}

export async function evaluateCheck(
  sub: ProtocolSubscription,
  req: CheckRequest
): Promise<CheckResult> {
  // Free forever for protocols. Only opt-out (cancelled) blocks checks.
  if (sub.status === "cancelled") {
    return {
      allowed: false,
      alerts: [],
      reasons: ["Protocol integration is cancelled (opt-out). Re-register free to resume."],
    };
  }

  const reasons: string[] = [];
  const alerts: GuardAlert[] = [];
  const wallet = req.wallet.toLowerCase();
  const scored = await scoreWalletLight(wallet);

  // Contextual thresholds (Phase 4)
  const threshold = resolveThreshold(mapContext(req.context), {
    minScore: req.minScore,
    minConfidence: req.minConfidence,
  });
  const gate = meetsThreshold(
    scored.score,
    scored.tier,
    scored.confidence,
    threshold
  );
  if (!gate.ok) {
    reasons.push(...gate.reasons);
  }

  // Coordination intensity for TSA
  let coordinationScore = 0;
  if ((req.recentVoters?.length ?? 0) > 0) {
    const voterScores = await Promise.all(
      (req.recentVoters ?? []).slice(0, 30).map(async (v) => {
        const s = await scoreWalletLight(v);
        return { wallet: v.toLowerCase(), score: s.score, tier: s.tier };
      })
    );
    voterScores.push({
      wallet,
      score: scored.score,
      tier: scored.tier,
    });
    const coord = detectCoordinatedVoting(
      voterScores,
      req.voteClusterThreshold ?? 5
    );
    if (coord.coordinated) {
      coordinationScore = Math.min(1, coord.lowTrustCluster / 10);
      reasons.push(coord.detail);
      alerts.push(
        await emitAlert(sub, {
          ruleType: "dao_coordinated_vote",
          severity: "critical",
          title: "Coordinated voting pattern detected",
          body: `Proposal ${req.proposalId ?? "unknown"}: ${coord.detail}. Cluster size ${coord.lowTrustCluster}.`,
          subject: wallet,
          score: scored.score,
          tier: scored.tier,
          payload: {
            proposalId: req.proposalId,
            cluster: coord.lowTrustCluster,
            voters: voterScores,
          },
        })
      );
    }
  }

  const surface = computeTrustSurfaceArea({
    score: scored.score,
    tier: scored.tier,
    economicReachUsd: req.amount ?? req.economicReachUsd,
    coordinationScore,
    capitalAccess: req.capitalAccess,
  });

  const rules = sub.rules.filter((r) => r.enabled);

  // Always apply contextual gate for non-dex contexts
  if (!gate.ok && req.context !== "dex_swap") {
    const severity =
      surface.priority === "immediate"
        ? "critical"
        : surface.priority === "review"
          ? "warning"
          : "info";
    alerts.push(
      await emitAlert(sub, {
        ruleType:
          req.context === "borrow"
            ? "lending_low_trust_borrow"
            : req.context === "vote"
              ? "dao_coordinated_vote"
              : "wallet_score_floor",
        severity,
        title: `Contextual threshold failed (${threshold.action})`,
        body: `${wallet} scored ${scored.score} ${scored.tier} conf ${scored.confidence}%. ${threshold.description}. Trust Surface Area ${surface.surfaceArea} (${surface.priority}). Protocol decides block / extra collateral / proceed.`,
        subject: wallet,
        score: scored.score,
        tier: scored.tier,
        payload: {
          threshold,
          trustSurfaceArea: surface,
          confidence: scored.confidence,
          flags: scored.flags,
          amount: req.amount,
        },
      })
    );
  }

  // Flagged wallets surface for review on governance even if score passes
  if (
    threshold.surfaceFlagsForReview &&
    scored.flags.length > 0 &&
    (req.context === "vote" || req.context === "governance_vote")
  ) {
    reasons.push("Flagged wallet participating in governance — surface for DAO review");
    alerts.push(
      await emitAlert(sub, {
        ruleType: "dao_coordinated_vote",
        severity: "info",
        title: "Flagged wallet in governance",
        body: `${wallet} has flags [${scored.flags.join(", ")}] on proposal ${req.proposalId ?? "n/a"}. TSA ${surface.surfaceArea}.`,
        subject: wallet,
        score: scored.score,
        tier: scored.tier,
        payload: {
          flags: scored.flags,
          trustSurfaceArea: surface,
          proposalId: req.proposalId,
        },
      })
    );
  }

  for (const rule of rules) {
    if (
      rule.type === "lending_low_trust_borrow" &&
      (req.context === "borrow" || req.context === "generic")
    ) {
      // Already covered by contextual gate; still fire dedicated lending alert if LOW/BLOCKED
      if (scored.score < 40 || scored.tier === "LOW" || scored.tier === "BLOCKED") {
        if (!alerts.some((a) => a.ruleType === "lending_low_trust_borrow")) {
          reasons.push("Lending: LOW/BLOCKED wallet before position open");
          alerts.push(
            await emitAlert(sub, {
              ruleType: rule.type,
              severity: scored.score < 25 ? "critical" : "warning",
              title: "Low-trust wallet attempting borrow",
              body: `Protocol ${sub.protocolName}: wallet ${wallet} scored ${scored.score} (${scored.tier}) conf ${scored.confidence}. TSA ${surface.surfaceArea} (${surface.priority}). Amount: ${req.amount ?? "n/a"}. TrustGate signals; protocol sets policy.`,
              subject: wallet,
              score: scored.score,
              tier: scored.tier,
              payload: {
                amount: req.amount,
                confidence: scored.confidence,
                flags: scored.flags,
                trustSurfaceArea: surface,
                recommendation:
                  surface.priority === "immediate"
                    ? "block_or_max_collateral"
                    : "require_additional_collateral",
              },
            })
          );
        }
      }
    }

    if (rule.type === "wallet_score_floor") {
      const minScore = rule.minScore ?? 25;
      if (scored.score < minScore) {
        reasons.push(`Below score floor ${minScore}`);
      }
    }
  }

  const blocked = alerts.some(
    (a) => a.severity === "critical" || a.severity === "warning"
  );

  return {
    allowed: !blocked && (req.context === "dex_swap" || gate.ok),
    alerts,
    walletScore: scored.score,
    walletTier: scored.tier,
    confidence: scored.confidence,
    trustSurfaceArea: surface,
    contextualThreshold: threshold,
    flags: scored.flags,
    reasons:
      reasons.length > 0 ? [...new Set(reasons)] : ["No protocol guard rules triggered"],
  };
}

async function emitAlert(
  sub: ProtocolSubscription,
  partial: {
    ruleType: GuardAlert["ruleType"];
    severity: GuardAlert["severity"];
    title: string;
    body: string;
    subject?: string;
    score?: number;
    tier?: string;
    payload: Record<string, unknown>;
  }
): Promise<GuardAlert> {
  const attempted: GuardAlert["channelsAttempted"] = [];
  if (sub.channels.discordWebhookUrl) attempted.push("discord");
  if (sub.channels.telegramBotToken) attempted.push("telegram");
  if (sub.channels.emailTo) attempted.push("email");
  if (sub.channels.onchainEvent) attempted.push("onchain_event");

  const alert: GuardAlert = {
    id: newAlertId(),
    subscriptionId: sub.id,
    ruleType: partial.ruleType,
    severity: partial.severity,
    title: partial.title,
    body: partial.body,
    subject: partial.subject,
    score: partial.score,
    tier: partial.tier,
    payload: partial.payload,
    channelsAttempted: attempted,
    delivered: [],
    createdAt: new Date().toISOString(),
  };

  alert.delivered = await deliverAlert(alert, sub.channels);
  saveAlert(alert);
  return alert;
}
