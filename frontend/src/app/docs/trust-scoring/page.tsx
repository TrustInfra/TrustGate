import Link from "next/link";
import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Trust Scoring — TrustGate Docs" };

function ScoreRow({
  cells,
  bold,
}: {
  cells: string[];
  bold?: boolean;
}) {
  return (
    <tr className="border-t border-border">
      {cells.map((c, i) => (
        <td
          key={i}
          className={`px-3 py-2 text-[12px] font-mono ${
            bold ? "text-text font-semibold" : "text-text-secondary"
          }`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}

function TierRow({
  tier,
  range,
  behavior,
  color,
}: {
  tier: string;
  range: string;
  behavior: string;
  color: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">
        <span className={`font-mono text-[12px] font-semibold ${color}`}>
          {tier}
        </span>
      </td>
      <td className="px-3 py-2.5 text-[12px] font-mono text-text">
        {range}
      </td>
      <td className="px-3 py-2.5 text-[12px] text-text-secondary">
        {behavior}
      </td>
    </tr>
  );
}

export default function TrustScoringPage() {
  return (
    <DocShell
      eyebrow="Trust Scoring"
      title="How TrustGate Scores Addresses"
      lede="TrustGate scores two address types: wallet addresses via the Oracle, and contract addresses via Token Shield. All scores are on a 0 to 100 scale. Exact formula weights are intentionally not published to prevent gaming."
    >
      <h2>Wallet Scoring (Oracle)</h2>
      <p>
        Used for any EOA (externally owned account) queried through the
        Oracle.
      </p>

      <h3>What Raises a Wallet Score</h3>
      <p>
        <strong>Contract Deployments.</strong> The single most important
        signal. Deploying contracts onchain separates builders from users.
        The significance of what you deployed matters — a protocol used by
        thousands of wallets carries far more weight than an empty or
        unknown contract. Long-term builders with multiple meaningful
        deployments score highest.
      </p>
      <p>
        <strong>Transaction History.</strong> Wallets with little or no
        onchain activity score lower. Sustained, long-term transaction
        history across multiple protocols is a strong positive signal.
      </p>
      <p>
        <strong>Wallet Age.</strong> Derived from the timestamp of the
        oldest outgoing transaction. Older wallets with consistent activity
        score higher. Very new wallets are capped regardless of other
        signals.
      </p>
      <p>
        <strong>Contract Interactions.</strong> Genuine participation
        across diverse protocols signals a real ecosystem participant, not
        a manufactured identity.
      </p>
      <p>
        <strong>USDC Balance.</strong> Demonstrated financial presence on
        Arc contributes positively.
      </p>
      <p>
        <strong>Activity Spread.</strong> Consistent activity spread across
        many months signals long-term presence, not a burst campaign
        designed to inflate scores quickly.
      </p>

      <h3>Tier Bands</h3>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">
                Who This Is
              </th>
            </tr>
          </thead>
          <tbody>
            <TierRow
              tier="LOW"
              range="0 to 39"
              behavior="New, inactive, or flagged wallet"
              color="text-tier-low"
            />
            <TierRow
              tier="MEDIUM"
              range="40 to 59"
              behavior="Active user with limited builder history, or any bot flag present"
              color="text-tier-medium"
            />
            <TierRow
              tier="HIGH"
              range="60 to 79"
              behavior="Active developer or sustained long-term participant"
              color="text-tier-high"
            />
            <TierRow
              tier="HIGH_ELITE"
              range="80 to 100"
              behavior="Serious long-term builders only"
              color="text-tier-high"
            />
          </tbody>
        </table>
      </div>

      <p>
        <strong>HIGH_ELITE</strong> reflects sustained long-term builder
        behavior across multiple dimensions. Missing any critical condition
        hard-caps the score below this tier.
      </p>
      <p>
        <strong>A perfect score</strong> reflects exceptional long-term
        ecosystem participation across every signal category
        simultaneously.
      </p>

      <h3>Payment Routing</h3>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">
                Score Range
              </th>
              <th className="px-3 py-2 text-left font-medium">
                Recommendation
              </th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow cells={["0", "BLOCKED"]} bold />
            <ScoreRow cells={["Low range", "TIME_LOCKED"]} />
            <ScoreRow cells={["Mid range", "INSTANT"]} />
            <ScoreRow cells={["High range", "INSTANT_PRIORITY"]} />
          </tbody>
        </table>
      </div>

      <h3>Bot Detection</h3>
      <p>
        TrustGate detects velocity anomalies, timer-based automation,
        self-interaction loops, coordinated activity, and synthetic
        transaction histories. Any single detected signal hard-caps the
        wallet at MEDIUM tier regardless of all other signals. There are
        no exceptions.
      </p>

      <h2>Contract Scoring (Token Shield)</h2>
      <p>
        Token Shield auto-detects the contract type and applies the
        correct scoring model.
      </p>
      <ul>
        <li>ERC-20 address → ERC-20 Token Scoring</li>
        <li>
          Non-ERC-20 contract → Contract Scoring (free, no payment
          required)
        </li>
        <li>Not a contract → error directing to Oracle page</li>
      </ul>

      <h3>ERC-20 Token Scoring</h3>
      <p>
        <strong>Holder Quality Weighting.</strong> Only wallets that
        purchased the token count. Airdrop recipients are ignored
        completely. This removes the fake holder count attack vector
        entirely — rug pulls cannot boost scores by airdropping to
        thousands of fresh wallets.
      </p>
      <p>
        Holder weight is based on the buyer&apos;s wallet trust tier.
        High-trust buyers contribute meaningfully. Low-trust buyers
        contribute very little. Airdrop recipients contribute nothing.
      </p>
      <p>
        <strong>Deployer Credibility.</strong> The deployer wallet is
        scored through the wallet oracle. Their trust tier is applied as a
        significance multiplier on the token score. Trust propagates from
        builder to product.
      </p>
      <p>
        <strong>Score Updates.</strong> New tokens update more frequently.
        Established tokens update less frequently — changes carry more
        significance. A rising score on a new token is a positive signal.
        A falling score on an established token is a warning.
      </p>

      <h3>Non-ERC-20 Contract Scoring</h3>
      <p>
        Scored across six dimensions: verification status, contract age,
        transaction volume, unique interactors, deployer trust, and Arc
        ecosystem recognition.
      </p>
      <p>
        <strong>Verification</strong> is weighted heavily. Unverified
        contracts are capped regardless of all other signals — publishing
        source code is a trust signal. Verified contracts can reach the
        highest tiers.
      </p>
      <p>
        <strong>Contract age</strong> matters. A contract running without
        incident for many months is more credible than one deployed last
        week.
      </p>
      <p>
        <strong>Unique interactors</strong> matter more than raw
        transaction count. Many different wallets interacting is
        fundamentally different from one wallet calling the contract many
        times. Diversity signals organic adoption.
      </p>
      <p>
        <strong>Deployer trust</strong> propagates directly to the
        contract score. A HIGH_ELITE deployer is a strong positive signal.
        A LOW deployer is a red flag regardless of what the contract does
        on the surface.
      </p>
      <p>
        <strong>Arc ecosystem recognition</strong> rewards contracts
        genuinely embedded in the Arc DeFi ecosystem.
      </p>

      <h3>Contract Flags</h3>
      <p>
        <strong>Interaction Velocity.</strong> Organic adoption is
        gradual. A contract receiving an unusually high number of
        transactions shortly after deployment signals coordinated or
        automated activity. Hard cap at MEDIUM tier.
      </p>
      <p>
        <strong>Unverified Hard Cap.</strong> Not a bot flag. A
        transparency cap. Unverified contracts can still score HIGH but
        can never reach HIGH_ELITE regardless of all other signals.
      </p>

      <h3>Tier Bands (Contract)</h3>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            <TierRow
              tier="LOW"
              range="0 to 39"
              behavior="Suspicious, very new, or low-activity"
              color="text-tier-low"
            />
            <TierRow
              tier="MEDIUM"
              range="40 to 59"
              behavior="Limited history or velocity-flagged"
              color="text-tier-medium"
            />
            <TierRow
              tier="HIGH"
              range="60 to 79"
              behavior="Active with real usage (unverified contracts cap here)"
              color="text-tier-high"
            />
            <TierRow
              tier="HIGH_ELITE"
              range="80 to 100"
              behavior="Verified, established, high-usage, trusted deployer, Arc-native"
              color="text-tier-high"
            />
          </tbody>
        </table>
      </div>

      <h2>Arcscan vs TrustGate</h2>
      <p>
        <strong>Arcscan provides raw data:</strong> deployer address,
        creation timestamp, verification status, transaction history,
        address counters, token type classification.
      </p>
      <p>
        <strong>TrustGate decides quality:</strong> whether activity
        patterns indicate bots, how deployer history translates to trust,
        whether timing signals manipulation, how interactor diversity
        signals credibility, whether Arc ecosystem connections add
        legitimacy, and the final score and tier.
      </p>
      <p>Arcscan shows you data. TrustGate tells you whether to trust it.</p>
    </DocShell>
  );
}
