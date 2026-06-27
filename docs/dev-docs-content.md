# TrustGate — Claude Code Prompts
# Both prompts have exact thresholds removed from public-facing content.
# Internal scoring reference doc remains unchanged (for investors/partners only).

---

## PROMPT 1 — Normal Docs (trust-scoring page)

```
Read CLAUDE.md before doing anything.

Update the trust scoring documentation page at app/docs/trust-scoring/page.tsx
(check the existing file structure first and find the correct path).

Keep all existing page layout, navbar, sidebar, and styling.
Replace written content only.

---

PAGE CONTENT:

# How TrustGate Scores Addresses

TrustGate scores two address types: wallet addresses via the Oracle, and contract addresses via Token Shield. All scores are on a 0 to 100 scale. Exact formula weights are intentionally not published to prevent gaming.

---

## Wallet Scoring

Used for any EOA (externally owned account) queried through the Oracle.

### What Raises a Wallet Score

**Contract Deployments**
The single most important signal. Deploying contracts onchain separates builders from users. The significance of what you deployed matters — a protocol used by thousands of wallets carries far more weight than an empty or unknown contract. Long-term builders with multiple meaningful deployments score highest.

**Transaction History**
Wallets with little or no onchain activity score lower. Sustained, long-term transaction history across multiple protocols is a strong positive signal.

**Wallet Age**
Derived from the timestamp of the oldest outgoing transaction. Older wallets with consistent activity score higher. Very new wallets are capped regardless of other signals.

**Contract Interactions**
Genuine participation across diverse protocols signals a real ecosystem participant, not a manufactured identity.

**USDC Balance**
Demonstrated financial presence on Arc contributes positively.

**Activity Spread**
Consistent activity spread across many months signals long-term presence, not a burst campaign designed to inflate scores quickly.

### Tier Bands

| Tier | Score | Who This Is |
|------|-------|-------------|
| LOW | 0 to 39 | New, inactive, or flagged wallet |
| MEDIUM | 40 to 59 | Active user with limited builder history, or any bot flag present |
| HIGH | 60 to 79 | Active developer or sustained long-term participant |
| HIGH_ELITE | 80 to 100 | Serious long-term builders only |

**HIGH_ELITE** reflects sustained long-term builder behavior across multiple dimensions. Missing any critical condition hard-caps the score below this tier.

**A perfect score** reflects exceptional long-term ecosystem participation across every signal category simultaneously.

### Payment Routing

| Score Range | Recommendation |
|-------------|---------------|
| 0 | BLOCKED |
| Low range | TIME_LOCKED |
| Mid range | INSTANT |
| High range | INSTANT_PRIORITY |

### Bot Detection

TrustGate detects velocity anomalies, timer-based automation, self-interaction loops, coordinated activity, and synthetic transaction histories. Any single detected signal hard-caps the wallet at MEDIUM tier regardless of all other signals. There are no exceptions.

---

## Contract Scoring (Token Shield)

Token Shield auto-detects the contract type and applies the correct scoring model.

- ERC-20 address → ERC-20 Token Scoring
- Non-ERC-20 contract → Contract Scoring (free, no payment required)
- Not a contract → error directing to Oracle page

### ERC-20 Token Scoring

**Holder Quality Weighting**
Only wallets that purchased the token count. Airdrop recipients are ignored completely. This removes the fake holder count attack vector entirely — rug pulls cannot boost scores by airdropping to thousands of fresh wallets.

Holder weight is based on the buyer's wallet trust tier. High-trust buyers contribute meaningfully. Low-trust buyers contribute very little. Airdrop recipients contribute nothing.

**Deployer Credibility**
The deployer wallet is scored through the wallet oracle. Their trust tier is applied as a significance multiplier on the token score. Trust propagates from builder to product.

**Score Updates**
New tokens update more frequently. Established tokens update less frequently — changes carry more significance. A rising score on a new token is a positive signal. A falling score on an established token is a warning.

### Non-ERC-20 Contract Scoring

Scored across six dimensions: verification status, contract age, transaction volume, unique interactors, deployer trust, and Arc ecosystem recognition.

**Verification** is weighted heavily. Unverified contracts are capped regardless of all other signals — publishing source code is a trust signal. Verified contracts can reach the highest tiers.

**Contract age** matters. A contract running without incident for many months is more credible than one deployed last week.

**Unique interactors** matter more than raw transaction count. Many different wallets interacting is fundamentally different from one wallet calling the contract many times. Diversity signals organic adoption.

**Deployer trust** propagates directly to the contract score. A HIGH_ELITE deployer is a strong positive signal. A LOW deployer is a red flag regardless of what the contract does on the surface.

**Arc ecosystem recognition** rewards contracts genuinely embedded in the Arc DeFi ecosystem.

### Contract Flags

**Interaction Velocity**
Organic adoption is gradual. A contract receiving an unusually high number of transactions shortly after deployment signals coordinated or automated activity. Hard cap at MEDIUM tier.

**Unverified Hard Cap**
Not a bot flag. A transparency cap. Unverified contracts can still score HIGH but can never reach HIGH_ELITE regardless of all other signals.

### Tier Bands (Contract)

| Tier | Score | Description |
|------|-------|-------------|
| LOW | 0 to 39 | Suspicious, very new, or low-activity |
| MEDIUM | 40 to 59 | Limited history or velocity-flagged |
| HIGH | 60 to 79 | Active with real usage (unverified contracts cap here) |
| HIGH_ELITE | 80 to 100 | Verified, established, high-usage, trusted deployer, Arc-native |

---

## Arcscan vs TrustGate

**Arcscan provides raw data:** deployer address, creation timestamp, verification status, transaction history, address counters, token type classification.

**TrustGate decides quality:** whether activity patterns indicate bots, how deployer history translates to trust, whether timing signals manipulation, how interactor diversity signals credibility, whether Arc ecosystem connections add legitimacy, and the final score and tier.

Arcscan shows you data. TrustGate tells you whether to trust it.

---

Do not change any navigation, layout, sidebar, theme, or existing page structure.
Do not run any git commands.
```

