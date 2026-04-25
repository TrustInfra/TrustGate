# TrustGate - Task Tracker

## 2026-04-17 Session

### Completed

- [x] Read TrustScoring.sol fully — understood FHE trust tier system
- [x] Created `IAgentRegistry.sol` — interface replacing IPayGramCore
- [x] Created `ITrustScoring.sol` — interface for TrustGate tier lookups
- [x] Created `AgentRegistry.sol` — permissionless agent registration with lifecycle management
- [x] Created `TrustGate.sol` — trust-gated USDC allowance model (instant/delayed/escrowed by tier)
- [x] Updated `TrustScoring.sol` — swapped all IPayGramCore refs to IAgentRegistry
- [x] Compiled all contracts successfully (25 Solidity files, 0 errors)
- [x] Arc testnet configuration — hardhat.config.ts (chain ID 5042002, RPC, arcscan explorer)
- [x] Deploy script (`scripts/deploy-arc.ts`) — TrustScoringPlaintext -> AgentRegistry -> TrustGate -> wire-up
- [x] Mock contracts — `contracts/test/MockUSDC.sol` (6-decimal ERC-20), `contracts/test/MockTrustScoring.sol` (non-FHE)
- [x] AgentRegistry tests — 36 tests covering registration, deactivation, suspension, reactivation, metadata, views, ownership
- [x] TrustGate tests — 36 tests covering deploy, admin, deposit/withdraw, allowance, HIGH/MEDIUM/LOW claim, cancel, validation, views
- [x] Integration tests — 12 tests covering full lifecycle, cancel/refund, agent lifecycle, tier changes, multi-depositor
- [x] TrustScoring tests updated — replaced PayGramCore employer-scoped section with AgentRegistry agent-owner section
- [x] Created `TrustScoringPlaintext.sol` — non-FHE scoring for Arc testnet (ZamaEthereumConfig doesn't support Arc chain ID)
- [x] Deployed to Arc testnet — all 3 contracts live + wired
- [x] Updated docs — ARCHITECTURE.md, SETUP.md, TRUST_MODEL.md

### Frontend Rebuild (2026-04-17 Session 2)

- [x] Replaced ethers.js with wagmi v2 + viem v2 + ConnectKit
- [x] Updated package.json — removed ethers, added wagmi, viem, connectkit, @tanstack/react-query
- [x] Created wagmi config with custom Arc testnet chain definition (src/lib/config.ts)
- [x] Created Web3Provider with wagmi + ConnectKit dark theme (src/providers/Web3Provider.tsx)
- [x] Created typed ABIs — AgentRegistry, TrustGate, TrustScoringPlaintext, ERC20 (src/lib/abi/)
- [x] Updated constants — Arc testnet chain, deployed contract addresses, trust tier config (src/lib/constants.ts)
- [x] Updated utils — USDC formatters, tier/status helpers, viem-based parseUnits/formatUnits (src/lib/utils.ts)
- [x] Rebuilt layout — Syne (display) + Plus Jakarta Sans (body) + JetBrains Mono, dark-only theme (src/app/layout.tsx)
- [x] Rebuilt Navbar — TrustGate branding, ConnectKitButton, dark theme (src/components/layout/Navbar.tsx)
- [x] Rebuilt Footer — minimal, links to Arcscan + USDC faucet (src/components/layout/Footer.tsx)
- [x] Updated all UI components for dark theme — Badge, Button, Input, GlassCard, Tabs, StatusDot, AddressDisplay
- [x] Created TrustTierBadge component — HIGH/MEDIUM/LOW with color-coded dots (src/components/ui/TrustTierBadge.tsx)
- [x] Created DepositorPanel — deposit/withdraw USDC, set agent allowances, USDC approve flow (src/components/dashboard/DepositorPanel.tsx)
- [x] Created AgentPanel — register agents, view agents with trust scores, set scores, deactivate (src/components/dashboard/AgentPanel.tsx)
- [x] Created ClaimsPanel — view claims, release time-locked, approve escrowed, cancel pending (src/components/dashboard/ClaimsPanel.tsx)
- [x] Built landing page — trust tier cards, how-it-works steps, CTA (src/app/page.tsx)
- [x] Built dashboard page — tabbed interface (Depositor/Agents/Claims), connect gate (src/app/dashboard/page.tsx)
- [x] Updated tailwind.config — dark-first palette, semantic color tokens (bg, accent, tier colors)
- [x] Updated globals.css — dark background, dark card/nav styles, scrollbar
- [x] Removed all old PayGram files — hooks, FHE utils, old ABIs, ThemeProvider, ThemeToggle, ConnectButton, NetworkBanner
- [x] Build passes — `next build` succeeds, both pages render correctly

### Arc Testnet Deployment (2026-04-17)

| Contract | Address |
|----------|---------|
| TrustScoringPlaintext | `0xEb979Dc25396ba4be6cEA41EAfEa894C55772246` |
| AgentRegistry | `0x73d3cf7f2734C334927f991fe87D06d595d398b4` |
| TrustGate | `0x52E17bC482d00776d73811680CbA9914e83E33CC` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |
| Deployer | `0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62` |

### Architecture Decisions

- Allowance model chosen over create-payment or request-approve (most autonomous-agent-friendly)
- Permissionless agent registration (trust scores handle quality filtering)
- Plaintext tier routing in TrustGate (USDC is standard ERC20, oblivious routing adds cost without benefit)
- TrustScoringPlaintext created for Arc testnet (ZamaEthereumConfig rejects unsupported chain IDs)
- USDC ERC-20 interface only (6 decimals) — never native balance (18 decimals)
- wagmi v2 + viem v2 + ConnectKit for frontend (replaces ethers.js)
- Dark-only theme (no light mode toggle) — precision dark aesthetic
- Syne (display) + Plus Jakarta Sans (body) typography

### Frontend Stack

- Next.js 14, Tailwind CSS, wagmi v2, viem v2, ConnectKit
- Framer Motion, Lucide React, clsx + tailwind-merge
- Dark theme: #0a0a0a background, #3b82f6 accent, semantic tier colors

### Test Results

- 142 passing, 0 failing
- 36 pending (FHE-dependent TrustScoring tests, expected on vanilla Hardhat)

## 2026-04-24 Session

### Completed

- [x] Added `src/lib/arcScoring.ts` — queries Arc RPC + Arcscan API for tx count, USDC balance, and contract interactions; implements exact trust-score formula (tx tiers 20/40/60/75/85, +5 USDC>100, +5/+7/+15 contract bonus, 3-contract minimum, 97-cap unless 100+ contracts, BLOCKED/LOW/MEDIUM/HIGH/HIGH_ELITE tier mapping)
- [x] Replaced manual "Set Score" input + button in `AgentPanel.tsx` AgentCard with "Calculate Score" button that auto-runs the Arc onchain formula
- [x] Added loading states: "Querying Arc RPC" -> "Awaiting wallet" -> "Confirming on Arc"
- [x] Added ScoreBreakdown panel that displays: transaction points, USDC balance points (with "Below 100 USDC threshold — 0 points" fallback), contract interaction points (with "Below 3 minimum — 0 points" fallback), total score X/100, tier, score source = Arc Onchain Activity, and HIGH ELITE "Verified" indicator
- [x] Score flow auto-calls `TrustScoring.setScore()` with computed score; refetches hasScore/trustTier after tx confirmation
- [x] BLOCKED wallets (0 tx) skip the setScore call and show a warning instead of writing 0 onchain
- [x] `next build` passes (0 errors, pre-existing warnings only)

### Bug Fix Round 1 (2026-04-24)

- [x] **Moved Arc score logic server-side** — created `/api/arc-score/[address]/route.ts` to fix CORS-blocked Arcscan calls. Queries Arc RPC `eth_getTransactionCount`, `eth_call` for USDC `balanceOf`, and Arcscan `/api/v2/addresses/{addr}/transactions?filter=from` (paginated up to 10 pages) for contract interactions + deployments
- [x] **Fixed Blockscout field name** — API uses `transaction_types` (not `tx_types`); earlier browser-side code silently returned 0 interactions because of this
- [x] Added **contract deployment bonus** (+10 points) for wallets that have deployed 1+ contracts on Arc (detected via `created_contract != null` / `contract_creation` in `transaction_types`)
- [x] API route logs every stage: raw RPC results, scanned tx counts, points per category, raw total, capped flag, final score, tier
- [x] Refactored `arcScoring.ts` to call `/api/arc-score/[address]` — no direct Arcscan calls from browser
- [x] **Breakdown panel extended** with "Contract deployments" row ("X deployments on Arc" or "No deployments on Arc — 0 points")
- [x] **Register Agent preflight** — `getAgent(agentAddr)` read detects status != None and blocks client-side with "already registered" message before tx (prevents the previously-seen `0xe098d3ee AgentAlreadyRegistered` revert)
- [x] **Auto-fill agent address** with connected wallet; "Use connected wallet" button restores it if edited
- [x] **Gas balance check** via wagmi `useBalance` — blocks submit with "Insufficient USDC for gas" if native balance < 0.01 USDC (18 decimal threshold 10^16 wei)
- [x] **Revert decoding** — `BaseError.walk(ContractFunctionRevertedError)` extracts `errorName` from the ABI, mapped to human messages (`AgentAlreadyRegistered`, `ZeroAddress`, `NotAgentOwner`, etc.); unknown reverts fall through to `shortMessage`; raw error logged via `console.error`
- [x] **Live test passed** against `0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62`: 29 txs (40 pts) + 13.88 USDC (0 pts) + 13 contract calls (7 pts) + 16 deployments (10 pts) = 57 / MEDIUM
- [x] BLOCKED path verified with zero-tx address: `{score: 0, tier: "BLOCKED"}` even when USDC balance > 100
- [x] `next build` still passes

## 2026-04-25 Session

### Oracle + Live Agents pages

- [x] Created `app/oracle/page.tsx` — hero, live stats from `${ORACLE_URL}/oracle/stats`, interactive playground hitting `/oracle/query` (renders 402 with x402 badge), curl example + response shape, CTA to live agents
- [x] Created `app/agents/live/page.tsx` — Autonomous Agent Loop view, polls `/agent-status` every 5s, table (Agent · Address · Score · Tier · Last claim · Total USDC · Total Claims), summary tiles, graceful 404/error fallback with static loop explainer
- [x] Added `Oracle` and `Live Agents` links to `Navbar.tsx`
- [x] Added `NEXT_PUBLIC_ORACLE_URL` to root `.env.example` and created `frontend/.env.example`
- [x] `next build` passes — `/oracle` and `/agents/live` listed as static routes

### Docs + README rewrite

- [x] Updated `DocsSidebar.tsx` to the new 8-section structure: Overview → How It Works → Trust Scoring → Contracts → API Reference → Dashboard Guide → Integration → Local Setup
- [x] Rewrote `/docs` (Overview) — problem, solution, quick links to the four most-visited pages
- [x] Rewrote `/docs/how-it-works` — five-step flow, ASCII routing diagram, "Why Arc + Circle Nanopayments" rationale
- [x] Created `/docs/trust-scoring` — full scoring formula, bonus + cap rules, tier mapping table, worked example
- [x] Refreshed `/docs/contracts` — all 4 addresses (TrustGate, AgentRegistry, TrustScoringPlaintext, USDC) with Arcscan links, network params, verification recipe
- [x] Created `/docs/api-reference` — base URL, x402 explanation, GET /trust/:address, POST /trust/batch, GET /health, error codes
- [x] Created `/docs/dashboard-guide` — Depositor / Agents / Claims tab walkthrough, Calculate Score flow, what the dashboard does NOT do
- [x] Created `/docs/integration` — TS oracle integration, contract integration with `ITrustScoring` interface, Sofia-style predicate weight forward look
- [x] Created `/docs/local-setup` — prereqs, clone, contracts + frontend install, env vars, deploy + verify recipe, repo layout, common issues
- [x] Rewrote root `README.md` per the new structure (problem, solution, scoring tables, tier table, architecture, deployed contracts, live demo links to trustgated.xyz, oracle API + code example, tech stack, local setup, team)
- [x] Old orphan doc pages (trust-tiers, agent-registration, payment-flow, margin-analysis, oracle, agent-loop) left in place — no longer in sidebar but still resolve at their URLs
- [x] `next build` passes — all 8 new doc routes static, 0 errors
