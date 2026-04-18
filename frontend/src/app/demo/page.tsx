"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Radio, Bot, Gauge } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import TransactionFeed, { DemoTx } from "@/components/demo/TransactionFeed";
import MarginPanel from "@/components/demo/MarginPanel";

const AGENT_COUNT = 56;
const MAX_FEED_LEN = 60;
const TICK_MS = 220;
const STANDARD_COST_PER_TX = 2.5;
const TRUSTGATE_COST_PER_TX = 0.0008;

const TIER_CAPS = { 2: 1000, 1: 100, 0: 10 } as const;

const AGENT_NAMES = [
  "DataFetcher", "OrderRouter", "PriceOracle", "LiquidityBot", "TradeExec",
  "FeedParser", "MarketScan", "ArbFinder", "YieldOpt", "GasSniper",
  "BlockIndex", "EventStream", "MevGuard", "RiskMonitor", "SettleAgent",
  "BridgeRelay", "TxRetry", "FraudWatch", "ChainSync", "StateProbe",
  "RouteFinder", "PoolSampler", "SignatureBot", "RateLimiter", "NonceWarden",
  "SlashProbe", "OracleFeed", "VaultPilot", "StratRunner",
];

interface Agent {
  addr: string;
  name: string;
  tier: 0 | 1 | 2;
  score: number;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function mkAgent(i: number, rand: () => number): Agent {
  const r = rand();
  const tier: 0 | 1 | 2 = r < 0.2 ? 0 : r < 0.6 ? 1 : 2;
  const score =
    tier === 2 ? 75 + Math.floor(rand() * 25) :
    tier === 1 ? 40 + Math.floor(rand() * 35) :
    Math.floor(rand() * 40);
  const namePart = AGENT_NAMES[i % AGENT_NAMES.length];
  const suffix = i.toString().padStart(2, "0");
  const hex = Math.floor(rand() * 0xfffffff).toString(16).padStart(7, "0");
  return {
    addr: `0x${hex}…${(i * 97).toString(16).padStart(4, "0").slice(-4)}`,
    name: `${namePart}-${suffix}`,
    tier,
    score,
  };
}

function buildAgents(seed: number): Agent[] {
  const rand = rng(seed);
  return Array.from({ length: AGENT_COUNT }, (_, i) => mkAgent(i, rand));
}

function routingForTier(tier: 0 | 1 | 2): DemoTx["routing"] {
  if (tier === 2) return "instant";
  if (tier === 1) return "delayed";
  return "escrowed";
}

function drawAmount(rand: () => number, tier: 0 | 1 | 2): number {
  // Most txs nanopayment-sized; some larger; occasional spike that tests the cap.
  const roll = rand();
  if (roll < 0.6) return +(rand() * 0.5).toFixed(5);
  if (roll < 0.85) return +(rand() * 5).toFixed(3);
  if (roll < 0.97) {
    const caps = TIER_CAPS[tier];
    return +(caps * (0.2 + rand() * 0.7)).toFixed(2);
  }
  const caps = TIER_CAPS[tier];
  return +(caps * (1.05 + rand() * 0.8)).toFixed(2);
}

export default function DemoPage() {
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<DemoTx[]>([]);
  const [totalTx, setTotalTx] = useState(0);
  const [allowedTx, setAllowedTx] = useState(0);
  const [blockedTx, setBlockedTx] = useState(0);
  const [totalVolumeUsdc, setTotalVolumeUsdc] = useState(0);
  const [tierBreakdown, setTierBreakdown] = useState({ high: 0, medium: 0, low: 0 });

  const idRef = useRef(1);
  const randRef = useRef(rng(Date.now() & 0xffff));
  const agentsRef = useRef<Agent[]>(buildAgents(0x5afe));

  const reset = useCallback(() => {
    setRunning(false);
    setFeed([]);
    setTotalTx(0);
    setAllowedTx(0);
    setBlockedTx(0);
    setTotalVolumeUsdc(0);
    setTierBreakdown({ high: 0, medium: 0, low: 0 });
    idRef.current = 1;
    randRef.current = rng(Date.now() & 0xffff);
    agentsRef.current = buildAgents(Date.now() & 0xffff);
  }, []);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const rand = randRef.current;
      const agents = agentsRef.current;
      const count = 1 + Math.floor(rand() * 3); // bursty: 1-3 per tick
      const batch: DemoTx[] = [];
      let addAllowed = 0;
      let addBlocked = 0;
      let addVolume = 0;
      const tierAdd = { high: 0, medium: 0, low: 0 };

      for (let i = 0; i < count; i++) {
        const agent = agents[Math.floor(rand() * agents.length)];
        const amount = drawAmount(rand, agent.tier);
        const cap = TIER_CAPS[agent.tier];
        const exceeds = amount > cap;
        const status: DemoTx["status"] = exceeds ? "blocked" : "allowed";
        const routing: DemoTx["routing"] = exceeds
          ? "rejected"
          : routingForTier(agent.tier);

        batch.push({
          id: `tx-${idRef.current++}`,
          agentLabel: agent.name,
          agentAddr: agent.addr,
          tier: agent.tier,
          score: agent.score,
          amount,
          status,
          routing,
          timestamp: Date.now(),
          reason: exceeds ? `exceeds ${cap} USDC tier cap` : undefined,
        });

        if (status === "allowed") {
          addAllowed++;
          addVolume += amount;
        } else {
          addBlocked++;
        }
        if (agent.tier === 2) tierAdd.high++;
        else if (agent.tier === 1) tierAdd.medium++;
        else tierAdd.low++;
      }

      setFeed((prev) => [...batch.reverse(), ...prev].slice(0, MAX_FEED_LEN));
      setTotalTx((n) => n + count);
      setAllowedTx((n) => n + addAllowed);
      setBlockedTx((n) => n + addBlocked);
      setTotalVolumeUsdc((n) => n + addVolume);
      setTierBreakdown((b) => ({
        high: b.high + tierAdd.high,
        medium: b.medium + tierAdd.medium,
        low: b.low + tierAdd.low,
      }));
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [running]);

