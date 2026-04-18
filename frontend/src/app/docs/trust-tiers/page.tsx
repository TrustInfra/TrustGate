import DocShell from "@/components/docs/DocShell";
import TrustTierBadge from "@/components/ui/TrustTierBadge";

export const metadata = { title: "Trust Tiers — TrustGate Docs" };

function TierCard({
  tier,
  range,
  routing,
  delay,
  cap,
  notes,
}: {
  tier: 0 | 1 | 2;
  range: string;
  routing: string;
  delay: string;
  cap: string;
  notes: string;
}) {
  return (
    <div className="card-static p-5 mb-3 border-l-4 border-l-border">
      <div className="flex items-center justify-between mb-3">
        <TrustTierBadge tier={tier} />
        <span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
          Score {range}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 text-xs mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Routing</p>
          <p className="text-text font-mono">{routing}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Delay</p>
          <p className="text-text font-mono">{delay}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Demo cap</p>
          <p className="text-text font-mono">{cap}</p>
        </div>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{notes}</p>
    </div>
  );
}

export default function TrustTiers() {
  return (
    <DocShell
      eyebrow="Trust Tiers"
      title="HIGH / MEDIUM / LOW"
      lede="Trust scores are a 0-100 integer on chain. The tier mapping is fixed in the contract — the score determines the tier, the tier determines how a claim routes."
    >
      <h2>Tier mapping</h2>
      <p>
        Classification happens in <code>TrustScoring.getTier(agent)</code>.
        The thresholds are hard-coded and cannot be changed without a contract
        redeploy — this is deliberate, so depositors can rely on the semantic
        meaning of a tier across time.
      </p>

      <TierCard
        tier={2}
        range="75 – 100"
        routing="Instant transfer"
        delay="None"
        cap="$1,000 / tx"
        notes="Immediate USDC transfer on claim. Reserved for agents with established track records."
      />

      <TierCard
        tier={1}
        range="40 – 74"
        routing="24-hour time-lock"
        delay="86,400 s"
        cap="$100 / tx"
        notes="Claim recorded with releaseTime = now + 24h. Depositor can cancel before release. Agent claims via release(claimId) after the window."
      />

      <TierCard
        tier={0}
        range="0 – 39"
        routing="Escrow"
        delay="Awaits approval"
        cap="$10 / tx"
        notes="Funds held until the depositor explicitly calls approveEscrow(claimId). Default for newly registered agents. Cancellation is always available."
      />

      <h2>Scoring inputs</h2>
      <p>
        The reference scoring oracle combines three signals before writing a
        score on chain: direct depositor attestations (explicit rate-ups and
        rate-downs), derived activity signals (successful vs cancelled claims),
        and external reputation sources where available. The algorithm itself
        is off-chain in this build — only the final integer score is posted.
      </p>

      <h2>FHE variant</h2>
      <p>
        On Zama-compatible chains, <code>TrustScoring.sol</code> stores scores
        as <code>euint8</code> and exposes tier lookups through encrypted
        comparisons. Arc Testnet lacks the Zama coprocessor, so deployment on
        Arc uses <code>TrustScoringPlaintext.sol</code> — same interface,
        plaintext storage.
      </p>
    </DocShell>
  );
}
