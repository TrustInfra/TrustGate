import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import StatusDot from "@/components/ui/StatusDot";
import SectionHeader from "@/components/landing/SectionHeader";
import SwaparcSwapMock from "@/components/landing/SwaparcSwapMock";
import { SWAPARC_URL } from "@/lib/swaparc";

export const metadata: Metadata = {
  title: "Live on Swaparc -- TrustGate",
  description:
    "Confirm TrustGate token badges on Swaparc, the Arc testnet DEX. Circle issuers show VERIFIED. Other tokens show a score and tier in the search list.",
  alternates: { canonical: "/swaparc" },
  openGraph: {
    title: "Live on Swaparc -- TrustGate",
    description:
      "Open Swaparc, search a token, and read the TrustGate badge next to each result.",
    url: "https://www.trustgated.xyz/swaparc",
  },
};

const ISSUERS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0x3600000000000000000000000000000000000000",
    mark: "VERIFIED",
  },
  {
    symbol: "EURC",
    name: "Euro Coin",
    address: "0x89b50855aa3be2f677cd6303cec089b5f319d72a",
    mark: "VERIFIED",
  },
  {
    symbol: "CircBTC",
    name: "Circle Bitcoin",
    address: "0xf0c4a4ce82a5746abaad9425360ab04fbba432bf",
    mark: "VERIFIED",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Open Swaparc",
    body: "Go to swaparc.app. You do not need to swap. The badge is on the token picker.",
  },
  {
    n: "02",
    title: "Open the Buy list",
    body: "Click the token on the Buy side. The search list is where TrustGate marks each result.",
  },
  {
    n: "03",
    title: "Read the mark",
    body: "Circle issuers show VERIFIED with no number. Other tokens show a score and tier, for example 56 MEDIUM on SWPRC.",
  },
];

export default function SwaparcPage() {
  return (
    <div className="relative">
      <section className="px-4 sm:px-6 lg:px-8 pt-16 pb-12 lg:pt-24 lg:pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-2.5 mb-8">
            <StatusDot status="active" size="md" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
              Live integration
            </span>
            <span className="text-text-muted/40 font-mono text-[10px]">/</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
              Swaparc
            </span>
          </div>

          <h1 className="font-display font-extrabold text-3xl sm:text-5xl text-text tracking-tight leading-[1.08] max-w-3xl">
            Confirm TrustGate on a live Arc DEX
          </h1>
          <p className="mt-5 max-w-2xl text-sm sm:text-base text-text-secondary leading-relaxed">
            Swaparc is an Arc testnet DEX. Its token search already carries
            TrustGate marks. This page is the map. Swaparc is the proof.
            TrustGate supplies the signal. Swaparc owns the swap UI.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={SWAPARC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium",
                "border border-accent text-accent bg-transparent",
                "hover:bg-accent-muted transition-colors duration-200"
              )}
            >
              Open Swaparc
              <ExternalLink size={14} />
            </a>
            <Link
              href="/token-shield"
              className={cn(
                "inline-flex items-center gap-2 px-6 py-3 text-sm font-medium",
                "border border-border text-text-secondary bg-transparent",
                "hover:border-border-hover hover:bg-bg-raised transition-colors duration-200"
              )}
            >
              Check the same tokens here
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-20 lg:pb-28">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-16 items-start">
          <SwaparcSwapMock className="lg:sticky lg:top-24" />

          <div>
            <SectionHeader
              eyebrow="How to confirm"
              title="Three steps. No swap required."
              lede="You are checking the search layer, not executing a trade. Click Buy on the schematic to open and close the same list you will see on Swaparc."
              className="mb-8 lg:mb-10"
            />

            <ol className="space-y-5">
              {STEPS.map((step) => (
                <li key={step.n} className="flex gap-4">
                  <span className="font-mono text-[11px] text-accent pt-0.5">
                    {step.n}
                  </span>
                  <div>
                    <p className="font-display font-bold text-text">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-text-secondary leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-20 lg:py-28 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="How to read a mark"
            title="Two kinds of badge. Same engine."
            lede="The picker does not invent a second scoring system. It renders the Token Shield result for that contract."
          />

          <div className="grid md:grid-cols-2 gap-3">
            <article className="card-static p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent mb-3">
                Verified
              </p>
              <h3 className="font-display font-bold text-text mb-2">
                Circle issuer. No number.
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                USDC, EURC, USYC, and CircBTC are canonical issuer contracts on
                Arc. Bot and concentration heuristics do not apply. The badge
                is VERIFIED. The score field is empty on purpose.
              </p>
            </article>
            <article className="card-static p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-tier-medium mb-3">
                Scored
              </p>
              <h3 className="font-display font-bold text-text mb-2">
                Everything else. Score plus tier.
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                SWPRC is the example currently on Swaparc: 56 MEDIUM. LOW and
                BLOCKED stay visible. TrustGate does not hide a result. The
                DEX decides order and placement.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 py-20 lg:py-28 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <SectionHeader
            eyebrow="Cross-check"
            title="Score the issuers on Token Shield"
            lede="Same addresses. Same VERIFIED path. Use this if you want TrustGate's own card next to the DEX badge."
          />

          <ul className="grid sm:grid-cols-3 gap-3">
            {ISSUERS.map((t) => (
              <li key={t.symbol}>
                <Link
                  href={`/token-shield?address=${t.address}`}
                  className="card p-5 h-full flex flex-col hover:border-border-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-text">
                      {t.symbol}
                    </span>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-accent bg-accent-muted border border-accent/25 px-1.5 py-0.5">
                      {t.mark}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-muted">{t.name}</p>
                  <p className="mt-4 font-mono text-[10px] text-text-muted break-all">
                    {t.address}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-mono text-accent">
                    Open in Token Shield
                    <ArrowRight size={12} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-sm text-text-muted max-w-2xl leading-relaxed">
            TrustGate scores behaviour, not value or safety. A VERIFIED mark
            means the contract is a known Circle issuer. A numeric tier is a
            behavioral signal. Swaparc decides how to place that signal in its
            UI.
          </p>
        </div>
      </section>
    </div>
  );
}
