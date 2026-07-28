# Behavioral Access Infrastructure — Design Spec

**Status:** Phase A implemented (simple attestations + protocol ladder check + on-chain verifier). Pilots still required before calling it production-hardened.  
**Product name (working):** Behavioral access infrastructure (DAO / protocol gating)  
**Last updated:** 2026-07-28  
**Code:** `frontend/src/lib/gating/*`, `POST /api/gating/*`, `/gating`, `contracts/TrustAttestationVerifier.sol`

---

## 1. Purpose

Enable DAOs and protocols (lending, treasury access, gated voting, allowlists, agent permissions, etc.) to use TrustGate trust scores as an **access-control signal**.

The protocol defines its own rules. TrustGate provides a hard-to-fake behavioral score and, optionally, a verifiable attestation of that score. TrustGate does not set policy.

This document is the tightened product doctrine + protocol design. It is intentionally buildable later; it is not a mandate to build now.

---

## 2. Non-goals

TrustGate will not:

- Set borrow limits, access ladders, or risk appetite for any protocol
- Act as a price oracle or assert token price / collateral value
- Validate whether a loan is “safe” or whether a participant can repay
- Act as a credit bureau (no creditworthiness claims, appeals process as credit, or discrimination framing)
- Be the sole risk engine a protocol depends on
- Provide KYC / legal identity
- Run EigenTrust, AgentRank, or a knowledge graph (those belong to Intuition MCP)
- Author or host universal on-chain policy UIs for every protocol’s ladder in v1

---

## 3. Responsibility boundary (hard line)

| Party | Owns | Does not own |
|-------|------|--------------|
| **TrustGate** | Hard-to-fake behavioral **score** for a wallet; separately, **token credibility** score; optional **signed, time-bound, revocable attestation** of that score | What a score is allowed to do; pricing; collateral valuation; protocol risk policy |
| **Protocol** | Ladder / mapping of score bands → capabilities; multi-factor risk rules; fail-closed behavior; own price oracle and collateral logic | How the score is computed (opaque by design); TrustGate’s calibration |

**Liability fence (repeat in integration docs):**  
“TrustGate said the wallet scored N at time T under scoringVersion V. The protocol chose what N allows.”

**Positioning language (mandatory):**

- Prefer: *behavioral access infrastructure*, *behavioral risk signal*, *trust signal*
- Avoid: *onchain credit score*, *safe to lend*, *creditworthiness*, *approved borrower*
- Always: *scores behaviour, not value / safety*

---

## 4. Product doctrine

### 4.1 TrustGate is one input, never the whole risk engine

Protocols must not gate purely on `wallet score >= X`. Single-number dependency creates score-farming pressure. Integration guidance must encourage multi-factor gating:

- TrustGate wallet score (and/or token score)
- Collateral and protocol-native risk parameters
- Protocol history / prior defaults
- Staking, locks, or skin-in-the-game
- DAO participation or other domain signals

### 4.2 Anti-gaming principle

TrustGate’s job is not to decide what a score can unlock. It is to make the **score itself expensive to fake**.

Mainnet high scores must be backed by **economic authenticity**: real value held and moved with real counterparties over sustained time, with real capital at risk — not cheap spam (tx count, faucet noise, synthetic volume).

**Counterparty** in TrustGate means **count of distinct on-chain counterparties** (direct observation). It does **not** mean trust propagation through a graph. Graph weighting/propagation is Intuition’s domain.

### 4.3 Dynamic trust

Standing is not permanent. Behaviour that degrades must lower standing. Attestations must **expire** fast enough that actors cannot coast on stale trust. Time-bound, revocable attestations enforce this.

### 4.4 Mainnet vs testnet calibration

Same scoring **engine shape**, **separate calibrations**:

| Model | Environment | Calibration intent |
|-------|-------------|--------------------|
| Arc / testnet | Testnets, thin activity, faucet noise | Useful signal under sparse data; looser economic authenticity |
| Mainnet (gating) | Real ecosystems, real capital | Stricter; economic authenticity weighted far above raw activity quantity |

DAO / protocol gating runs on the **mainnet calibration**. Never present testnet scores as mainnet-gating grade without explicit version and environment labels.

### 4.5 Intuition boundary

| Concern | Product |
|---------|---------|
| Direct on-chain behaviour scoring | TrustGate |
| Counterparty **counts** | TrustGate |
| EigenTrust / AgentRank / knowledge graph | Intuition MCP only |
| Optional future bridge | TrustGate score may be **ingested** by Intuition as an external attestation input; graph stays on Intuition’s side |

