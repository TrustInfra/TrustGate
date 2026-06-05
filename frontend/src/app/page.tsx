"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Clock,
  Lock,
  ArrowRight,
  Bot,
  ArrowDownToLine,
  Zap,
  Wallet,
  Coins,
  Code2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Card from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";

/* ───────────────────────── Transaction stats hook ───────────────────────── */

interface TxStats {
  total_transactions: number;
  unique_callers: number | null;
}

const TX_STATS_URL = "/api/stats";
const TX_STATS_POLL_MS = 15_000;

function isTxStats(value: unknown): value is TxStats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.total_transactions !== "number") return false;
  return v.unique_callers === null || typeof v.unique_callers === "number";
}

function useTxStats(): { stats: TxStats | null; failed: boolean } {
  const [stats, setStats] = useState<TxStats | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(TX_STATS_URL, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body: unknown = await res.json();
        if (!active) return;
        if (!isTxStats(body)) {
          setFailed(true);
          return;
        }
        setStats(body);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    };

    void tick();
    const id = setInterval(() => {
      void tick();
    }, TX_STATS_POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return { stats, failed };
}

/* ───────────────────────── Oracle stats hook ───────────────────────── */

interface RecentQuery {
  addressMasked: string;
  score: number;
  tier: string;
  paid: boolean;
  at: string;
}

interface OracleStats {
  totalQueries: number;
  totalUsdcEarned: string;
  uniqueAddressesScored: number;
  averageScore: number;
  tierDistribution: Record<string, number>;
  recentQueries: RecentQuery[];
}

const ORACLE_STATS_URL = "/api/oracle/oracle/stats";
const ORACLE_STATS_POLL_MS = 15_000;

function isOracleStats(value: unknown): value is OracleStats {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.totalQueries === "number" &&
    typeof v.totalUsdcEarned === "string" &&
    typeof v.uniqueAddressesScored === "number" &&
    typeof v.averageScore === "number" &&
    Array.isArray(v.recentQueries)
  );
}

interface OracleStatsState {
  stats: OracleStats | null;
  failed: boolean;
}

function useOracleStats(): OracleStatsState {
  const [stats, setStats] = useState<OracleStats | null>(null);
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    const tick = async (): Promise<void> => {
      try {
        const res = await fetch(ORACLE_STATS_URL, { cache: "no-store" });
        if (!active) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const body: unknown = await res.json();
        if (!active) return;
        if (!isOracleStats(body)) {
          setFailed(true);
          return;
        }
        setStats(body);
        setFailed(false);
      } catch {
        if (active) setFailed(true);
      }
    };

    void tick();
    const id = setInterval(() => {
      void tick();
    }, ORACLE_STATS_POLL_MS);

    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return { stats, failed };
}

/* ───────────────────────── Live Ticker ───────────────────────── */

const TICKER_SPEED_PX_PER_SEC = 40;

const TICKER_TIER_CHIP: Record<string, string> = {
  HIGH_ELITE: "bg-tier-high-muted text-tier-high border-tier-high/30",
  HIGH: "bg-tier-high-muted text-tier-high border-tier-high/30",
  MEDIUM: "bg-tier-medium-muted text-tier-medium border-tier-medium/30",
  LOW: "bg-tier-low-muted text-tier-low border-tier-low/30",
  BLOCKED: "bg-tier-low-muted text-tier-low border-tier-low/30",
};

function tickerTierClass(tier: string): string {
  return (
    TICKER_TIER_CHIP[tier] ?? "bg-bg-surface text-text-muted border-border"
  );
}

