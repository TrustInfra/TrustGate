"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
import Card from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import LiveStats from "@/components/landing/LiveStats";

/* ───────────────────────── Trust Tier Card ───────────────────────── */

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

/* ───────────────────────── Step Card ───────────────────────── */

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

/* ═══════════════════════ MAIN PAGE ═══════════════════════ */

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* HERO */}
      <section className="relative min-h-[85vh] flex flex-col items-center justify-center px-4 sm:px-6 lg:px-8">
        {/* Subtle gradient bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.03] via-transparent to-transparent pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Badge variant="accent" className="mb-6 opacity-0 animate-fade-in">
            <Shield size={12} />
            Arc Testnet
          </Badge>

          <h1
            className="font-display font-extrabold tracking-tight leading-[1.08] animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            <span className="text-text text-4xl sm:text-5xl md:text-6xl lg:text-7xl block">
              Trust-Gated
            </span>
            <span className="text-accent text-4xl sm:text-5xl md:text-6xl lg:text-7xl block mt-1">
              USDC for Agents
            </span>
          </h1>

          <p
            className="mt-6 max-w-xl mx-auto text-base text-text-secondary leading-relaxed opacity-0 animate-slide-up"
            style={{ animationDelay: "0.25s" }}
          >
            Deposit USDC and set per-agent spending caps. Trust scores route
            every payment -- instant, time-locked, or escrowed -- automatically.
          </p>

          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-slide-up"
            style={{ animationDelay: "0.4s" }}
          >
            <Link
              href="/dashboard"
              className={cn(
                "inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-semibold",
                "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]",
                "transition-all duration-200"
              )}
            >
              Open Dashboard
              <ArrowRight size={16} />
            </Link>
            <a
              href="https://faucet.circle.com"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-medium",
                "bg-bg-raised border border-border text-text-secondary hover:bg-bg-surface",
                "transition-all duration-200"
              )}
            >
              Get Testnet USDC
            </a>
          </div>
        </div>

        {/* Stats strip */}
        <div
          className="w-full max-w-3xl mx-auto mt-20 grid grid-cols-3 gap-4 opacity-0 animate-slide-up"
          style={{ animationDelay: "0.55s" }}
        >
          <div className="card-static px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-text">3</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              Contracts
            </p>
          </div>
          <div className="card-static px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-text">3</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              Trust Tiers
            </p>
          </div>
          <div className="card-static px-4 py-3 text-center">
            <p className="text-lg font-display font-bold text-tier-high">6</p>
            <p className="text-[10px] text-text-muted uppercase tracking-wider">
              USDC Decimals
            </p>
          </div>
        </div>
      </section>

      {/* LIVE STATS */}
      <section className="-mt-12 mb-4 px-4 sm:px-6 lg:px-8">
        <LiveStats />
      </section>

      {/* TRUST TIERS */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
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
              description="Agents claim USDC -- routed instantly, delayed, or escrowed by tier"
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
