import Link from "next/link";
import { ArrowRight, ShieldCheck, Coins, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface BentoCardProps {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  featured?: boolean;
}

function BentoCard({
  icon: Icon,
  title,
  body,
  href,
  linkLabel,
  featured = false,
}: BentoCardProps) {
  return (
    <div
      className={cn(
        "card-feature group flex flex-col p-6 lg:p-8 h-full",
        featured && "lg:p-10"
      )}
    >
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="inline-flex p-2.5 bg-accent-muted border border-accent/10">
          <Icon size={featured ? 26 : 20} className="text-accent" />
        </div>
        {featured && (
          <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-text-muted">
            Primary
          </span>
        )}
      </div>

      <h3
        className={cn(
          "font-display font-bold text-text mb-3",
          featured ? "text-xl lg:text-2xl" : "text-base"
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          "text-text-secondary leading-relaxed flex-1",
          featured ? "text-sm lg:text-base max-w-lg" : "text-sm"
        )}
      >
        {body}
      </p>

      <Link
        href={href}
        className="inline-flex items-center gap-2 mt-6 text-xs font-mono font-medium text-accent hover:text-accent-hover transition-colors"
      >
        {linkLabel}
        <ArrowRight
          size={12}
          className="transition-transform group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );
}

export default function FeatureBento() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-3">
      <div className="md:col-span-2 md:row-span-2">
        <BentoCard
          featured
          icon={ShieldCheck}
          title="Wallet Oracle"
          body="Query any Arc wallet and receive a trust score derived from real onchain history: deployments, transaction patterns, account age, and behavioral signals. No self-reported credentials."
          href="/oracle"
          linkLabel="Query a wallet"
        />
      </div>
      <BentoCard
        icon={Coins}
        title="Token Shield"
        body="Score tokens and contracts by deployer credibility and holder legitimacy before you interact."
        href="/token-shield"
        linkLabel="Check a token"
      />
      <BentoCard
        icon={Code2}
        title="DEX Widget"
        body="One script tag. Trust badges on every token input. Free on Arc testnet."
        href="/docs/widget-integration"
        linkLabel="View integration"
      />
    </div>
  );
}