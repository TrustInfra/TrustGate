# TrustGate

> Trust-Gated USDC Payments for the Agentic Economy

TrustGate is a payment layer for autonomous agents on Arc. Depositors fund a pooled USDC balance, set per-agent spending caps, and delegate routing to an onchain trust score. Each claim settles instantly, time-locks for 24 hours, or holds in escrow — picked deterministically from the agent's tier. The result is sub-cent agent payments with reputation gating that lives entirely on the chain that settles the money.

---

## The Problem

- AI agents need sub-cent micropayments at high frequency.
- Traditional L1 gas fees ($2 – $5 per tx) make this economically impossible.
- ERC-20 `approve()` is all-or-nothing — there is no trust layer for agent-to-agent commerce.
- Any agent that registers can claim against any allowance, with no reputation gate on the settlement path.

## The Solution

- **Onchain trust scoring from real Arc activity** — transactions, USDC balance, contract interactions, and contract deployments combine into a 0 – 100 integer score.
- **Circle Nanopayments** for sub-cent USDC settlement on Arc, where USDC is the native gas token.
- **Trust tier routing** — `HIGH` settles instantly, `MEDIUM` time-locks 24 hours, `LOW` holds in escrow, `BLOCKED` reverts.
- **99.97% cost reduction** versus standard L1 gas — about $0.0008 per claim on Arc versus $2 – $5 on Ethereum mainnet.

## How It Works

1. **Depositor funds TrustGate.** Approve USDC to the contract, call `deposit(amount)` to credit a pooled balance.
2. **Set per-agent allowances.** `setAgentAllowance(agent, maxSpend)` caps every agent independently.
3. **Agent registers** via `AgentRegistry.registerAgent(agent, metadataURI)`. Permissionless.
4. **Agent claims** via `TrustGate.claim(depositor, amount)`. Atomic: read tier, debit allowance, settle.
5. **Score determines routing** — tier is read from `TrustScoring` in the same transaction:

```
       ┌───────────────────────────────┐
       │  TrustGate.claim(deposit, x)  │
       └──────────────┬────────────────┘
                      ▼
              read tier (onchain)
                      │
        ┌─────────┬───┴────┬──────────────────┐
        ▼         ▼        ▼                  ▼
     BLOCKED    LOW     MEDIUM         HIGH / HIGH_ELITE
      revert  escrow  24h time-lock     instant transfer
```

## Trust Scoring

Every score is computed deterministically from Arc onchain activity. No oracle, no manual input.

| Transaction count | Points | Notes |
|---|---|---|
| 0 | 0 | BLOCKED — wallet rejected |
| 1 – 10 | 20 | Newly active |
| 11 – 30 | 40 | Light usage |
| 31 – 60 | 60 | Regular usage |
| 61 – 100 | 75 | High usage |
| 100+ | 85 | Power user |

| Bonus signal | Threshold | Bonus |
|---|---|---|
| USDC balance | > 100 USDC | +5 |
| Contract interactions | 3 – 9 | +5 |
| Contract interactions | 10 – 99 | +7 |
| Contract interactions | 100+ | +15 |
| Contract deployments | 1+ | +10 |

**Cap rules:** hard cap at 97 unless contract interactions ≥ 100. Maximum score is 100. Zero transactions returns 0 regardless of any other signal.

| Tier | Score | Payment behavior |
|---|---|---|
| `BLOCKED` | 0 | Claim reverts |
| `LOW` | 1 – 39 | Escrowed — depositor approval required |
| `MEDIUM` | 40 – 74 | Time-locked 24h, depositor can cancel |
| `HIGH` | 75 – 97 | Instant settlement |
| `HIGH_ELITE` | 98 – 100 | Instant settlement, marked verified |

## Architecture

- **`TrustGate.sol`** — pooled USDC ledger, per-agent allowances, tier-routed claim settlement. The user-facing entry point.
- **`AgentRegistry.sol`** — permissionless agent enrollment with Active / Suspended / Deactivated lifecycle. msg.sender becomes agent owner.
- **`TrustScoringPlaintext.sol`** — onchain trust scores (uint64) with HIGH / MEDIUM / LOW tier lookups. FHE variant exists for Zama-compatible chains.
- **Oracle API** — public, payable HTTP service that returns a typed score for any Arc wallet. 0.001 USDC per query, settled through the x402 payment standard.
- **Frontend** — Next.js 14 dashboard, oracle page, live agents view, demo simulator, full docs.