  const { standardCost, trustGateCost } = useMemo(
    () => ({
      standardCost: totalTx * STANDARD_COST_PER_TX,
      trustGateCost: totalTx * TRUSTGATE_COST_PER_TX,
    }),
    [totalTx]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
        <div>
          <Badge variant="accent" className="mb-3">
            <Radio size={12} />
            Live simulation
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-text">
            Nanopayment Stream
          </h1>
          <p className="mt-2 text-sm text-text-muted max-w-xl leading-relaxed">
            {AGENT_COUNT} registered agents firing USDC allowance claims. Trust
            tier decides routing; per-tier caps decide allowance. Margin panel
            tracks the settlement cost delta versus L1.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant={running ? "outline" : "primary"}
            size="md"
            onClick={() => setRunning((r) => !r)}
          >
            {running ? (
              <>
                <Pause size={14} /> Pause
              </>
            ) : (
              <>
                <Play size={14} /> Start
              </>
            )}
          </Button>
          <Button variant="ghost" size="md" onClick={reset}>
            <RotateCcw size={14} /> Reset
          </Button>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatBlock
          icon={<Bot size={14} className="text-accent" />}
          label="Agents"
          value={AGENT_COUNT.toString()}
          accent
        />
        <StatBlock
          icon={<Radio size={14} className={running ? "text-tier-high" : "text-text-muted"} />}
          label="Stream"
          value={running ? "LIVE" : "IDLE"}
          valueClass={running ? "text-tier-high" : "text-text-muted"}
        />
        <StatBlock
          icon={<Gauge size={14} className="text-accent" />}
          label="Throughput"
          value={`${(1000 / TICK_MS).toFixed(1)} tps avg`}
        />
        <StatBlock
          icon={<Gauge size={14} className="text-tier-high" />}
          label="Saved"
          value={`$${Math.max(standardCost - trustGateCost, 0).toFixed(2)}`}
          valueClass="text-tier-high"
        />
      </div>

      {/* Main layout */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-text-muted">
              Transaction feed
            </h2>
            <span className="text-[10px] font-mono text-text-muted tabular-nums">
              showing {feed.length} / {totalTx} total
            </span>
          </div>
          <TransactionFeed txs={feed} />
        </div>

        <div>
          <h2 className="text-xs font-mono uppercase tracking-wider text-text-muted mb-3">
            Margin panel
          </h2>
          <MarginPanel
            totalTx={totalTx}
            allowedTx={allowedTx}
            blockedTx={blockedTx}
            totalVolumeUsdc={totalVolumeUsdc}
            standardCostUsd={standardCost}
            trustGateCostUsd={trustGateCost}
            tierBreakdown={tierBreakdown}
          />
        </div>
      </div>
    </div>
  );
}

function StatBlock({
  icon,
  label,
  value,
  valueClass,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  accent?: boolean;
}) {
  return (
    <div className={`card-static p-4 ${accent ? "border-l-2 border-l-accent" : ""}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-text-muted mb-1">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-display font-bold tabular-nums ${valueClass ?? "text-text"}`}>
        {value}
      </p>
    </div>
  );
}