---

## PROMPT 2 — Developer Docs

```
Read CLAUDE.md before doing anything.

Create a new developer documentation page at app/docs/developer/page.tsx

Match the existing docs page layout, sidebar, and styling exactly.
Content only differs.

After creating the page, add it to the docs sidebar navigation alongside existing docs pages.

Do not run any git commands.
Confirm the page renders correctly on the dev server before stopping.

---

PAGE CONTENT:

# TrustGate Developer Documentation

> TrustGate doesn't decide who can interact. It gives every application the information needed to make better trust decisions based on observed behavior rather than identity or reputation alone.

```bash
curl https://api.trustgated.xyz/oracle/wallet/0xYourAddressHere
```

---

## How It Works

```
Wallet or Contract Address
           ↓
   TrustGate Oracle
           ↓
Score + Tier + Confidence + Flags + Summary
           ↓
DEX  /  Lending  /  DAO  /  Wallet UI  /  AI Agent
```

---

## 1. Quick Start

Score a wallet:
```bash
curl -H "X-Payment: <x402_payment_header>" \
  https://api.trustgated.xyz/oracle/wallet/0xYourAddress
```

Score a contract or token:
```bash
curl https://api.trustgated.xyz/oracle/token/0xContractAddress
```

Wallet queries cost 0.001 USDC via the x402 payment standard.
Token Shield queries for non-ERC-20 contracts are free.

---

## 2. Core Concepts

**Trust** — The real-time decision signal. Should you interact with this entity right now? Trust reacts immediately to recent behavior.

**Reputation** — The long-term historical record. What has this entity done over months or years? Trust and reputation are related but not identical.

**Risk** — Exposure to loss from a specific action or context. Risk is not the inverse of trust. Evaluate both signals independently.

**Agent** — Any autonomous or semi-autonomous on-chain actor capable of initiating transactions, making decisions, or interacting with smart contracts on behalf of a user or protocol. Today scored via primary wallet; future versions score at agent-identity level.

**Wallet Score** — A 0 to 100 behavioral trust score derived from a wallet's full onchain history. Deployments, transaction history, contract interactions, wallet age, USDC activity, and behavioral anomaly detection.

**Contract Score** — A 0 to 100 score for smart contracts. Auto-detects ERC-20 or non-ERC-20 and applies the correct scoring model.

**Token Shield** — The contract scoring engine. Scores ERC-20 tokens by holder quality and deployer credibility. Scores non-ERC-20 contracts by verification status, age, usage, unique interactors, deployer trust, and Arc ecosystem recognition.

**Confidence** — A percentage indicating how much historical data backs the score. A wallet with years of activity and thousands of transactions has high confidence. A wallet with minimal history has low confidence. Same tier, very different reliability. Protocols can set minimum confidence thresholds for high-stakes decisions.

**Flags** — Behavioral anomaly signals attached to a score. Each flag describes a detected pattern and carries a recommended protocol response.

**Recommendation** — An operational routing hint returned with every score: BLOCKED, TIME_LOCKED, INSTANT, or INSTANT_PRIORITY.

---

## 3. API Reference

### GET /oracle/wallet/:address

Request:
```bash
curl -H "X-Payment: <x402_payment_header>" \
  https://api.trustgated.xyz/oracle/wallet/0xYourAddress