### 4.6 Scope split vs agent-payment product

Existing docs (`TRUST_MODEL.md`, payment tiers, agent escrow paths) describe a related but distinct surface: agent registration + payment routing by tier.

| Surface | Role |
|---------|------|
| **Behavioral oracle** (wallet + token scores, API, future attestations) | Shared trust **signal** layer |
| **Agent payment rails** (TrustGate contract, escrow, FHE/plaintext tiers) | Application that *consumes* scores for payments |
| **Behavioral access gating** (this doc) | Application pattern: protocols consume scores/attestations for access control |

Public messaging and integration docs must not imply that payment-tier thresholds are TrustGate’s recommended lending policy. Before gating pilots ship, reconcile `TRUST_MODEL.md` language so partners see one coherent story: **scores are signals; applications set policy**.

### 4.7 Adoption sequencing (do not skip)

1. Trust visibility (score exists and is seen)
2. DEX integrations (SwapArc and successors)
3. Token credibility (Token Shield adoption)
4. Wallet trust reliance (users/protocols treat scores as meaningful)
5. **Then** gated financial / access primitives (this product)

Do not build step 5 as speculative infrastructure without pilot demand.

### 4.8 Monetization philosophy (not a fee schedule)

You cannot monetize gating before the score is trusted.

| Phase | Goal | Money |
|-------|------|-------|
| 1 | Adoption; score reputation | Free or near-free (existing low per-query model / partner free tier) |
| 2 | 2–3 real protocol pilots; evidence (“flagged wallets that would have lost capital”) | Still free or sponsored; case studies |
| 3 | Monetize **verifiable attestation**, not the raw number | Free/cheap: raw score read. Paid: signed, expiring, on-chain-verifiable attestation |

Exact fee shape (per-attestation, subscription, stake-weighted) is **deferred** until usage data exists. Design principle only: **paid surface = attestation / verification trust**, not the integer alone.

### 4.9 Positioning expansion (vision, not Phase A scope)

Lending is a proving use case. The category is **behavioral access infrastructure**: any surface where access should depend on trustworthy behaviour — DAO voting weight, treasury permissions, launchpad allowlists, proposal gating, rate limits, sybil-resistant airdrops, API abuse prevention, agent permissions, reputation-aware automation.

**AI agents** are a strong **future** narrative (machines cannot socially evaluate trust; expiring attestations fit agent economies). Hold as future primary market research. Do **not** drive Phase B pilot scope with agent-marketplace semantics.

### 4.10 Trust trajectory (Phase B/C only)

Protocols will eventually want history: “ELITE for 11 months then deteriorated,” “steady improvement,” “token trust collapsed after deployer exit.” This is snapshot storage + presentation of the existing dynamic model. **Park until** the live score is trusted enough that history is worth paying attention to. Do not build trajectory product in Phase A.

### 4.11 Stay grounded

Language stays concrete: observable on-chain behaviour, economic authenticity, probabilistic signal. Avoid “redefining trust,” “solving reputation forever,” or abstract AGI-trust rhetoric.

---

## 5. Signals protocols can consume

Two independent optional signals:

| Signal | Question | Primary use |
|--------|----------|-------------|
| **Wallet score** | Is this participant hard to fake as a sybil / low-authenticity actor? | DAO gating, borrow access, voting, allowlists |
| **Token score** (Token Shield) | Is this token’s holder/liquidity/behaviour profile credible? | Collateral admission, fake-token class of attack |

A protocol may use one, both, or neither, always alongside its own risk logic.

Public API shape today (illustrative; source of truth is live API docs):

- `score`, `tier`, `confidence`, `flags`, `summary`, `scoringVersion`, `limitations`
- Wallet and token endpoints remain separate

Gating design must preserve **`scoringVersion`** as a first-class compatibility field.

---

## 6. Protocol policy model (ladder)

Protocols do **not** set a single flat score unless they choose to. Recommended model: a **ladder** of score bands → access levels. Rung count is the protocol’s choice.

### 6.1 Abstract shape

```text
band: { minScore, maxScore? }  →  capability: { action, limit, params }
```

### 6.2 Illustrative examples (not TrustGate defaults)

**Financial (protocol-owned example only):**

```text
score [25, 48]  →  maxBorrow = 20_000
score [49, 60]  →  maxBorrow = 100_000
score [61, 90]  →  maxBorrow = higher_protocol_limit
```

