import Link from "next/link";
import {
  CheckCircle2,
  CircleDashed,
  Clock,
  ArrowRight,
  Activity,
  Lock,
  Network,
  Eye,
  Shield,
  ShieldCheck,
  Coins,
  Send,
  Layers,
  Brain,
  TrendingUp,
  Users,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Badge from "@/components/ui/Badge";

export const metadata = {
  title: "Roadmap -- TrustGate",
  description:
    "Building the trust layer for Web3. One oracle. Every chain. Every use case.",
};

type PhaseStatus = "completed" | "in-progress" | "upcoming";

interface Phase {
  id: string;
  title: string;
  body: string;
  icon: typeof Shield;
}

interface LayerCard {
  number: string;
  title: string;
  lede: string;
  description: string;
  icon: typeof Shield;
}

interface IntegrationCard {
  audience: string;
  product: string;
  description: string;
  href?: string;
  linkLabel?: string;
  icon: typeof Shield;
}

const COMPLETED_PHASES: Phase[] = [
  {
    id: "phase-1",
    title: "Phase 1 -- Core Infrastructure",
    body: "Trust oracle live on Arc Testnet. Wallets scored by onchain behavioral signals. Five tier system: BLOCKED, LOW, MEDIUM, HIGH, HIGH_ELITE. Payment routing by tier: instant, time-lock, and escrow settlement. Bot detection active. Score hardening: public responses return tier and score only.",
    icon: ShieldCheck,
  },
  {
    id: "phase-2",
    title: "Phase 2 -- DEX Integration",
    body: "Token Shield live. Score any token by holder behavior and deployer credibility. widget.js deployed: one script tag, trust badges on any DEX token input. Coordinated buying detection active. Integration docs live at trustgated.xyz/docs/widget-integration.",
    icon: Coins,
  },
];

const IN_PROGRESS_PHASES: Phase[] = [
  {
    id: "phase-2b",
    title: "Phase 2b -- Trust-Ordered Token Discovery",
    body: "When multiple tokens share the same name or ticker, DEX search results rank by trust score. The token with the most credible deployer, the most legitimate holder base, and the cleanest behavioral record surfaces first. Flags surface inline. Rugs go to the bottom automatically.",
    icon: TrendingUp,
  },
  {
    id: "phase-3",
    title: "Phase 3 -- Token Behavior Intelligence",
    body: "Token Shield upgraded with temporal behavior tracking. Hold duration signals, exit ratio analysis, wash trading detection, honeypot flagging, and coordinated long-hold exit detection. Wallets that repeatedly participate in coordinated exits receive score reductions -- you cannot maintain HIGH status while repeatedly dumping on retail.\n\nConfidence Scoring added to every oracle response. The same tier at 40% confidence is treated differently than the same tier at 96% confidence. Protocols can set minimum confidence thresholds for high-stakes decisions like lending.\n\nExplainability Layer added to every score. A concise behavioral summary tells protocols what the wallet has done and why the score is what it is -- without exposing internal formula details that would create gaming paths.",
    icon: Brain,
  },
  {
    id: "phase-3b",
    title: "Phase 3b -- Staking Intelligence",
    body: "Staking behavior added as a scoring dimension. Wallets that lock capital in credible tokens over time demonstrate economic commitment -- a signal that pure transaction history cannot capture. Deployers with long staking histories receive a credibility boost on any token they launch. Anti-gaming protections prevent self-staking, circular staking rings, and same-day manipulation. Public staking leaderboard surfaces the most committed ecosystem participants.",
    icon: Lock,
  },
];

const UPCOMING_PHASES: Phase[] = [
  {
    id: "phase-4",
    title: "Phase 4 -- Protocol Guard",
    body: "Trust signals at the protocol level. Lending protocols receive alerts before low-trust wallets open borrowing positions. DAOs receive coordinated voting pattern detection before proposals close. Delivery via Discord webhook, Telegram, email, and onchain event. Subscription pricing -- protocols pay monthly USDC for continuous monitoring.",
    icon: Shield,
  },
  {
    id: "phase-5",
    title: "Phase 5 -- Send Address Shield",
    body: "Trust scoring at the point of send. Score the destination before the user signs. Surface tier and recommendation in the wallet UI. Target integrations: Rabby Wallet, MetaMask Snaps, Arc-native wallets. Phishing addresses, honeypots, and scam contracts score BLOCKED or LOW -- users see the signal before losing funds.",
    icon: Send,
  },
  {
    id: "phase-6",
    title: "Phase 6 -- Multichain Expansion",
    body: "Arc to Base, Ethereum, Arbitrum, and Polygon. Chain-specific scoring weights. Cross-chain composite score -- a builder with years of history on Ethereum does not appear LOW on Arc just because they arrived recently. Cross-chain deployer tracking -- a deployer who rugged on one chain is flagged on every chain.",
    icon: Network,
  },
  {
    id: "phase-7",
    title: "Phase 7 -- Trust Graph",
    body: "Move from individual wallet scoring to network-level trust analysis. Map relationships between wallets. Trust propagates through the graph. Identify coordinated clusters even when individual wallets look clean. Sybil resistance at the network level. Built on graph database infrastructure already operational for Intuition MCP.",
    icon: Users,
  },
];

const LAYERS: LayerCard[] = [
  {
    number: "01",
    title: "Behavioral Scoring",
    lede: "What you do onchain.",
    description:
      "Transaction history, deployments, contract interactions, wallet age, USDC activity. The foundation of every score.",
    icon: Activity,
  },
  {
    number: "02",
    title: "Economic Commitment",
    lede: "What you lock and for how long.",
    description:
      "Staking history as a trust signal. Capital at risk is skin in the game.",
    icon: Lock,
  },
  {
    number: "03",
    title: "Collective Intelligence",
    lede: "How you coordinate with other wallets.",
    description:
      "Coordinated exits, wash trading, governance attacks, Sybil clusters. Individual behavior in the context of the network.",
    icon: Network,
  },
  {
    number: "04",
    title: "Temporal Memory",
    lede: "How your behavior evolves across time and chains.",
    description:
      "Reputation that compounds. Decay for wallets that go quiet. Rehabilitation for wallets that demonstrate sustained clean behavior over time.",
    icon: History,
  },
];

const INTEGRATIONS: IntegrationCard[] = [
  {
    audience: "For DEXs",
    product: "widget.js",
    description:
      "One script tag. Trust badges on any token input. Free to integrate.",
    href: "/docs/widget-integration",
    linkLabel: "Integration docs",
    icon: Coins,
  },
  {
    audience: "For Protocols",
    product: "Oracle API",
    description:
      "Score any wallet before any interaction. 0.001 USDC per query via x402.",
    href: "/docs/api-reference",
    linkLabel: "API reference",
    icon: ShieldCheck,
  },
  {
    audience: "For DAOs",
    product: "Protocol Guard",
    description:
      "Subscription alerts for governance and lending risk.",
    icon: Shield,
  },
  {
    audience: "For Wallets",
    product: "Send Address Shield",
    description: "Trust scoring at the point of send.",
    icon: Send,
  },
];

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-mono font-medium text-accent uppercase tracking-[0.2em] mb-3">
      {children}
    </p>
  );
}

