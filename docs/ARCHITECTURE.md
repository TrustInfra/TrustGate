# Architecture — TrustGate

## Contract Topology

```
                         ┌──────────────────────────┐
                         │     AgentRegistry        │  Permissionless agent registration
                         │     (Ownable2Step)       │  Owner lifecycle management
                         └────────────┬─────────────┘
                                      │ isAgentOwner / isActiveAgent
                                      │
┌─────────────────────────────┐       │
│  TrustScoring (FHE chains)  │◄──────┘  (onlyScorer modifier)
│  or TrustScoringPlaintext   │
│  (non-FHE chains like Arc)  │
└────────────┬────────────────┘
             │ getTrustTierPlaintext (0 / 1 / 2)
             │
┌────────────▼────────────────┐       ┌─────────────┐
│        TrustGate            │──────▶│    USDC     │
│        (Ownable2Step)       │       │   (ERC-20)  │
│   Allowance-based payments  │       └─────────────┘
└─────────────────────────────┘
       ▲               ▲
       │               │
  ┌────┴────┐     ┌────┴────┐
  │Depositor│     │  Agent  │
  └─────────┘     └─────────┘
```

## Data Flow — Agent Registration

```
Agent Owner                  AgentRegistry
   │                              │
   │ registerAgent(wallet,        │
   │   metadataURI)               │
   │─────────────────────────────▶│
   │                              │
   │                    store Agent struct
   │                    mark owner as agentOwner
   │                    totalActiveAgents++
   │                              │
   │◀─────────────────────────────│
   │  AgentRegistered event       │
   │                              │
Oracle / Agent Owner              │           TrustScoring
   │                              │                │
   │ setTrustScore(agent, score)  │                │
   │───────────────────────────────────────────────▶│
   │                              │     store score + tier
   │◀───────────────────────────────────────────────│
   │  TrustScoreUpdated event     │                │
```

## Data Flow — Allowance-Based Payment

```
Depositor            TrustGate         TrustScoring     AgentRegistry    USDC
   │                     │                  │                │            │
   │ deposit(amount)     │                  │                │            │
   │────────────────────▶│                  │                │            │
   │                     │ transferFrom ────────────────────────────────▶│
   │                     │                  │                │            │
   │ setAllowance(       │                  │                │            │
   │   agent, cap)       │                  │                │            │
   │────────────────────▶│                  │                │            │
   │                     │                  │                │            │
Agent                    │                  │                │            │
   │ claim(depositor,    │                  │                │            │
   │       amount)       │                  │                │            │
   │────────────────────▶│                  │                │            │
   │                     │ isActiveAgent?───────────────────▶│            │
   │                     │◀─────────────────────────────────│            │
   │                     │                  │                │            │
   │                     │ hasScore? ──────▶│                │            │
   │                     │ getTier? ───────▶│                │            │
   │                     │◀────────────────│                │            │
   │                     │                  │                │            │
   │              ┌──────┴──────┐           │                │            │
   │              │ Route by    │           │                │            │
   │              │ trust tier  │           │                │            │
   │              └──────┬──────┘           │                │            │
   │                     │                  │                │            │
   │                     │ HIGH  → transfer(agent, amount) ────────────▶│
   │                     │ MEDIUM→ create Pending (24h lock) │            │
   │                     │ LOW   → create Pending (escrow)   │            │
   │                     │                  │                │            │
   │◀────────────────────│                  │                │            │
   │ ClaimCreated event  │                  │                │            │
```

## Trust Tier Routing

| Tier | Score | Payment Path | Release Mechanism |
|------|-------|--------------|-------------------|
| HIGH (2) | >= 75 | Instant USDC transfer | Immediate on `claim()` |
| MEDIUM (1) | 40-74 | 24-hour time-locked | Anyone calls `releaseClaim()` after delay |
| LOW (0) | < 40 | Escrowed | Depositor calls `approveClaim()` |

## Security Model

| Concern | Mitigation |
|---------|------------|
| Unauthorized oracle | `onlyOracle` modifier; oracle list managed by contract owner via `setOracle` |
| Unauthorized scoring | `onlyScorer` modifier: oracles or agent owners scoring their own active agents |
| Agent impersonation | `AgentRegistry.isActiveAgent(owner, agent)` validated on every claim |
| Score staleness | 90-day expiry; `isScoreExpired` check enforced in TrustGate `claim()` |
| Reentrancy | `ReentrancyGuard` on all USDC transfer functions in TrustGate |
| Ownership hijack | `Ownable2Step` on all contracts — requires explicit acceptance |
| Premature release | Time-lock check: `block.timestamp >= claim.releaseTime` |
| Escrow bypass | LOW-tier claims revert on `releaseClaim()` — require `approveClaim()` |
| USDC decimal confusion | Contract uses ERC-20 interface (6 decimals) exclusively; NatSpec warns about Arc's 18-dec native balance |
| Malicious agents | Contract owner can `suspendAgent()` as safety valve |

## Deployment Order

1. **TrustScoringPlaintext** (or TrustScoring on FHE chains) — no dependencies
2. **AgentRegistry** — no dependencies
3. **TrustGate** — constructor takes: USDC address, TrustScoring address, AgentRegistry address
4. **Wire-up** — `TrustScoring.setAgentRegistry(agentRegistryAddress)`
5. **Oracle setup** — `TrustScoring.setOracle(oracleAddress, true)`

## Arc Testnet Deployment

| Contract | Address |
|----------|---------|
| TrustScoringPlaintext | `0xEb979Dc25396ba4be6cEA41EAfEa894C55772246` |
| AgentRegistry | `0x73d3cf7f2734C334927f991fe87D06d595d398b4` |
| TrustGate | `0x52E17bC482d00776d73811680CbA9914e83E33CC` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |

Explorer: https://testnet.arcscan.app
