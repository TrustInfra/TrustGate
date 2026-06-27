"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusDot from "@/components/ui/StatusDot";
import SectionHeader from "@/components/landing/SectionHeader";
import StatBar from "@/components/landing/StatBar";
import FeatureBento from "@/components/landing/FeatureBento";
import TierMatrix from "@/components/landing/TierMatrix";
import StepTimeline from "@/components/landing/StepTimeline";
import LiveTicker from "@/components/landing/LiveTicker";
import HeroVisual from "@/components/landing/HeroVisual";
import { useOracleStats, useTxStats } from "@/hooks/useHomeStats";

export default function HomePage() {
  const { stats, failed: statsFailed } = useOracleStats();
  const { stats: txStats } = useTxStats();
  const tickerItems =
    !statsFailed && stats ? stats.recentQueries : [];

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-16 lg:pt-28 lg:pb-20">
        <div className="max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-8 xl:gap-12 items-center">
          <div className="max-w-3xl">
            <div
              className="flex items-center gap-2.5 mb-8 opacity-0 animate-fade-in"
              style={{ animationDelay: "0.05s" }}
            >
              <StatusDot status="active" size="md" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                Arc Testnet
              </span>
              <span className="text-text-muted/40 font-mono text-[10px]">/</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
                Operational
              </span>
            </div>

            <p
              className="font-display text-base sm:text-lg text-text-secondary mb-3 opacity-0 animate-fade-in"
              style={{ animationDelay: "0.1s" }}
            >
              TrustGate
            </p>

            <h1
              className="opacity-0 animate-slide-up"
              style={{ animationDelay: "0.15s" }}
            >
              <span className="block font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl xl:text-[4.25rem] text-accent tracking-tight leading-[1.04]">
                The Trust Layer
              </span>
              <span className="block font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl xl:text-[4.25rem] text-text tracking-tight leading-[1.04] mt-1">
                for Web3
              </span>
            </h1>

            <p
              className="mt-6 max-w-xl text-sm sm:text-base text-text-secondary leading-relaxed opacity-0 animate-slide-up"
              style={{ animationDelay: "0.25s" }}
            >
              Behavioral state infrastructure for onchain systems. Score any
              wallet, token, or contract by what it has actually done — not who
              it claims to be.
            </p>

            <div
              className="mt-8 flex flex-wrap items-center gap-3 opacity-0 animate-slide-up"
              style={{ animationDelay: "0.35s" }}
            >
              <Link
                href="/oracle"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium",
                  "border border-accent text-accent bg-transparent",
                  "hover:bg-accent-muted transition-colors duration-200"
                )}
              >
                Check a Wallet
                <ArrowRight size={14} />
              </Link>
              <Link
                href="/token-shield"
                className={cn(
                  "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium",
                  "border border-border text-text-secondary bg-transparent",
                  "hover:border-border-hover hover:bg-bg-raised transition-colors duration-200"
                )}
              >
                Check a Token
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <HeroVisual
            avgScore={stats?.averageScore ?? null}
            className="mt-10 lg:mt-0"
          />
          </div>

          <StatBar oracle={stats} tx={txStats} className="mt-14 lg:mt-20" />
        </div>
      </section>

      {!statsFailed && tickerItems.length > 0 && (
        <LiveTicker items={tickerItems} />
      )}

      {/* What We Score */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Capabilities"
            title="Trust at every layer of onchain interaction"
            lede="Three products, one behavioral scoring engine. Query wallets, audit tokens, or embed trust signals directly into your DEX."
          />
          <FeatureBento />
        </div>
      </section>

      {/* Payment Routing */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 lg:gap-16 items-start">
            <SectionHeader
              eyebrow="For AI Agents"
              title="Trust-gated payment flows"
              lede="Behavioral trust scores classify agents into tiers. Each tier determines how USDC reaches the agent — instantly, after a hold, or through escrow."
              className="lg:mb-0"
            />
            <div className="lg:pt-10">
              <TierMatrix />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Workflow"
            title="How it works"
            lede="From agent registration to tier-based settlement. Four steps, fully onchain on Arc Testnet."
          />
          <StepTimeline />
        </div>
      </section>

      {/* CTA Band */}
      <section className="cta-band py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="max-w-xl">
            <h2 className="text-xl sm:text-2xl font-display font-bold text-text tracking-tight">
              Ready to test trust-gated payments?
            </h2>
            <p className="mt-3 text-sm text-text-secondary leading-relaxed">
              Connect your wallet, fund from the USDC faucet, register an agent,
              and run the full payment flow end to end.
            </p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              Arc Testnet · Chain ID 5042002
            </p>
          </div>

          <Link
            href="/dashboard"
            className={cn(
              "inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm font-semibold shrink-0",
              "bg-accent text-white hover:bg-accent-hover transition-colors duration-200"
            )}
          >
            Open Dashboard
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}