function StatusBadge({ status }: { status: PhaseStatus }) {
  if (status === "completed") {
    return (
      <Badge variant="success" size="sm">
        <CheckCircle2 size={10} />
        Completed
      </Badge>
    );
  }
  if (status === "in-progress") {
    return (
      <Badge variant="warning" size="sm">
        <Clock size={10} />
        In progress
      </Badge>
    );
  }
  return (
    <Badge variant="default" size="sm">
      <CircleDashed size={10} />
      Upcoming
    </Badge>
  );
}

function PhaseCard({
  phase,
  status,
}: {
  phase: Phase;
  status: PhaseStatus;
}) {
  const Icon = phase.icon;
  const accent =
    status === "completed"
      ? { iconBg: "bg-tier-high-muted", iconText: "text-tier-high", rail: "border-l-tier-high" }
      : status === "in-progress"
      ? { iconBg: "bg-tier-medium-muted", iconText: "text-tier-medium", rail: "border-l-tier-medium" }
      : { iconBg: "bg-accent-muted", iconText: "text-accent", rail: "border-l-accent/60" };

  const paragraphs = phase.body.split("\n\n");

  return (
    <article
      className={cn(
        "card p-6 sm:p-7 border-l-4 flex flex-col gap-4",
        accent.rail
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "inline-flex p-2.5 rounded-lg border border-border",
              accent.iconBg
            )}
          >
            <Icon size={18} className={accent.iconText} />
          </div>
          <h3 className="text-base sm:text-lg font-display font-bold text-text leading-tight">
            {phase.title}
          </h3>
        </div>
        <div className="shrink-0">
          <StatusBadge status={status} />
        </div>
      </div>

      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p
            key={i}
            className="text-sm text-text-secondary leading-relaxed"
          >
            {p}
          </p>
        ))}
      </div>
    </article>
  );
}

function LayerBlock({ layer }: { layer: LayerCard }) {
  const Icon = layer.icon;
  return (
    <div className="card-static p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-mono font-medium text-accent">
          {layer.number}
        </span>
        <span className="h-px flex-1 bg-border" />
        <div className="inline-flex p-2 rounded-lg bg-accent-muted border border-accent/10">
          <Icon size={16} className="text-accent" />
        </div>
      </div>
      <h3 className="text-base font-display font-bold text-text">
        {layer.title}
      </h3>
      <p className="text-sm text-text font-medium">{layer.lede}</p>
      <p className="text-sm text-text-secondary leading-relaxed">
        {layer.description}
      </p>
    </div>
  );
}

