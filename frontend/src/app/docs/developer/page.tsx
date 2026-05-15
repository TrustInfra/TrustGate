import DocShell from "@/components/docs/DocShell";

export const metadata = { title: "Developer Documentation — TrustGate Docs" };

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
  cells,
  color,
}: {
  tier: string;
  cells: string[];
  color: string;
}) {
  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2.5">
        <span className={`font-mono text-[12px] font-semibold ${color}`}>
          {tier}
        </span>
      </td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`px-3 py-2.5 text-[12px] ${
            i === 0 ? "font-mono text-text" : "text-text-secondary"
          }`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}

export default function DeveloperPage() {
  return (
    <DocShell
      eyebrow="Developer"
      title="TrustGate Developer Documentation"
      lede="TrustGate is a behavioral trust oracle for wallets and contracts on Arc. Query any address and receive a trust score, tier, confidence level, and behavioral flags."
    >
      <pre><code>{`curl https://api.trustgated.xyz/oracle/wallet/0xYourAddressHere`}</code></pre>

      <h2>How It Works</h2>
      <pre><code>{`Wallet or Contract Address
           ↓
   TrustGate Oracle
           ↓
Score + Tier + Confidence + Flags + Summary
           ↓
DEX  /  Lending  /  DAO  /  Wallet UI  /  AI Agent`}</code></pre>

      <h2>1. Quick Start</h2>
      <p>Score a wallet:</p>
      <pre><code>{`curl -H "X-Payment: <x402_payment_header>" \\
  https://api.trustgated.xyz/oracle/wallet/0xYourAddress`}</code></pre>
      <p>Score a contract or token:</p>
      <pre><code>{`curl https://api.trustgated.xyz/oracle/token/0xContractAddress`}</code></pre>
      <p>
        Wallet queries cost 0.001 USDC via the x402 payment standard.
        Token Shield queries for non-ERC-20 contracts are free.
      </p>

      <h2>2. Core Concepts</h2>
      <p>
        <strong>Wallet Score</strong> — A 0 to 100 behavioral score
        derived from a wallet&apos;s full onchain history. Deployments,
        transaction history, contract interactions, wallet age, USDC
        activity, and behavioral anomaly detection.
      </p>
      <p>
        <strong>Contract Score</strong> — A 0 to 100 score for smart
        contracts. Auto-detects ERC-20 or non-ERC-20 and applies the
        correct scoring model.
      </p>
      <p>
        <strong>Token Shield</strong> — The contract scoring engine.
        Scores ERC-20 tokens by holder quality and deployer credibility.
        Scores non-ERC-20 contracts by verification status, age, usage,
        unique interactors, deployer trust, and Arc ecosystem
        recognition.
      </p>
      <p>
        <strong>Confidence</strong> — A percentage indicating how much
        historical data backs the score. A wallet with years of activity
        and thousands of transactions has high confidence. A wallet with
        minimal history has low confidence. Same tier, very different
        reliability. Protocols can set minimum confidence thresholds for
        high-stakes decisions.
      </p>
      <p>
        <strong>Flags</strong> — Behavioral anomaly signals attached to a
        score. Each flag describes a detected pattern and carries a
        recommended protocol response.
      </p>
      <p>
        <strong>Recommendation</strong> — An operational routing hint
        returned with every score: BLOCKED, TIME_LOCKED, INSTANT, or
        INSTANT_PRIORITY.
      </p>

      <h2>3. API Reference</h2>

      <h3>GET /oracle/wallet/:address</h3>
      <p>Request:</p>
      <pre><code>{`curl -H "X-Payment: <x402_payment_header>" \\
  https://api.trustgated.xyz/oracle/wallet/0xYourAddress`}</code></pre>
      <p>Response:</p>
      <pre><code>{`{
  "score": 82,
  "tier": "HIGH_ELITE",
  "confidence": 94,
  "recommendation": "INSTANT_PRIORITY",
  "flags": [],
  "summary": [
    "Consistent activity across 11 months",
    "12 verified contract deployments",
    "No coordinated behavior detected"
  ]
}`}</code></pre>

      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Field</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">
                Description
              </th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow
              cells={["score", "integer 0 to 100", "Raw behavioral trust score"]}
              bold
            />
            <ScoreRow
              cells={["tier", "string", "BLOCKED / LOW / MEDIUM / HIGH / HIGH_ELITE"]}
            />
            <ScoreRow
              cells={["confidence", "integer 0 to 100", "Data density behind the score"]}
            />
            <ScoreRow
              cells={["recommendation", "string", "BLOCKED / TIME_LOCKED / INSTANT / INSTANT_PRIORITY"]}
            />
            <ScoreRow
              cells={["flags", "array", "Active behavioral flags, empty array if none"]}
            />
            <ScoreRow
              cells={["summary", "array", "Human-readable behavioral observations"]}
            />
          </tbody>
        </table>
      </div>

      <h3>GET /oracle/token/:address</h3>
      <p>ERC-20 Response:</p>
      <pre><code>{`{
  "type": "ERC-20 TOKEN SCORE",
  "score": 71,
  "tier": "HIGH",
  "confidence": 88,
  "flags": ["COORDINATED_BUY"],
  "summary": [
    "Holder quality weighted: 340 qualified buyers",
    "Deployer tier: HIGH",
    "Coordinated buying pattern detected in first 3 hours"
  ]
}`}</code></pre>
      <p>Non-ERC-20 Response:</p>
      <pre><code>{`{
  "type": "CONTRACT SCORE",
  "score": 85,
  "tier": "HIGH_ELITE",
  "confidence": 91,
  "flags": [],
  "summary": [
    "Source code verified on Arcscan",
    "Contract age: 214 days",
    "Deployer tier: HIGH_ELITE",
    "Arc ecosystem interaction confirmed"
  ]
}`}</code></pre>
      <p>Error responses:</p>
      <pre><code>{`{ "error": "Address is not a contract. Use the Oracle page for wallet scoring." }`}</code></pre>
      <pre><code>{`{
  "error": "Payment required",
  "paymentDetails": { "amount": "0.001", "currency": "USDC", "standard": "x402" }
}`}</code></pre>

      <h2>4. Tier Meaning</h2>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">Tier</th>
              <th className="px-3 py-2 text-left font-medium">
                Score Range
              </th>
              <th className="px-3 py-2 text-left font-medium">Meaning</th>
              <th className="px-3 py-2 text-left font-medium">
                Suggested Action
              </th>
            </tr>
          </thead>
          <tbody>
            <TierRow
              tier="BLOCKED"
              cells={["0", "Zero onchain activity", "Reject entirely"]}
              color="text-text-muted"
            />
            <TierRow
              tier="LOW"
              cells={["1 to 39", "New, inactive, or flagged", "Escrow or reject"]}
              color="text-tier-low"
            />
            <TierRow
              tier="MEDIUM"
              cells={["40 to 59", "Active but limited trust history", "Time-lock payments"]}
              color="text-tier-medium"
            />
            <TierRow
              tier="HIGH"
              cells={["60 to 79", "Trusted participant", "Allow with standard terms"]}
              color="text-tier-high"
            />
            <TierRow
              tier="HIGH_ELITE"
              cells={["80 to 100", "Proven long-term builder", "Priority access"]}
              color="text-tier-high"
            />
          </tbody>
        </table>
      </div>
      <p>Key caps to know:</p>
      <ul>
        <li>
          Any behavioral anomaly flag present: score cannot exceed MEDIUM
          tier
        </li>
        <li>Limited deployment history: score cannot exceed HIGH tier</li>
        <li>Unverified contract: score cannot exceed HIGH tier</li>
      </ul>

      <h2>5. Flag Reference</h2>

      <h3>Wallet Flags</h3>
      <p>
        <strong>VELOCITY.</strong> Detected when a wallet exhibits
        abnormally high transaction activity within a short time window.
        Catches automated scripts and bot warm-up behavior. Suggested
        response: time-lock payments, increase collateral requirements.
      </p>
      <p>
        <strong>INTERVAL_PATTERN.</strong> Detected when a wallet&apos;s
        transaction timing follows a suspiciously consistent mechanical
        cadence inconsistent with human behavior. Catches bots operating
        on fixed timers. Suggested response: same as VELOCITY.
      </p>
      <p>
        <strong>SELF_INTERACTION.</strong> Detected when multiple
        transfers have matching sender and receiver addresses. Catches
        artificial activity inflation and wash loop manufacturing.
        Suggested response: reject for lending, time-lock for payments.
      </p>
      <p>
        <strong>CLEAN_HISTORY_MANIPULATION.</strong> Detected when a
        fresh wallet has a volume of perfect contract interactions
        inconsistent with organic onchain behavior. Legitimate wallets
        almost always have some failed transactions. Wallets with
        sufficient age are completely immune to this flag. Suggested
        response: time-lock, require additional observation period.
      </p>
      <p>
        <strong>COORDINATED_BUYING.</strong> Detected when multiple
        wallets funded from the same source interact with the same
        contracts in the same time window. Catches Sybil clusters,
        airdrop farming rings, and coordinated attacks. Suggested
        response: flag for governance review, reject for high-value
        lending.
      </p>

      <h3>Token and Contract Flags</h3>
      <p>
        <strong>HONEYPOT_PATTERN.</strong> Detected when sell volume is
        near zero relative to buy volume after the initial distribution
        period. Buyers cannot exit. Suggested response: surface warning
        to users, block trust badge from showing positive tier.
      </p>
      <p>
        <strong>COORDINATED_BUY.</strong> Detected when a large share of
        token buyers are active within the same short window. Suggested
        response: discount holder quality signal, surface warning badge.
      </p>
      <p>
        <strong>EXIT_SYNC.</strong> Detected when multiple credible
        wallets exit significant positions within the same rolling
        window, regardless of how long they held. A group of wallets
        holding for months then selling within the same short window is
        a coordinated exit, not coincidence. All participating wallets
        receive a persistent mark that affects future scoring. Suggested
        response: increase collateral ratio, monitor governance
        participation, lower leverage limits.
      </p>
      <p>
        <strong>LOW_HOLDER_QUALITY.</strong> Detected when the majority
        of token holders are LOW or BLOCKED tier wallets. Suggested
        response: surface risk warning, reduce trust weighting for token.
      </p>
      <p>
        <strong>WASH_TRADE.</strong> Detected when wallets repeatedly buy
        and sell the same token within short windows with circular
        address patterns. Suggested response: flag token, discount volume
        signals entirely.
      </p>
      <p>
        <strong>INTERACTION_VELOCITY</strong> (contract). Detected when a
        contract receives an unusually high number of transactions
        shortly after deployment. Organic adoption is gradual. Suggested
        response: treat as MEDIUM regardless of other signals until the
        flag clears.
      </p>

      <h2>6. Integration Examples</h2>

      <h3>React</h3>
      <pre><code>{`import { useEffect, useState } from "react";

export function TrustBadge({ address }) {
  const [trust, setTrust] = useState(null);

  useEffect(() => {
    fetch(\`https://api.trustgated.xyz/oracle/wallet/\${address}\`)
      .then(res => res.json())
      .then(data => setTrust(data));
  }, [address]);

  if (!trust) return <span>Checking trust...</span>;

  return (
    <div className={\`trust-badge tier-\${trust.tier.toLowerCase()}\`}>
      <span>{trust.tier}</span>
      <span>{trust.score}/100</span>
      {trust.flags.length > 0 && <span>⚠ {trust.flags.join(", ")}</span>}
    </div>
  );
}`}</code></pre>

      <h3>Node.js</h3>
      <pre><code>{`const axios = require("axios");

async function checkWalletTrust(address) {
  const res = await axios.get(
    \`https://api.trustgated.xyz/oracle/wallet/\${address}\`,
    { headers: { "X-Payment": process.env.X402_PAYMENT_HEADER } }
  );
  const { score, tier, recommendation, flags } = res.data;
  if (recommendation === "BLOCKED") throw new Error("Wallet blocked");
  if (flags.includes("COORDINATED_BUYING")) throw new Error("Coordinated behavior detected");
  return { score, tier, recommendation };
}`}</code></pre>

      <h3>Solidity</h3>
      <pre><code>{`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITrustGate {
    function getScore(address wallet) external view returns (uint8 score, string memory tier);
}

contract TrustGatedLending {
    ITrustGate public trustGate;
    uint8 public constant MIN_SCORE = 60;

    constructor(address _trustGate) {
        trustGate = ITrustGate(_trustGate);
    }

    modifier onlyTrusted(address wallet) {
        (uint8 score, ) = trustGate.getScore(wallet);
        require(score >= MIN_SCORE, "Trust score too low");
        _;
    }

    function borrow(uint256 amount) external onlyTrusted(msg.sender) {
        // lending logic
    }
}`}</code></pre>

      <h3>Python</h3>
      <pre><code>{`import requests

def get_trust_score(address: str) -> dict:
    url = f"https://api.trustgated.xyz/oracle/wallet/{address}"
    headers = {"X-Payment": "YOUR_X402_PAYMENT_HEADER"}
    response = requests.get(url, headers=headers)
    response.raise_for_status()
    data = response.json()
    return {
        "score": data["score"],
        "tier": data["tier"],
        "confidence": data["confidence"],
        "recommendation": data["recommendation"],
        "flags": data["flags"]
    }`}</code></pre>

      <h2>7. Use Cases</h2>
      <p>
        <strong>Lending Protocol.</strong> Gate borrowing positions
        behind trust scoring. Require HIGH tier for standard loans,
        HIGH_ELITE for uncollateralized credit lines. Escrow or reject
        LOW and BLOCKED wallets automatically.
      </p>
      <p>
        <strong>DEX Token Discovery.</strong> Rank token search results
        by trust score when multiple tokens share the same name or
        ticker. The token with the most credible deployer, legitimate
        holder base, and cleanest behavioral record surfaces first.
      </p>
      <p>
        <strong>Governance Defense.</strong> Monitor proposals for
        coordinated voting patterns. Alert when low-trust wallets vote
        the same direction in a short window on a treasury proposal.
        Alert fires before the vote closes.
      </p>
      <p>
        <strong>Wallet Warning System.</strong> Surface trust tier and
        active flags at the point of send before a user signs a
        transaction. A BLOCKED or LOW destination gets a warning. No
        code changes needed on the destination contract.
      </p>
      <p>
        <strong>AI Agent Payments.</strong> Gate agent-to-agent USDC
        payments behind trust scoring. HIGH_ELITE agents receive instant
        settlement. LOW agents route through escrow with configurable
        release conditions.
      </p>
      <p>
        <strong>Stablecoin Risk Management.</strong> Check trust tier of
        wallets interacting with stablecoin pools. Use confidence scores
        to weight risk decisions — the same tier at low confidence is
        treated differently than the same tier at high confidence.
      </p>

      <h2>8. Pricing and Limits</h2>
      <div className="not-prose my-4 overflow-x-auto rounded-lg border border-border bg-bg-surface">
        <table className="w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-text-muted">
              <th className="px-3 py-2 text-left font-medium">
                Query Type
              </th>
              <th className="px-3 py-2 text-left font-medium">Cost</th>
              <th className="px-3 py-2 text-left font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            <ScoreRow
              cells={["Wallet Oracle", "0.001 USDC", "Paid via x402 standard"]}
              bold
            />
            <ScoreRow
              cells={["ERC-20 Token Shield", "0.001 USDC", "Forwarded to scoring oracle"]}
            />
            <ScoreRow
              cells={["Non-ERC-20 Contract Score", "Free", "Local formula, no payment"]}
            />
            <ScoreRow
              cells={["Batch queries", "Coming soon", "Up to 50 addresses per call"]}
            />
          </tbody>
        </table>
      </div>
      <p>Rate limits: 60 requests per minute per API key.</p>
      <p>
        Payment standard: Circle x402 Nanopayment on Arc. Every paid
        query includes an X-Payment header with the USDC transaction
        reference. No subscription required for per-query access.
      </p>

      <h2>9. Security and Philosophy</h2>
      <blockquote>
        <p>TrustGate analyzes behavioral reputation, not identity.</p>
      </blockquote>
      <p>
        TrustGate makes no claim about who owns a wallet. It makes
        claims about what that wallet has done onchain.
      </p>
      <ul>
        <li>No KYC data collected or required</li>
        <li>No biometric or social identity linked</li>
        <li>No human identity claims made</li>
        <li>No social graph deanonymization</li>
        <li>
          Behavioral patterns only — what was done, when, and with whom
          onchain
        </li>
      </ul>
      <p>
        This positioning matters for institutional integration, governed
        protocol deployment, and regulated environments. Behavioral
        reputation infrastructure is a fundamentally different category
        from identity systems.
      </p>
      <p>
        TrustGate scores reflect immutable onchain history.
        Rehabilitation mechanics are handled through longitudinal
        behavioral recovery rather than manual appeals.
      </p>
      <p>
        Score hardening: exact formula weights, thresholds, and scoring
        mechanics are not published. Public responses return tier,
        score, confidence, flags, and summary only. This prevents
        adversaries from reverse-engineering an optimization path.
        Developers integrating TrustGate consume the signal — they do
        not need to reproduce the calculation.
      </p>

      <h2>10. Roadmap</h2>
      <ul>
        <li>
          Token Behavior Intelligence — hold duration tracking, exit
          ratio analysis, wash trading detection, honeypot flagging,
          wallet score feedback loop
        </li>
        <li>
          Staking Intelligence — staking history as a trust signal
          dimension
        </li>
        <li>
          DAO Risk Alerts — subscription alerts for lending protocols and
          DAOs
        </li>
        <li>
          Send Address Shield — trust scoring at point of send in wallet
          UIs (Rabby, MetaMask Snaps)
        </li>
        <li>
          Multichain Expansion — Arc, Ethereum, Base, Arbitrum with
          cross-chain composite scoring
        </li>
        <li>
          Trust Graph — EigenTrust-style network analysis, Sybil
          resistance, coordinated cluster detection
        </li>
      </ul>
    </DocShell>
  );
}