A wallet scoring 48 that requests 500k is rejected because **the protocol’s** band for 500k requires a higher score — not because TrustGate forbids 500k.

**Non-financial:**

```text
score < 40           →  cannot submit governance proposals
score [40, 74]       →  can submit; reduced voting weight
score >= 75          →  full proposal + voting weight path
```

TrustGate does **not** ship a universal ladder dashboard as product surface for pilots. Protocols configure ladders in their own governance, config, or on-chain params. TrustGate may ship **reference adapters** and example configs only.

---

## 7. Delivery modes

| Mode | Trust assumption | Fit |
|------|------------------|-----|
| **On-chain / verifiable attestation** | Contract verifies issuer signature + expiry (+ optional issuer registry) | High-value gating; moat; trustless at moment of risk |
| **Off-chain API** | Protocol backend trusts TrustGate HTTP response | Low-friction onboarding; non-critical or backend-enforced gates |

**Recommendation:** Lead with attestation for serious capital. API is the easy on-ramp and may return the **same payload** that is later signed for attestation.

**Phase B pilot default:** One lead path — signed attestation payload + optional off-chain read of the same fields. Do not fully productize two parallel stacks before a pilot needs both.

Conceptual kinship: expiring capability model (e.g. Sui `TrustedAgentCap` work) — time-bound permission artifact, not permanent standing.

---

## 8. Attestation protocol (design target)

### 8.1 Minimum attestation fields

| Field | Purpose |
|-------|---------|
| `subject` | Wallet (or contract) address being attested |
| `chainId` | Chain context for the subject / domain separation |
| `score` | Integer score (if disclosure mode = full score) |
| `tier` | Optional tier label if exposed |
| `confidence` | Data density signal |
| `scoringVersion` | Model + environment identity (e.g. `mainnet-wallet-v1.0`) |
| `issuedAt` | Unix timestamp |
| `expiresAt` | Unix timestamp; hard validity end |
| `attestationId` | Unique id / nonce (replay resistance) |
| `issuer` | Issuer identity (key or registry id) |
| `signature` | Issuer signature over canonical payload |
| `flags` | Optional; product policy decides if included in signed payload |

**Wallet vs token:** Prefer **two attestation types** (or a `subjectType` discriminant) rather than one overloaded blob, unless a protocol explicitly requests a bundled dual-signal attestation later.

### 8.2 Disclosure modes (open decision)

| Mode | On-chain / public content | Tradeoff |
|------|---------------------------|----------|
| **Full score** | Raw score (+ maybe tier) | Simple; public score history; easier farming observability |
| **Tier only** | Tier enum | Coarser policy |
| **Threshold proof** | Boolean / claim: `score >= T` for protocol-chosen T | Better privacy; less “credit file”; more complex issuance |

Recommendation for first pilots: start with **full score in signed payload**, verify off-chain or on-chain as needed; evaluate threshold proofs before large public mainnet financial gates.

### 8.3 Verification surface (what protocols integrate)

Logical interface (chain-specific encoding later):

```text
verify(attestation, expectedSubject, expectedChainId) →
  { score | thresholdClaim, confidence, scoringVersion, expiresAt, issuer }
```

Requirements:

- Reject wrong subject / chain
- Reject expired `expiresAt`
- Reject unknown / rotated-out issuer keys
- Reject unsupported `scoringVersion` if protocol pins versions
- Never treat missing attestation as pass on high-value paths

### 8.4 Issuer keys and rotation

- Issuer key held by TrustGate operational security (multisig or hardened issuer service — exact ops TBD)
- On-chain **issuer registry** (or equivalent) so protocols do not hardcode a single ephemeral key
- Key rotation must not brick gates: grace period for previous key, or dual-sign window, documented clearly

### 8.5 Revocation

Two layers:

1. **Expiry (required):** every attestation dies at `expiresAt`
2. **Active revocation (optional later):** denylist / attestation id revoke / issuer emergency pause

Phase B minimum: **expiry-only** plus issuer key compromise runbook. Active revocation if a pilot requires mid-window kill.

### 8.6 Freshness defaults (protocol-overridable guidance)

| Use class | Suggested max attestation age | Rationale |
|-----------|-------------------------------|-----------|
| High-value financial release | Short (hours to ~1 day) | Stale trust is expensive |
| Governance / allowlist | Medium (days) | Lower moment-of-risk intensity |
| Display-only UX | Longer or live API | No fund release |

