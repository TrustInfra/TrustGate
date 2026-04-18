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
