# Trust Model — TrustGate

## Overview

TrustGate adapts the **EigenTrust** distributed reputation algorithm for trust-gated AI agent payments. Trust scores quantify an agent's reliability and directly determine how USDC payments are routed — instantly, with a time delay, or through depositor-approved escrow.

## EigenTrust Adaptation

The original EigenTrust algorithm computes a global trust vector by iteratively aggregating local trust values across a peer-to-peer network. TrustGate adapts this model as follows:

| EigenTrust Concept | TrustGate Implementation |
|--------------------|--------------------------|
| Local trust value (s_ij) | Per-owner rating of an agent based on task completion and reliability |
| Pre-trusted peers | Initial set of agents seeded with baseline scores by their owners |
| Trust propagation | Oracle aggregates ratings from multiple sources into a single score |
| Global trust vector | Final score stored in TrustScoring (encrypted `euint64` on FHE chains, plaintext `uint64` on Arc) |
| Trust normalization | Scores normalized to 0-100 range |

### Scoring Pipeline

```
Agent owner feedback  ─┐
                       │     ┌─────────────┐     ┌──────────────────────────────┐
Task completion       ─┼────▶│  Off-chain  │────▶│  TrustScoring (FHE chains)   │
                       │     │  Oracle     │     │  or TrustScoringPlaintext    │
Peer endorsements     ─┤     │  Aggregator │     │  (non-FHE chains like Arc)   │
                       │     └─────────────┘     └──────────────────────────────┘
Historical track record┘
          │
          ▼
    EigenTrust iteration
    (weighted average,
     convergence check)
          │
          ▼
    Normalized score [0, 100]
          │
          ▼
    FHE chains: encrypt → setTrustScore(subject, encScore, proof)
    Non-FHE:    plaintext → setTrustScore(subject, score)
```

## Trust Tiers

The contract never decrypts the score.  Tier classification uses FHE comparison operators:

```solidity
ebool isHigh   = FHE.ge(score, FHE.asEuint64(75));
ebool isMedium = FHE.ge(score, FHE.asEuint64(40));
```

| Tier | Threshold | Payment Path | Use Case |
|------|-----------|--------------|----------|
| HIGH | score >= 75 | Instant USDC transfer | Established agents with consistent delivery |
| MEDIUM | 40 <= score < 75 | 24-hour time-locked release | Agents building their track record |
| LOW | score < 40 | Escrowed, depositor approves | New agents with limited history |

### Tier Transition

Scores evolve over time as the oracle feeds updated ratings. An agent's tier can improve or degrade based on recent performance:

```
New agent (score 20, LOW) ──▶ 3 months reliable (score 55, MEDIUM) ──▶ 1 year (score 82, HIGH)
```

Each score update replaces the previous ciphertext.  FHE grants on the old ciphertext become invalid, ensuring stale observers cannot read outdated scores.

## Encrypted Score Storage

Scores are stored as `euint64` (64-bit encrypted unsigned integer):

- **Range**: 0 to 100 (enforced off-chain by the oracle before encryption)
- **Storage**: `mapping(address => euint64)` in `TrustScoring`
- **Access**: Only addresses with an explicit `FHE.allow` grant can decrypt

### Why euint64?

A `euint8` would suffice for the 0–100 range, but `euint64` was chosen for:
1. Alignment with salary types (also `euint64`), simplifying cross-contract FHE operations
2. Forward compatibility if scoring precision increases beyond 8-bit range
3. Negligible gas overhead difference between encrypted type widths in FHEVM

## Privacy Guarantees

| Property | Guarantee | Mechanism |
|----------|-----------|-----------|
| Score confidentiality | No party can read the numeric score without an FHE grant | `euint64` storage + `FHE.allow` |
| Tier confidentiality | Tier classification result is an `ebool` — not revealed on-chain | `FHE.ge` returns encrypted boolean |
| Salary confidentiality | Salary amounts never appear in plaintext | `euint64` storage, ERC-7984 transfers |
| Payment routing privacy | Which tier an employee falls into is not observable | `FHE.select` branches without decrypting |
| Cross-employee isolation | One employee's score cannot be correlated with another's | Separate ciphertexts, no aggregation on-chain |
| Temporal privacy | Score updates produce new ciphertexts, invalidating old grants | FHE permission model |

## Oracle Architecture

The oracle is the sole entity authorized to write trust scores on-chain.  Its responsibilities:

1. **Aggregate feedback** — collect employer ratings, milestone data, and peer endorsements
2. **Run EigenTrust iteration** — compute converged trust vector off-chain
3. **Normalize** — map raw trust values to the [0, 100] integer range
4. **Encrypt** — produce `externalEuint64` ciphertext using the FHEVM client library
5. **Submit** — call `setTrustScore` with the ciphertext and its zero-knowledge proof

### Oracle Trust Assumptions

| Assumption | Risk | Mitigation |
|------------|------|------------|
| Oracle is honest | Oracle could submit arbitrary scores | Multi-oracle quorum (planned) |
| Oracle is available | Score updates stall if oracle goes offline | Fallback to last-known score |
| Oracle key security | Compromised key allows score manipulation | Key rotation via `setOracle` |

### Planned: Multi-Oracle Quorum

A future version will support multiple oracles whose scores are aggregated under FHE (encrypted averaging).  This eliminates single-oracle trust and aligns more closely with the decentralized spirit of EigenTrust.

## References

- Kamvar, S. D., Schlosser, M. T., & Garcia-Molina, H. (2003). *The EigenTrust Algorithm for Reputation Management in P2P Networks.* WWW '03.
- Zama FHEVM documentation: https://docs.zama.ai/fhevm
- ERC-7984 specification: https://eips.ethereum.org/EIPS/eip-7984