Exact numbers are pilot-negotiated. Shorter = safer and costlier; longer = cheaper and staler.

### 8.7 Failure matrix (fail-closed default)

| Case | Recommended high-value behavior |
|------|----------------------------------|
| No attestation | Deny |
| Expired | Deny |
| Bad signature / unknown issuer | Deny |
| Subject mismatch | Deny |
| Score below required band | Deny with protocol reason code |
| `scoringVersion` not in allowlist | Deny or force re-attest under pinned version |
| Low `confidence` | Protocol choice (document: treat as weaker signal, not auto-pass) |
| API / issuer outage | Deny for financial paths; never fail-open |
| Flags present (if used) | Protocol policy on each flag |

### 8.8 Score versioning contract

Recalibrations that change who passes a band are **breaking** for gated protocols.

- Expose `scoringVersion` on every score and attestation
- Protocols **pin** allowed versions in config
- Major calibration changes bump version
- Communicated migration window before old version attestations are refused by issuer

Without this, a silent mainnet recalibration breaks partner risk models overnight.

---

## 9. Mainnet scoring direction (gating-grade)

Detail of weights is **not** public (anti-gaming). Design constraints for the mainnet wallet model:

**Weight heavily**

- Sustained economic interaction over time
- Real capital at risk (value held/moved — not TrustGate as price oracle; use robust on-chain value proxies carefully)
- Diverse real counterparties (counts, not graph trust)
- Persistence and consistency of behaviour
- Negative marks: coordinated exit clusters, known sybil factories, wash patterns (connect to existing coordinated-behaviour signals in Token Shield / wallet pipeline)

**Do not overweight**

- Raw tx count
- Wallet age alone
- Cheap multi-wallet fanout
- Faucet or testnet-like spam patterns on mainnet

**Out of scope for score**

- Off-chain identity / KYC
- Asset “safety” or “good investment”
- Price prediction
- Ability to repay debt

A separate **Mainnet Wallet Calibration** doc should list candidate features and evaluation methodology before implementation. This gating doc only constrains the design.

### 9.1 Adversarial sketch (one page threat model)

| Attack | Direction |
|--------|-----------|
| Spam activity | Cap/ignore low-value activity; require economic authenticity |
| Wash trading / circular volume | Detect circular patterns; devalue non-economic loops |
| Rented / temporary capital | Favor sustained presence over one-shot large balances |
| Wallet farms / clusters | Cluster and coordinated-behaviour marks; diversity without independence is weak |
| Score farming to a single threshold | Multi-factor guidance; optional threshold proofs; versioned opaque weights |
| Stale attestation coasting | Short expiry; fail-closed |
| Oracle impersonation | Issuer registry + signature verify; never trust unsigned API alone for on-chain release |

**Honest limits:** Sophisticated adversaries with large real capital and long time horizons can still look authentic. TrustGate reduces cheap sybil and fake-activity risk; it does not eliminate well-funded long con. Protocols must retain collateral and multi-factor controls.

---

## 10. Configuration: who sets the ladder

| Layer | Owner | Phase |
|-------|-------|-------|
| Score computation | TrustGate | Always |
| Attestation issue / expire | TrustGate | When attestations ship |
| Ladder / capabilities | Protocol | Always |
| On-chain ladder params | Protocol governance / admin | Only if their gate is fully on-chain |
| TrustGate-hosted policy UI | — | **Not** Phase A/B product |

Pilot support: reference Solidity (or Move) verifier + example ladder module + integration checklist.

---

## 11. Reference integration (definition of “pilot-ready”)

When implementation starts, “done” for a pilot adapter means:

1. Canonical attestation payload + signing
2. Verify path (off-chain and/or on-chain) with tests: happy path, expired, bad sig, wrong subject, version pin fail, below band
3. Example ladder in **protocol-owned** code
4. Integration checklist:
   - Pin `scoringVersion`
   - Set max attestation age
   - Fail-closed on missing/invalid attestation
   - At least one non-TrustGate risk factor required for high-value actions
   - Document user-facing denial reasons without implying TrustGate “rejected a loan”

---

## 12. Rollout phasing

| Phase | Scope | Exit to next |
|-------|-------|--------------|
| **A** | Wallet scores, token scores, integrations, public visibility, history foundations, simple score API maturity | Scores visible; partners use them; gaming monitoring exists |
| **B** | 2–3 controlled protocol gating pilots; attestation v0; monitoring; false-positive and gaming analysis | Evidence pack; stable attestation verify; willing paid design |
| **C** | Generalized behavioral access infra; broader standards; agent permissions; governance tooling | Only after B earns it |