function IntegrationBlock({ item }: { item: IntegrationCard }) {
  const Icon = item.icon;
  return (
    <div className="card p-6 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="inline-flex p-2.5 rounded-lg bg-accent-muted border border-accent/10">
          <Icon size={16} className="text-accent" />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-mono font-medium text-text-muted uppercase tracking-wider">
            {item.audience}
          </span>
          <span className="text-sm font-display font-bold text-text">
            {item.product}
          </span>
        </div>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed flex-1">
        {item.description}
      </p>
      {item.href && item.linkLabel && (
        <Link
          href={item.href}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover transition-colors"
        >
          {item.linkLabel}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <div className="relative">
      {/* HERO */}
      <section className="relative px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <SectionEyebrow>Roadmap</SectionEyebrow>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.08] text-4xl sm:text-5xl md:text-6xl text-text">
            TrustGate Roadmap
          </h1>
          <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-text-secondary leading-relaxed">
            Building the trust layer for Web3. One oracle. Every chain. Every
            use case.
          </p>
        </div>
      </section>

      {/* WHERE WE ARE */}
      <section className="px-4 sm:px-6 lg:px-8 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="card-static p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <SectionEyebrow>Where We Are</SectionEyebrow>
              <p className="text-lg sm:text-xl font-display font-bold text-text">
                Live on Arc Testnet
              </p>
            </div>
            <Badge variant="success">
              <span className="relative inline-flex h-2 w-2 mr-0.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-tier-high opacity-75 animate-pulse" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-tier-high" />
              </span>
              Operational
            </Badge>
          </div>
        </div>
      </section>

      {/* COMPLETED */}
      <section className="px-4 sm:px-6 lg:px-8 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-baseline gap-3">
            <SectionEyebrow>Completed</SectionEyebrow>
            <span className="text-[11px] font-mono text-text-muted">
              {COMPLETED_PHASES.length} shipped
            </span>
          </div>
          <div className="grid gap-5">
            {COMPLETED_PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} status="completed" />
            ))}
          </div>
        </div>
      </section>

      {/* IN PROGRESS */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-baseline gap-3">
            <SectionEyebrow>In Progress</SectionEyebrow>
            <span className="text-[11px] font-mono text-text-muted">
              {IN_PROGRESS_PHASES.length} active
            </span>
          </div>
          <div className="grid gap-5">
            {IN_PROGRESS_PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} status="in-progress" />
            ))}
          </div>
        </div>
      </section>

      {/* UPCOMING */}
      <section className="px-4 sm:px-6 lg:px-8 py-12 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-baseline gap-3">
            <SectionEyebrow>Upcoming</SectionEyebrow>
            <span className="text-[11px] font-mono text-text-muted">
              {UPCOMING_PHASES.length} planned
            </span>
          </div>
          <div className="grid gap-5">
            {UPCOMING_PHASES.map((phase) => (
              <PhaseCard key={phase.id} phase={phase} status="upcoming" />
            ))}
          </div>
        </div>
      </section>

      {/* HOW TRUSTGATE WORKS */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionEyebrow>How TrustGate Works</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text">
              Four reinforcing layers that compound over time
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {LAYERS.map((layer) => (
              <LayerBlock key={layer.number} layer={layer} />
            ))}
          </div>

          <p className="mt-10 max-w-3xl mx-auto text-center text-sm text-text-secondary leading-relaxed">
            Together these four layers create persistence, accountability,
            context, and resistance to shallow manipulation that no
            point-in-time scanner can replicate.
          </p>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="card-static p-8 sm:p-10 border-l-4 border-l-accent">
            <div className="flex items-center gap-3 mb-4">
              <div className="inline-flex p-2.5 rounded-lg bg-accent-muted border border-accent/10">
                <Eye size={18} className="text-accent" />
              </div>
              <SectionEyebrow>Privacy</SectionEyebrow>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-text mb-4">
              TrustGate analyzes behavioral reputation, not identity.
            </h2>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">
              TrustGate makes no claim about who owns a wallet. It makes claims
              about what that wallet has done onchain. No KYC. No biometric
              identity. No social graph deanonymization. No human identity
              claims. Behavioral patterns only.
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">
              This distinction matters legally and philosophically. Behavioral
              reputation infrastructure is a fundamentally different category
              from identity systems -- with fundamentally different implications
              for regulatory scrutiny and institutional adoption.
            </p>
          </div>
        </div>
      </section>

      {/* INTEGRATE */}
      <section className="px-4 sm:px-6 lg:px-8 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <SectionEyebrow>Integrate TrustGate</SectionEyebrow>
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-text">
              One oracle. Four entry points.
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {INTEGRATIONS.map((item) => (
              <IntegrationBlock key={item.product} item={item} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/docs/developer"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold",
                "bg-accent text-white hover:bg-accent-hover active:scale-[0.98]",
                "transition-all duration-200"
              )}
            >
              <Layers size={14} />
              Full developer documentation
              <ArrowRight size={14} />
            </Link>
            <p className="mt-4 text-[11px] font-mono text-text-muted">
              trustgated.xyz/docs/developer
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