```

Response:
```json
{
  "score": 72,
  "tier": "HIGH",
  "confidence": 94,
  "recommendation": "INSTANT",
  "scoringVersion": "v1.0",
  "flags": [],
  "summary": [
    "Consistent activity across 11 months",
    "12 verified contract deployments",
    "No coordinated behavior detected"
  ],
  "limitations": [
    "Limited deployment history",
    "Deployments lack independent usage"
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| score | integer 0 to 100 | Raw behavioral trust score |
| tier | string | BLOCKED / LOW / MEDIUM / HIGH / HIGH_ELITE |
| confidence | integer 0 to 100 | Data density behind the score |
| recommendation | string | BLOCKED / TIME_LOCKED / INSTANT / INSTANT_PRIORITY |
| flags | array | Active behavioral flags, empty array if none |
| summary | array | Human-readable behavioral observations |
| scoringVersion | string | Scoring model version (e.g. v1.0) |
| limitations | array | Why the score is not in the next tier up. Omitted when no cap applies. |

---

### GET /oracle/token/:address

ERC-20 Response:
```json
{
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
}
```

Non-ERC-20 Response:
```json
{
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
}
```

Error responses:
```json
{ "error": "Address is not a contract. Use the Oracle page for wallet scoring." }
```
```json
{
  "error": "Payment required",
  "paymentDetails": { "amount": "0.001", "currency": "USDC", "standard": "x402" }
}
```

---

## 4. Tier Meaning

| Tier | Score Range | Meaning | Suggested Action |
|------|-------------|---------|------------------|
| BLOCKED | 0 | Zero onchain activity | Reject entirely |
| LOW | 1 to 39 | New, inactive, or flagged | Escrow or reject |
| MEDIUM | 40 to 59 | Active but limited trust history | Time-lock payments |
| HIGH | 60 to 79 | Trusted participant | Allow with standard terms |
| HIGH_ELITE | 80 to 100 | Proven long-term builder | Priority access |

Key caps to know:
- Any behavioral anomaly flag present: score cannot exceed MEDIUM tier
- Limited deployment history: score cannot exceed HIGH tier
- Unverified contract: score cannot exceed HIGH tier

---

## 5. Flag Reference

### Wallet Flags

**VELOCITY**
Detected when a wallet exhibits abnormally high transaction activity within a short time window.
Catches automated scripts and bot warm-up behavior.
Suggested response: time-lock payments, increase collateral requirements.

**INTERVAL_PATTERN**
Detected when a wallet's transaction timing follows a suspiciously consistent mechanical cadence inconsistent with human behavior.
Catches bots operating on fixed timers.
Suggested response: same as VELOCITY.

**SELF_INTERACTION**
Detected when multiple transfers have matching sender and receiver addresses.
Catches artificial activity inflation and wash loop manufacturing.
Suggested response: reject for lending, time-lock for payments.

**CLEAN_HISTORY_MANIPULATION**
Detected when a fresh wallet has a volume of perfect contract interactions inconsistent with organic onchain behavior. Legitimate wallets almost always have some failed transactions.
Wallets with sufficient age are completely immune to this flag.
Suggested response: time-lock, require additional observation period.

**COORDINATED_BUYING**
Detected when multiple wallets funded from the same source interact with the same contracts in the same time window.
Catches Sybil clusters, airdrop farming rings, and coordinated attacks.
Suggested response: flag for governance review, reject for high-value lending.

### Token and Contract Flags

**HONEYPOT_PATTERN**
Detected when sell volume is near zero relative to buy volume after the initial distribution period. Buyers cannot exit.
Suggested response: surface warning to users, block trust badge from showing positive tier.

**COORDINATED_BUY**
Detected when a large share of token buyers are active within the same short window.
Suggested response: discount holder quality signal, surface warning badge.

**EXIT_SYNC**
Detected when multiple credible wallets exit significant positions within the same rolling window, regardless of how long they held.
A group of wallets holding for months then selling within the same short window is a coordinated exit, not coincidence. All participating wallets receive a persistent mark that affects future scoring.
Suggested response: increase collateral ratio, monitor governance participation, lower leverage limits.

**LOW_HOLDER_QUALITY**
Detected when the majority of token holders are LOW or BLOCKED tier wallets.
Suggested response: surface risk warning, reduce trust weighting for token.

**WASH_TRADE**
Detected when wallets repeatedly buy and sell the same token within short windows with circular address patterns.
Suggested response: flag token, discount volume signals entirely.

**INTERACTION_VELOCITY** (contract)
Detected when a contract receives an unusually high number of transactions shortly after deployment. Organic adoption is gradual.
Suggested response: treat as MEDIUM regardless of other signals until the flag clears.

---

## 6. Integration Examples

### React
```jsx
import { useEffect, useState } from "react";

export function TrustBadge({ address }) {
  const [trust, setTrust] = useState(null);

  useEffect(() => {
    fetch(`https://api.trustgated.xyz/oracle/wallet/${address}`)
      .then(res => res.json())
      .then(data => setTrust(data));
  }, [address]);

  if (!trust) return <span>Checking trust...</span>;

  return (
    <div className={`trust-badge tier-${trust.tier.toLowerCase()}`}>
      <span>{trust.tier}</span>
      <span>{trust.score}/100</span>
      {trust.flags.length > 0 && <span>⚠ {trust.flags.join(", ")}</span>}
    </div>
  );
}
```

### Node.js
```javascript
const axios = require("axios");