Do not jump to Phase C.

### 12.1 Pilot entry criteria (before building gating)

At least two of:

- 2–3 serious protocol partners with a concrete pain (sybil, bad debt, allowlist abuse) and willingness to **fail-closed**
- Production display or use of TrustGate scores outside TrustGate’s own UI (DEX or protocol)
- Internal red-team / gaming review of mainnet (or target-chain) calibration with written residual risks
- Partner agreement on pinned `scoringVersion` and expiry class

### 12.2 Pilot success metrics (examples)

- Partner can enforce ladder with attestation verify in their environment
- Documented cases where low/blocked scores would have reduced loss or spam (even retrospectively)
- False-positive review process run with partner (who was wrongly constrained and why)
- No critical key-compromise or fail-open incident
- Partner willing to continue or to discuss paid attestation tier

---

## 13. Chain strategy

| Priority | Choice |
|----------|--------|
| First implementation | **One** environment where pilot partners actually deploy (decide per pilot: existing TrustGate distribution vs partner home chain) |
| Payload design | Chain-agnostic signed fields first; chain-specific verify adapters second |
| Cross-chain universal standard | Research track; **not** a Phase B blocker |
| Sui expiring-capability parallel | Keep conceptual alignment; do not block EVM pilot on dual-chain launch |

Open: whether first attestation lands on Arc, Ethereum L2, or partner-preferred EVM. Decision = pilot-driven.

---

## 14. Privacy and user disclosure

- On-chain full-score attestations create a **public behavioural record** for that window
- Integration docs must state what becomes public
- End-user UX (when TrustGate-controlled): explain that a protocol requested a trust signal, not that TrustGate “approved a loan”
- Future: threshold proofs to reduce raw score publication

---

## 15. Open decisions (resolve before build)

| # | Decision | Notes / lean |
|---|----------|--------------|
| 1 | First chain + signing scheme | Pilot-driven chain; EIP-712-style typed data lean for EVM; portable field set |
| 2 | Expiry defaults by use class | Short for financial; protocol override required |
| 3 | Mainnet feature set vs testnet | Separate calibration doc; economic authenticity first |
| 4 | Ladder config | Protocol-owned; TrustGate reference only |
| 5 | Pricing numbers | Defer; lock free score vs paid attestation |
| 6 | First customers | Wait for 2–3 real protocols + fail-closed commitment |
| 7 | Disclosure mode | Full score first; threshold proofs before scale |
| 8 | Revocation | Expiry-only for v0; active revoke if pilot needs |
| 9 | Multi-chain subject identity | Per-chain scores first; composite later if demanded |
| 10 | Issuer key ops | Multisig / HSM path + on-chain registry design |
| 11 | Flags in signed payload | Include only stable, protocol-useful flags; avoid leaking optimizable internals |
| 12 | Doc reconciliation | Align `TRUST_MODEL.md` / public docs with signal-vs-policy split before pilot marketing |

---

## 16. What ships when (summary)

**Now (design only):** this document; doctrine; boundaries; open decisions.

**Not now:** attestation contracts, issuer service, ladder dashboards, trajectory product, agent permission marketplace, monetization metering for gating.

**Next concrete work when pilots exist:**

1. Mainnet wallet calibration design (features, evaluation, version id)
2. Attestation payload freeze + EIP-712 (or chosen) signing
3. Issuer registry + verify reference
4. One protocol adapter end-to-end with fail-closed tests
5. Evidence / monitoring plan with partner

---

## 17. Doctrine appendix — language bank

**Use**

- Behavioral access infrastructure
- Behavioral risk signal
- Trust signal for access decisions
- Protocol-defined policy on TrustGate scores
- Economic authenticity
- Time-bound attestation
- One input among several risk factors

**Do not use**

- Onchain credit score / credit bureau
- Safe loan / safe collateral / approved credit line (as TrustGate claims)
- TrustGate sets your borrow limit
- Guaranteed sybil-proof
- Sole gatekeeper for protocol risk

---

## Document history

| Date | Change |
|------|--------|
| 2026-07-28 | Initial tightened design from exploration draft + design review (doctrine, attestation target, fail-closed matrix, sequencing, non-goals, open decisions) |
