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
      title="How Trust Scoring Works"
      lede="TrustGate runs two separate scoring systems — one for wallets, one for tokens and contracts. Both return a score from 0 to 100 and map to the same five tiers. Neither uses personal data, off-chain signals, or manual review. Everything comes from onchain activity on Arc."
    >
      <h2>The five tiers</h2>

      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-left font-medium">Score</th>
              <th className="px-3 py-2 text-left font-medium">Payment behavior</th>
            </tr>
          </thead>
          <tbody>
            <TierRow
              tier="HIGH ELITE"
              range="95 – 100"
              behavior="Instant settlement, marked verified"
              color="text-tier-high"
            />
            <TierRow
              tier="HIGH"
              range="70 – 94"
              behavior="Instant settlement"
              color="text-tier-high"
            />
            <TierRow
              tier="MEDIUM"
              range="40 – 69"
              behavior="Time-locked 24h"
              color="text-tier-medium"
            />
            <TierRow
              tier="LOW"
              range="1 – 39"
              behavior="Escrow until depositor approves"
              color="text-tier-low"
            />
            <TierRow
              tier="BLOCKED"
              range="0"
              behavior="Claim reverts"
              color="text-text-muted"
            />
          </tbody>
        </table>
      </div>

      <p>
        <strong>HIGH ELITE</strong> — Exceptional depth across every signal.
        The rarest tier. Instant settlement. Marked as verified in the
        TrustGate system.
      </p>
      <p>
        <strong>HIGH</strong> — Strong consistent onchain history.
        Established wallets and tokens with real engagement. Instant
        settlement.
      </p>
      <p>
        <strong>MEDIUM</strong> — Active but still building history. Real
        activity exists but not yet the depth that HIGH shows. Payments
        time-locked 24 hours. Not a penalty — a checkpoint while trust
        develops.
      </p>
      <p>
        <strong>LOW</strong> — New or sparse activity. Some history exists
        but not enough to establish a reliable pattern. Funds held in
        escrow until depositor approves.
      </p>
      <p>
        <strong>BLOCKED</strong> — Zero transaction history. No activity
        means no score. Claims revert automatically. Not permanent — start
        transacting on Arc and the score will reflect that.
      </p>

      <h2>Wallet scoring</h2>
      <p>What we look at:</p>
      <ul>
        <li>
          <strong>Transaction History</strong> — The most important signal.
          Volume and consistency of transactions on Arc over time. We look
          at how much activity happened — not what the transactions were.
        </li>
        <li>
          <strong>USDC Activity</strong> — Wallets holding and moving
          meaningful USDC demonstrate real economic participation in the
          network.
        </li>
        <li>
          <strong>Smart Contract Interactions</strong> — Active protocol
          users score higher than wallets that only do simple transfers.
          We look at whether the wallet has actually called contracts and
          used protocols.
        </li>
        <li>
          <strong>Contract Deployments</strong> — The strongest positive
          signal. A wallet that has deployed contracts on Arc has
          demonstrated a deeper level of commitment than one that has only
          transacted. Required to reach HIGH ELITE.
        </li>
        <li>
          <strong>Consistency</strong> — Steady activity over time scores
          higher than a single burst of transactions. Sustained engagement
          matters more than one-time activity.
        </li>
      </ul>

      <p>What flags a wallet:</p>
      <ul>
        <li>Never sent a transaction on Arc</li>
        <li>All activity happened in one short window with nothing since</li>
        <li>No interaction with any smart contract or protocol</li>
        <li>USDC balance has never moved</li>
        <li>Wallet exists only to hold funds, not participate</li>
      </ul>

      <h2>Token and contract scoring</h2>
      <p>
        When you query a token contract, TrustGate scores it across three
        signals:
      </p>
      <ul>
        <li>
          <strong>Purchase Ratio — 50% of the score.</strong> What
          percentage of holders actually bought the token versus received
          it via airdrop or direct transfer from the deployer. A token
          where 90% of holders were airdropped it scores significantly
          lower than one where 90% of holders purchased it on a DEX. This
          is the core signal — organic buying behavior is the strongest
          indicator of a legitimate token.
        </li>
        <li>
          <strong>Holder Trust — 30% of the score.</strong> The average
          TrustGate wallet score of holders who purchased the token.
          Credible, established wallets buying a token is a strong
          positive signal. Fresh wallets or BLOCKED addresses buying carry
          minimal weight.
        </li>
        <li>
          <strong>Deployer Credibility — 20% of the score.</strong> The
          TrustGate wallet score of the contract deployer. A HIGH or HIGH
          ELITE deployer signals an experienced builder. A BLOCKED or LOW
          deployer is a red flag regardless of holder behavior.
        </li>
      </ul>

      <p>What flags a token:</p>
      <ul>
        <li>
          80% or more of buyers purchased within the same 3-hour window —
          this signals coordinated buying, and those buyers are heavily
          discounted in the score
        </li>
        <li>
          Majority of holders received tokens via airdrop or deployer
          transfer rather than purchasing
        </li>
        <li>Deployer wallet has LOW or BLOCKED trust score</li>
        <li>Very few unique purchasers relative to total holders</li>
      </ul>

      <h2>What does NOT affect your score</h2>
      <ul>
        <li>Which wallet address you use</li>
        <li>Who you have transacted with</li>
        <li>The size of individual transactions</li>
        <li>Off-chain reputation or social signals</li>
        <li>Any manual input or review</li>
      </ul>
      <p>
        Scores are deterministic. The same wallet or token will always
        return the same score at the same point in time. No human touches
        it.
      </p>

      <h2>For developers integrating TrustGate</h2>
      <p>When a user asks why their score is what it is:</p>
      <ul>
        <li>
          <strong>BLOCKED</strong> — No transaction history on Arc yet.
        </li>
        <li>
          <strong>LOW</strong> — Some activity exists but not enough
          consistent history to establish trust.
        </li>
        <li>
          <strong>MEDIUM</strong> — Active but still building the depth of
          engagement that HIGH wallets show. For tokens — real buyers
          exist but holder quality or purchase ratio needs to strengthen.
        </li>
        <li>
          <strong>HIGH</strong> — Strong consistent onchain history.
        </li>
        <li>
          <strong>HIGH ELITE</strong> — Among the most established on the
          network.
        </li>
      </ul>
      <p>
        You do not need to expose internal mechanics to your users. The
        tier name and this plain-language description is enough for any
        integration.
      </p>

      <h2>Improving a score</h2>
      <p>Wallet scores:</p>
      <ul>
        <li>
          <strong>BLOCKED to LOW</strong> — start transacting on Arc.
        </li>
        <li>
          <strong>LOW to MEDIUM</strong> — build consistent activity over
          time.
        </li>
        <li>
          <strong>MEDIUM to HIGH</strong> — interact with protocols, not
          just transfers.
        </li>
        <li>
          <strong>HIGH to HIGH ELITE</strong> — deploy contracts and
          maintain sustained high-volume activity.
        </li>
      </ul>

      <p>Token scores improve as:</p>
      <ul>
        <li>
          More wallets purchase via DEX rather than receive via airdrop
        </li>
        <li>Purchasing holders build stronger onchain history</li>
        <li>Time passes and the holder base diversifies</li>
      </ul>
      <p>
        There is no shortcut. The score reflects what actually happened
        onchain.
      </p>
    </DocShell>
  );
}
