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
      title="The Scoring Formula"
      lede="A deterministic 0 – 100 integer derived entirely from Arc onchain activity. No oracle, no manual input, no trust assumptions outside what the chain already records."
    >
      <h2>What goes in</h2>
      <p>
        The score is computed from four onchain signals about a wallet:
      </p>
      <ul>
        <li>
          <strong>Transaction count</strong> — how often the wallet has
          transacted on Arc. Raises a floor on activity.
        </li>
        <li>
          <strong>USDC balance</strong> — the wallet&apos;s current ERC-20
          balance of USDC at <code>0x3600…0000</code>.
        </li>
        <li>
          <strong>Contract interactions</strong> — number of outbound
          transactions whose <code>to</code> address is a contract. Filters
          passive-receive wallets.
        </li>
        <li>
          <strong>Contract deployments</strong> — number of contract creations
          originated from the wallet. Indicates a builder profile.
        </li>
      </ul>

      <h2>Transaction count points</h2>
      <p>
        The transaction count maps to a base score band:
      </p>

      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tx count</th>
              <th className="px-3 py-2 text-left font-medium">Points</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow cells={["0", "0", "BLOCKED — wallet rejected outright"]} bold />
            <ScoreRow cells={["1 – 10", "20", "Newly active"]} />
            <ScoreRow cells={["11 – 30", "40", "Light usage"]} />
            <ScoreRow cells={["31 – 60", "60", "Regular usage"]} />
            <ScoreRow cells={["61 – 100", "75", "High usage"]} />
            <ScoreRow cells={["100+", "85", "Power user"]} />
          </tbody>
        </table>
      </div>

      <h2>Bonus points</h2>
      <p>
        Bonuses stack on top of the base transaction score, subject to the
        cap rules below:
      </p>

      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Signal</th>
              <th className="px-3 py-2 text-left font-medium">Threshold</th>
              <th className="px-3 py-2 text-left font-medium">Bonus</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow cells={["USDC balance", "> 100 USDC", "+5"]} />
            <ScoreRow cells={["Contract calls", "3 – 9", "+5"]} />
            <ScoreRow cells={["Contract calls", "10 – 99", "+7"]} />
            <ScoreRow cells={["Contract calls", "100+", "+15"]} />
            <ScoreRow cells={["Deployments", "1+ contracts", "+10"]} />
          </tbody>
        </table>
      </div>

      <p>
        Contract interactions below 3 contribute zero — sporadic contract
        contact does not establish a usage pattern.
      </p>

      <h2>Cap and ceiling rules</h2>
      <ul>
        <li>
          <strong>Hard cap at 97</strong> for any wallet with fewer than 100
          contract interactions. The top three points are reserved.
        </li>
        <li>
          <strong>Score 98 – 100</strong> requires at least 100 contract
          interactions. This is the only path to HIGH ELITE.
        </li>
        <li>
          <strong>Maximum score is 100</strong>, no exceptions.
        </li>
        <li>
          <strong>Zero transactions returns 0</strong> regardless of any
          other signal — a wallet must have transacted at least once to be
          scored.
        </li>
      </ul>

      <h2>Tier mapping</h2>
      <p>
        The integer score classifies into one of five tiers, and the tier
        determines how TrustGate routes payment:
      </p>

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
            <TierRow tier="BLOCKED" range="0" behavior="Claim reverts" color="text-text-muted" />
            <TierRow tier="LOW" range="1 – 39" behavior="Escrowed — depositor approval required" color="text-tier-low" />
            <TierRow tier="MEDIUM" range="40 – 74" behavior="Time-locked 24h, depositor can cancel" color="text-tier-medium" />
            <TierRow tier="HIGH" range="75 – 97" behavior="Instant settlement" color="text-tier-high" />
            <TierRow tier="HIGH_ELITE" range="98 – 100" behavior="Instant settlement, marked verified" color="text-tier-high" />
          </tbody>
        </table>
      </div>

      <h2>Worked example</h2>
      <p>
        A wallet with 29 transactions, 13.88 USDC balance, 13 contract
        interactions, and 16 deployments scores:
      </p>
      <pre><code>{`Transactions (11–30 band) :  +40
USDC balance (< 100)      :   0
Contract calls (10–99)    :  +7
Deployments (1+)          : +10
─────────────────────────────────
Total                     :  57   →  MEDIUM tier  →  24h time-lock`}</code></pre>

      <h2>Where the formula lives</h2>
      <p>
        Scoring runs in a Next.js API route at{" "}
        <code>/api/arc-score/[address]</code>. The route queries Arc RPC for
        the transaction count and USDC balance, paginates Arcscan for
        contract interactions and deployments, and applies the formula above
        before returning the result. The dashboard&apos;s{" "}
        <Link href="/docs/dashboard-guide">Calculate Score</Link> button is
        thin frontend over this route — it writes the result onchain through{" "}
        <code>TrustScoring.setTrustScore()</code>.
      </p>

      <h2>Onchain enforcement</h2>
      <p>
        Once a score is written, it lives on{" "}
        <code>TrustScoringPlaintext</code> as a <code>uint64</code>.{" "}
        <code>TrustGate</code> consults the contract — never the API — when
        routing a claim. The API is a convenience for computing scores; the
        contract is the source of truth for routing.
      </p>
    </DocShell>
  );
}