## Deployed Contracts (Arc Testnet — Chain ID 5042002)

| Contract | Address |
|---|---|
| `TrustGate` | [`0x52E17bC482d00776d73811680CbA9914e83E33CC`](https://testnet.arcscan.app/address/0x52E17bC482d00776d73811680CbA9914e83E33CC) |
| `AgentRegistry` | [`0x73d3cf7f2734C334927f991fe87D06d595d398b4`](https://testnet.arcscan.app/address/0x73d3cf7f2734C334927f991fe87D06d595d398b4) |
| `TrustScoringPlaintext` | [`0xEb979Dc25396ba4be6cEA41EAfEa894C55772246`](https://testnet.arcscan.app/address/0xEb979Dc25396ba4be6cEA41EAfEa894C55772246) |
| USDC (Circle) | [`0x3600000000000000000000000000000000000000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |

All three TrustGate contracts are source-verified on Arcscan.

- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Faucet: `https://faucet.circle.com`

## Live Demo

- App: https://trustgated.xyz
- Demo simulator: https://trustgated.xyz/demo
- Oracle page: https://trustgated.xyz/oracle
- Live agents: https://trustgated.xyz/agents/live
- Docs: https://trustgated.xyz/docs
- X — x.com/TrustGated
- Discord — discord.gg/kbx9RAGCmx

## Oracle API

Base URL: `http://38.49.216.201:3001`

Two paid endpoints, settled via the x402 payment standard (HTTP 402 with payment instructions, replay with `X-Payment` header carrying the proof).

- `GET /trust/:address` — score, tier, recommendation, breakdown, queriedAt, network, source. 0.001 USDC.
- `POST /trust/batch` — up to 10 addresses in one call, charged 0.001 USDC per address.
- `GET /health` — liveness probe, no payment required.

```ts
const ORACLE = process.env.NEXT_PUBLIC_ORACLE_URL!;

// Step 1 — unpaid challenge
const challenge = await fetch(`${ORACLE}/trust/${address}`);
if (challenge.status === 402) {
  const requirement = await challenge.json();
  // Step 2 — settle 0.001 USDC on Arc to requirement.recipient
  const txHash = await sendUsdc(requirement);
  // Step 3 — replay with X-Payment proof
  const paid = await fetch(`${ORACLE}/trust/${address}`, {
    headers: { "X-Payment": btoa(JSON.stringify({ txHash })) },
  });
  const trust = await paid.json();
  if (trust.tier === "HIGH" || trust.tier === "HIGH_ELITE") {
    // proceed instantly
  }
}
```

Full request and response shapes live at `/docs/api-reference`.

## Tech Stack

- **Contracts:** Solidity 0.8.27, Hardhat, OpenZeppelin Contracts 5.x
- **Frontend:** Next.js 14 (App Router), React 18, TypeScript 5, wagmi v2, viem v2, ConnectKit, Tailwind CSS, Framer Motion
- **Settlement:** Arc Testnet (chain ID 5042002), USDC (Circle, 6 decimals), Circle Nanopayments
- **Oracle:** Node.js, Express, x402 payment standard
- **Testing:** Hardhat + Chai, 142 tests, 0 failing

## Local Setup

### Prerequisites

- Node.js 18+
- Git
- An Arc Testnet wallet with at least 0.05 USDC for gas (faucet: `https://faucet.circle.com`)

### Clone and install

```bash
git clone https://github.com/rudazy/TrustGate
cd TrustGate
npm install
cd frontend && npm install && cd ..
```

### Environment variables

```bash
# repo root .env (for contract deploy + scripts)
cp .env.example .env
# add PRIVATE_KEY=<deployer>

# frontend .env.local
cp frontend/.env.example frontend/.env.local
```

Frontend variables:

```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ORACLE_URL=http://38.49.216.201:3001
```

### Run

```bash
# contracts
npx hardhat compile
npm test                  # 142 passing

# frontend dev server
cd frontend && npm run dev

# deploy fresh contracts to Arc testnet
npx hardhat run scripts/deploy-arc.ts --network arcTestnet
```

Open `http://localhost:3000` and connect a wallet on Arc Testnet (chain ID `5042002`). Detailed walkthroughs live in [the in-app docs](https://trustgated.xyz/docs).

## Team

- **Ludarep** — main developer
- **Nald** ([@0xnald](https://github.com/0xnald)) — co-builder

Last updated: May 2026

## License

MIT — see [LICENSE](LICENSE).