async function checkWalletTrust(address) {
  const res = await axios.get(
    `https://api.trustgated.xyz/oracle/wallet/${address}`,
    { headers: { "X-Payment": process.env.X402_PAYMENT_HEADER } }
  );
  const { score, tier, recommendation, flags } = res.data;
  if (recommendation === "BLOCKED") throw new Error("Wallet blocked");
  if (flags.includes("COORDINATED_BUYING")) throw new Error("Coordinated behavior detected");
  return { score, tier, recommendation };
}
```

### Solidity
```solidity
// SPDX-License-Identifier: MIT
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
}
```

### Python
```python
import requests

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
    }
```

---

## 7. Use Cases

**Lending Protocol**
Gate borrowing positions behind trust scoring. Require HIGH tier for standard loans, HIGH_ELITE for uncollateralized credit lines. Escrow or reject LOW and BLOCKED wallets automatically.

**DEX Token Discovery**
Rank token search results by trust score when multiple tokens share the same name or ticker. The token with the most credible deployer, legitimate holder base, and cleanest behavioral record surfaces first.

**Governance Defense**
Monitor proposals for coordinated voting patterns. Alert when low-trust wallets vote the same direction in a short window on a treasury proposal. Alert fires before the vote closes.

**Wallet Warning System**
Surface trust tier and active flags at the point of send before a user signs a transaction. A BLOCKED or LOW destination gets a warning. No code changes needed on the destination contract.

**AI Agent Payments**
Gate agent-to-agent USDC payments behind trust scoring. HIGH_ELITE agents receive instant settlement. LOW agents route through escrow with configurable release conditions.

**Stablecoin Risk Management**
Check trust tier of wallets interacting with stablecoin pools. Use confidence scores to weight risk decisions — the same tier at low confidence is treated differently than the same tier at high confidence.

---

## 8. Pricing and Limits

| Query Type | Cost | Notes |
|------------|------|-------|
| Wallet Oracle | 0.001 USDC | Paid via x402 standard |
| ERC-20 Token Shield | 0.001 USDC | Forwarded to scoring oracle |
| Non-ERC-20 Contract Score | Free | Local formula, no payment |
| Batch queries | Coming soon | Up to 50 addresses per call |

Rate limits: 60 requests per minute per API key.

Payment standard: Circle x402 Nanopayment on Arc. Every paid query includes an X-Payment header with the USDC transaction reference. No subscription required for per-query access.

---

## 9. Security and Philosophy

> TrustGate doesn't decide who can interact. It gives every application the information needed to make better trust decisions based on observed behavior rather than identity or reputation alone.

TrustGate models behavioral trust, not personal identity. It makes no claim about who owns a wallet. It makes claims about what that wallet has done onchain.

Good infrastructure changes behavior. Integrators gate access; participants improve onchain conduct because persistent negative patterns degrade trust over time.

- No KYC data collected or required
- No biometric or social identity linked
- No human identity claims made
- No social graph deanonymization
- Behavioral patterns only — what was done, when, and with whom onchain

This positioning matters for institutional integration, governed protocol deployment, and regulated environments. Behavioral reputation infrastructure is a fundamentally different category from identity systems.

TrustGate scores reflect immutable onchain history. Rehabilitation mechanics are handled through longitudinal behavioral recovery rather than manual appeals.

Score hardening: exact formula weights, thresholds, and scoring mechanics are not published. Public responses return tier, score, confidence, flags, summary, scoringVersion, and limitations only. This prevents adversaries from reverse-engineering an optimization path. Developers integrating TrustGate consume the signal — they do not need to reproduce the calculation.

---

## 10. Roadmap

- Token Behavior Intelligence — hold duration tracking, exit ratio analysis, wash trading detection, honeypot flagging, wallet score feedback loop
- Staking Intelligence — staking history as a trust signal dimension
- DAO Risk Alerts — subscription alerts for lending protocols and DAOs
- Send Address Shield — trust scoring at point of send in wallet UIs (Rabby, MetaMask Snaps)
- Multichain Expansion — Arc, Ethereum, Base, Arbitrum with cross-chain composite scoring
- Trust Graph — EigenTrust-style network analysis, Sybil resistance, coordinated cluster detection
- Trust Intelligence — score stability, direction drivers, and point-in-time trust snapshots for audit trails
- Agent Identity — score agents across multiple wallets, chains, and execution environments
```

---