function LiveTicker({ items }: { items: RecentQuery[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState<number>(60);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    // The track is rendered with the items duplicated, so scrollWidth/2 is one
    // full sequence. Time per loop = sequence width / desired speed.
    const halfWidth = el.scrollWidth / 2;
    if (halfWidth <= 0) return;
    const next = Math.max(20, halfWidth / TICKER_SPEED_PX_PER_SEC);
    setDurationSec(next);
  }, [items.length]);

  if (items.length === 0) return null;

  // Duplicate the list so translateX(-50%) lands on a seamless seam.
  const loop: RecentQuery[] = [...items, ...items];

  return (
    <section
      aria-label="Recent oracle queries"
      className="border-y border-border bg-bg-surface/30 overflow-hidden"
    >
      <div
        ref={trackRef}
        className="tg-ticker-track flex items-center gap-10 whitespace-nowrap py-3"
        style={{
          width: "max-content",
          animationDuration: `${durationSec}s`,
        }}
      >
        {loop.map((q, i) => (
          <div
            key={`${q.at}-${i}`}
            className="flex items-center gap-3 px-2"
          >
            <span className="font-mono text-xs text-text-muted">
              {q.addressMasked}
            </span>
            <span className="text-sm font-display font-bold text-text">
              {q.score}
            </span>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-mono font-medium border",
                tickerTierClass(q.tier)
              )}
            >
              {q.tier}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Stats Bar ───────────────────────── */

const numberFmt = new Intl.NumberFormat("en-US");

function formatUsdcEarned(raw: string): string {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n === 0) return "0";
  if (n < 0.001) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  return n.toFixed(2);
}

interface StatCell {
  label: string;
  value: string;
  accent: boolean;
}

function StatsBar({
  stats,
  txStats,
}: {
  stats: OracleStats | null;
  txStats: TxStats | null;
}) {
  const primary: StatCell[] = useMemo(() => {
    return [
      {
        label: "Oracle Queries",
        value: stats ? numberFmt.format(stats.totalQueries) : "...",
        accent: false,
      },
      {
        label: "Avg Trust Score",
        value: stats ? stats.averageScore.toFixed(1) : "...",
        accent: false,
      },
      {
        label: "USDC Earned",
        value: stats ? formatUsdcEarned(stats.totalUsdcEarned) : "...",
        accent: true,
      },
    ];
  }, [stats]);

  const secondary: StatCell[] = useMemo(() => {
    return [
      {
        label: "Transactions",
        value: txStats ? numberFmt.format(txStats.total_transactions) : "...",
        accent: false,
      },
      {
        label: "Unique Wallets",
        value:
          txStats && txStats.unique_callers !== null
            ? numberFmt.format(txStats.unique_callers)
            : "...",
        accent: false,
      },
    ];
  }, [txStats]);

  return (
    <div
      className="w-full max-w-3xl mx-auto mt-20 opacity-0 animate-slide-up"
      style={{ animationDelay: "0.55s" }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {primary.map((cell) => (
          <div key={cell.label} className="card-static px-5 py-6 text-center">
            <p
              className={cn(
                "text-2xl sm:text-3xl font-display font-bold tracking-tight",
                cell.accent ? "text-tier-high" : "text-text"
              )}
            >
              {cell.value}
            </p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mt-2">
              {cell.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 max-w-[260px] mx-auto">
        {secondary.map((cell) => (
          <div
            key={cell.label}
            className="card-static px-2 py-1 text-center"
          >
            <p className="text-xs font-display font-semibold text-text-secondary leading-tight">
              {cell.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Feature Card ───────────────────────── */

interface FeatureCardProps {
  icon: typeof Shield;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  delay: number;
}

function FeatureCard({
  icon: Icon,
  title,
  body,
  href,
  linkLabel,
  delay,
}: FeatureCardProps) {
  return (
    <div
      className="card p-6 flex flex-col opacity-0 animate-slide-up"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="inline-flex p-3 rounded-xl mb-4 bg-accent-muted border border-accent/10 self-start">
        <Icon size={22} className="text-accent" />
      </div>
      <h3 className="text-base font-display font-bold text-text mb-2">
        {title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed mb-5 flex-1">
        {body}
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
      >
        {linkLabel}
        <ArrowRight size={12} />
      </Link>
    </div>
  );
}

/* ───────────────────────── Trust Tier Card (existing) ───────────────────────── */

function TrustTierCard({
  title,
  subtitle,
  description,
  icon: Icon,
  accentColor,
  flowLabel,
  delay,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: typeof ShieldCheck;
  accentColor: "high" | "medium" | "low";
  flowLabel: string;
  delay: number;
}) {
  const colorMap = {
    high: {
      border: "border-l-tier-high",
      iconBg: "bg-tier-high-muted",
      iconText: "text-tier-high",
    },
    medium: {
      border: "border-l-tier-medium",
      iconBg: "bg-tier-medium-muted",
      iconText: "text-tier-medium",
    },
    low: {
      border: "border-l-tier-low",
      iconBg: "bg-tier-low-muted",
      iconText: "text-tier-low",
    },
  };
  const style = colorMap[accentColor];

  return (
    <div
      className={cn(
        "card p-6 opacity-0 animate-slide-up border-l-4",
        style.border
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className={cn("inline-flex p-3 rounded-xl mb-4", style.iconBg)}>
        <Icon size={24} className={style.iconText} />
      </div>
      <h3 className="text-base font-display font-bold text-text mb-1">
        {title}
      </h3>
      <p className={cn("text-xs font-mono font-medium mb-3", style.iconText)}>
        {subtitle}
      </p>
      <p className="text-sm text-text-secondary leading-relaxed mb-4">
        {description}
      </p>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span className="px-2 py-0.5 rounded bg-bg-surface border border-border">
          Depositor
        </span>
        <ArrowRight size={12} className={style.iconText} />
        <span
          className={cn(
            "px-2 py-0.5 rounded border",
            style.iconBg,
            style.iconText
          )}
        >
          {flowLabel}
        </span>
        <ArrowRight size={12} className={style.iconText} />
        <span className="px-2 py-0.5 rounded bg-bg-surface border border-border">
          Agent
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Step Card (existing) ───────────────────────── */

function StepCard({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: typeof ArrowDownToLine;
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <div className="relative mb-4">
        <div className="w-14 h-14 rounded-xl bg-accent-muted border border-accent/10 flex items-center justify-center">
          <Icon size={22} className="text-accent" />
        </div>
        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-bg-raised border border-border flex items-center justify-center text-[10px] font-mono font-bold text-accent">
          {number}
        </span>
      </div>
      <h3 className="text-sm font-display font-bold text-text mb-1">
        {title}
      </h3>
      <p className="text-xs text-text-muted leading-relaxed max-w-[200px]">
        {description}
      </p>
    </div>
  );
}

/* ───────────────────────── Section eyebrow ───────────────────────── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-mono font-medium text-accent uppercase tracking-[0.2em] mb-3">
      {children}
    </p>
  );
}

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */

export default function HomePage() {
  const { stats, failed: statsFailed } = useOracleStats();
  const { stats: txStats } = useTxStats();
  const tickerItems: RecentQuery[] =
    !statsFailed && stats ? stats.recentQueries : [];

  return (
    <div className="relative overflow-hidden">
      {/* HERO */}
      <section className="relative min-h-[80vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.03] via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1
            className="font-display font-extrabold tracking-tight leading-[1.08] animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="block text-text text-4xl sm:text-5xl md:text-6xl lg:text-7xl">
              TrustGate
            </span>
            <span className="block text-accent text-4xl sm:text-5xl md:text-6xl lg:text-7xl mt-1">
              The Trust Layer for Web3
            </span>
          </h1>

          <p
            className="mt-6 max-w-2xl mx-auto text-base text-text-secondary leading-relaxed opacity-0 animate-slide-up"
            style={{ animationDelay: "0.25s" }}
          >
            TrustGate is behavioral state infrastructure for onchain systems.
            Score any wallet, token, or contract by what it has actually done,
            not who it claims to be.
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Link
              href="/oracle"
              className={cn(
                "inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold",
                "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]",
                "transition-all duration-200"
              )}
            >
              Check a Wallet
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/token-shield"
              className={cn(
                "inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-medium",
                "bg-bg-raised border border-border text-text-secondary hover:bg-bg-surface hover:border-border-hover",
                "transition-all duration-200"
              )}
            >
              Check a Token
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <StatsBar stats={stats} txStats={txStats} />
      </section>

      {/* LIVE TICKER */}
      {!statsFailed && tickerItems.length > 0 && (
        <LiveTicker items={tickerItems} />
      )}

      {/* WHAT WE SCORE */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <SectionEyebrow>What We Score</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text">
              Trust at every layer of onchain interaction
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <FeatureCard
              icon={ShieldCheck}
              title="Wallet Oracle"
              body="Query any Arc wallet. Get a trust score built from real onchain history: deployments, activity, age, and behavior."
              href="/oracle"
              linkLabel="Query a wallet"
              delay={0.1}
            />
            <FeatureCard
              icon={Coins}
              title="Token Shield"
              body="Score any token or contract. Know the deployer's credibility and whether holders are real before you interact."
              href="/token-shield"
              linkLabel="Check a token"
              delay={0.2}
            />
            <FeatureCard
              icon={Code2}
              title="DEX Widget"
              body="One script tag. Trust badges appear automatically on every token input. Free during Arc testnet. No API key."
              href="/docs/widget-integration"
              linkLabel="See integration"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* PAYMENT ROUTING: FOR AI AGENTS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <SectionEyebrow>For AI Agents</SectionEyebrow>
            <Badge variant="accent" className="mb-4">
              <Shield size={12} />
              Payment Routing
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text">
              Trust-Gated Payment Flows
            </h2>
            <p className="mt-3 text-sm text-text-muted max-w-lg mx-auto">
              EigenTrust-derived scores classify agents into tiers. Each tier
              determines how USDC reaches the agent.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <TrustTierCard
              title="Instant Transfer"
              subtitle="HIGH TRUST (75-100)"
              description="Established agents receive USDC immediately on claim. No delays, no friction."
              icon={ShieldCheck}
              accentColor="high"
              flowLabel="Instant"
              delay={0.1}
            />
            <TrustTierCard
              title="24h Time-Lock"
              subtitle="MEDIUM TRUST (40-74)"
              description="Building trust takes time. Payments are time-locked for 24 hours before release."
              icon={Clock}
              accentColor="medium"
              flowLabel="24h Hold"
              delay={0.2}
            />
            <TrustTierCard
              title="Escrowed"
              subtitle="LOW TRUST (0-39)"
              description="New relationships start carefully. Funds held in escrow until the depositor approves."
              icon={Lock}
              accentColor="low"
              flowLabel="Escrow"
              delay={0.3}
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="accent" className="mb-4">
              <Zap size={12} />
              Workflow
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text">
              How It Works
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StepCard
              number="01"
              title="Register"
              description="Register your AI agent permissionlessly on AgentRegistry"
              icon={Bot}
            />
            <StepCard
              number="02"
              title="Deposit"
              description="Depositors fund TrustGate with USDC and set per-agent allowances"
              icon={ArrowDownToLine}
            />
            <StepCard
              number="03"
              title="Score"
              description="Trust scores (0-100) classify agents into HIGH, MEDIUM, or LOW tiers"
              icon={Shield}
            />
            <StepCard
              number="04"
              title="Claim"
              description="Agents claim USDC: routed instantly, delayed, or escrowed by tier"
              icon={Wallet}
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <Card className="p-10 text-center border-l-4 border-l-accent" hover={false}>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-text mb-3">
              Ready to test trust-gated payments?
            </h2>
            <p className="text-sm text-text-muted mb-8">
              Connect your wallet, get testnet USDC from the faucet, register
              an agent, and run the full payment flow.
            </p>
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold",
                "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]",
                "transition-all duration-200"
              )}
            >
              Open Dashboard
              <ArrowRight size={16} />
            </Link>
            <p className="mt-6 text-[11px] text-text-muted">
              Deployed on Arc Testnet (Chain ID: 5042002)
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
