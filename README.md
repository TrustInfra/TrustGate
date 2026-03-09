<div align="center">

# Trusted PayGram

**Confidential Trust-Gated Payroll on Zama FHEVM**

Encrypted salaries. On-chain reputation. Zero data leakage.

[![Built with Zama](https://img.shields.io/badge/Built_with-Zama_FHEVM-7B3FE4?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiPjxyZWN0IHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgcng9IjQiIGZpbGw9IiM3QjNGRTQiLz48L3N2Zz4=)](https://docs.zama.ai/fhevm)
[![ERC-7984](https://img.shields.io/badge/ERC--7984-Confidential_Token-3C3C3D?style=flat-square)](https://eips.ethereum.org/EIPS/eip-7984)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.27-363636?style=flat-square&logo=solidity)](https://soliditylang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Architecture](#architecture) &#8226; [Quick Start](#quick-start) &#8226; [Deployed Contracts](#deployed-contracts) &#8226; [Privacy Model](#privacy-model) &#8226; [Tech Stack](#tech-stack)

</div>

---

## What Is This?

Traditional payroll systems expose sensitive financial data at every layer. Employers see everyone's salary. Payment processors see transaction amounts. Blockchains make it worse: every balance and transfer is public by default.

**Trusted PayGram** solves this with Fully Homomorphic Encryption. Salaries, trust scores, and payment amounts are encrypted end-to-end. The smart contracts compute on ciphertext directly. Nobody sees the numbers, but the math still works.

The system adds a second layer: **trust-gated payment routing**. Each employee has an encrypted reputation score derived from EigenTrust. High-trust employees receive instant payments. Medium-trust employees have a 24-hour delay. Low-trust or new employees go through milestone-gated escrow. The routing decision happens entirely under encryption.

---

## Architecture

```
                              ┌──────────────────────────┐
                              │     Oracle Network       │
                              │   (EigenTrust Scores)    │
                              └────────────┬─────────────┘
                                           │ setTrustScore(encrypted)
                                           v
┌──────────────┐  executePayroll   ┌───────────────────┐  isHighTrust?   ┌──────────────────────┐
│   Employer   │──────────────────>│   PayGramCore     │────────────────>│   TrustScoring       │
│   Dashboard  │                   │  (Payroll Engine)  │<────────────────│  (FHE Tier Eval)     │
└──────────────┘                   └─────────┬─────────┘   ebool result  └──────────────────────┘
                                             │
                              ┌──────────────┼──────────────┐
                              │              │              │
                         HIGH tier      MEDIUM tier     LOW tier
                        (instant)      (24h delay)     (escrow)
                              │              │              │
                              v              v              v
                     ┌──────────────────────────────────────────┐
                     │          PayGramToken (cPAY)             │
                     │       ERC-7984 Confidential Token        │
                     │     Encrypted balances & transfers       │
                     └──────────────────────────────────────────┘
                              │              │              │
                              v              v              v
                     ┌──────────────────────────────────────────┐
                     │      Zama FHE Coprocessor (Sepolia)      │
                     │  ACL · TFHEExecutor · KMSVerifier        │
                     └──────────────────────────────────────────┘
```

Three contracts, one coprocessor, zero plaintext.

---

## Trust-Gated Payment Flows

| Tier | Score Range | Routing | Release Mechanism |
|:-----|:-----------|:--------|:------------------|
| **HIGH** | 75 - 100 | Instant encrypted transfer | Immediate |
| **MEDIUM** | 40 - 74 | 24-hour delayed release | Automatic after time lock |
| **LOW** | 0 - 39 | Milestone-gated escrow | Manual employer approval |
| **Unscored** | N/A | Defaults to escrow | Manual employer approval |

The routing decision is fully oblivious. All three payment paths execute on every payroll run, but only the correct path carries a non-zero encrypted amount:

```solidity
function _processWithTrustTier(Employee storage emp) internal {
    ebool isHigh = trustScoring.isHighTrust(emp.wallet);
    ebool isMed  = trustScoring.isMediumTrust(emp.wallet);

    euint64 zero = FHE.asEuint64(0);

    // Oblivious routing: exactly one path carries the salary
    euint64 instantAmt = FHE.select(isHigh, emp.encryptedSalary, zero);
    euint64 remaining  = FHE.sub(emp.encryptedSalary, instantAmt);
    euint64 delayedAmt = FHE.select(isMed, remaining, zero);
    euint64 escrowAmt  = FHE.sub(remaining, delayedAmt);

    _processInstantPayment(emp.wallet, instantAmt);
    _processDelayedPayment(emp.wallet, delayedAmt);
    _processEscrowPaymentEncrypted(emp.wallet, escrowAmt);
}
```

No `if` statements. No branching on decrypted values. The coprocessor evaluates `FHE.select` on ciphertext, and the chain never learns which tier an employee belongs to.

---

## Quick Start

### Prerequisites

- Node.js >= 18
- MetaMask or compatible wallet
- Sepolia ETH for gas ([faucet](https://sepoliafaucet.com))

### Run the Frontend

```bash
git clone https://github.com/rudazy/Trusted-paygram.git
cd Trusted-paygram/frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and connect your wallet to Sepolia.

### Deploy Your Own

```bash
# Install dependencies
cd Trusted-paygram
npm install

# Configure environment
cp .env.example .env
# Edit .env with your PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY

# Compile contracts
npx hardhat compile

# Deploy to Sepolia
npx hardhat run scripts/deploy-sepolia.ts --network sepolia

# Verify on Etherscan
npx hardhat verify --network sepolia <ADDRESS> <CONSTRUCTOR_ARGS>
```

See [docs/SETUP.md](docs/SETUP.md) for detailed configuration.

---

## Deployed Contracts

> **Ethereum Mainnet** &mdash; deployed 2026-02-28

| Contract | Address | Etherscan |
|:---------|:--------|:----------|
| **TrustScoring** | `0xaa3ae25ebac250ff67f4d9e3195c4c7610055067` | [View](https://etherscan.io/address/0xaa3ae25ebac250ff67f4d9e3195c4c7610055067#code) |
| **PayGramToken** | `0x41fa55cefd625e50fa1ae08baea87ac5c8be0ad7` | [View](https://etherscan.io/address/0x41fa55cefd625e50fa1ae08baea87ac5c8be0ad7#code) |
| **PayGramCore** | `0xDC41FF140129846f7a2e63A5CcE73e9d767CB4e1` | [View](https://etherscan.io/address/0xDC41FF140129846f7a2e63A5CcE73e9d767CB4e1#code) |

> **Sepolia Testnet** &mdash; deployed 2026-03-09 (v5: plaintextSalaries)

| Contract | Address | Etherscan |
|:---------|:--------|:----------|
| **TrustScoring** | `0x195dc8309F1b26BF6f5c568024E4060029233596` | [View](https://sepolia.etherscan.io/address/0x195dc8309F1b26BF6f5c568024E4060029233596#code) |
| **PayGramToken** | `0x18572E79806bc3caAEeE52d81c0A7A4D86faeD6f` | [View](https://sepolia.etherscan.io/address/0x18572E79806bc3caAEeE52d81c0A7A4D86faeD6f#code) |
| **PayGramCore** | `0x370B4F9917b65f36CAe01754c14829408bfAf7fd` | [View](https://sepolia.etherscan.io/address/0x370B4F9917b65f36CAe01754c14829408bfAf7fd#code) |

All contracts are verified with source code on Etherscan.

---

## Privacy Model

### What's Encrypted

- [x] Employee salary amounts (stored as `euint64`)
- [x] Trust reputation scores (stored as `euint64`)
- [x] Trust tier classification (computed via `FHE.select`, never decrypted on-chain)
- [x] Token balances (ERC-7984 encrypted balances)
- [x] Transfer amounts (confidential transfers between contract and employees)
- [x] Payment routing decision (oblivious branching, no plaintext conditionals)

### Who Can See What

| Data | Employer | Employee | Public | Contract |
|:-----|:--------:|:--------:|:------:|:--------:|
| Salary amount | Granted | Own only | No | Yes |
| Trust score | Granted | Own only | No | Yes |
| Trust tier | No | No | No | Computed |
| Token balance | No | Own only | No | Yes |
| Payment status | Yes | Own only | Event only | Yes |
| Employee roster | Yes | No | Events | Yes |
| Payment timing | Yes | Own only | Events | Yes |

"Granted" means the address holds an FHE decryption grant issued via `FHE.allow()`. "Computed" means the value is used in encrypted computation but never materialized as plaintext.

---

## Tech Stack

| Layer | Technology | Purpose |
|:------|:-----------|:--------|
| Smart Contracts | Solidity 0.8.27 | Contract logic |
| FHE Runtime | Zama FHEVM v0.9 | Encrypted computation on-chain |
| Token Standard | ERC-7984 | Confidential token with encrypted balances |
| Access Control | OpenZeppelin Confidential Contracts | ObserverAccess, Ownable2Step, Pausable |
| Framework | Hardhat + TypeScript | Compilation, testing, deployment |
| Frontend | Next.js 14 (App Router) | Employer dashboard, employee portal |
| Styling | Tailwind CSS | Glassmorphism UI with custom theme |
| Wallet | ethers.js v6 | MetaMask integration, contract calls |
| FHE Client | fhevmjs | Client-side encryption for encrypted inputs |

---

## Project Structure

```
contracts/
  TrustScoring.sol          Encrypted trust score storage and tier evaluation
  PayGramCore.sol           Payroll engine with trust-gated payment routing
  PayGramToken.sol          ERC-7984 confidential token (cPAY)

frontend/
  src/
    app/                    Next.js pages (landing, employer, employee)
    components/
      employer/             AddEmployee, EmployeeList, ExecutePayroll, PayrollHistory
      employee/             SalaryView, PaymentHistory
      wallet/               ConnectButton (4-state: no wallet, connecting, wrong network, connected)
      layout/               Navbar, Footer, NetworkBanner
      ui/                   GlassCard, Button, Badge, StatusDot, TrustBadge, Tabs, Dialog
    hooks/                  useWallet, useFHE, useContracts
    lib/                    constants, contracts, fhe, mockData, utils
    providers/              Web3Provider (wallet + FHE + contracts context)

scripts/
  deploy-sepolia.ts         Deployment script (ethers-based, single-key)

test/
  TrustScoring.test.ts      46 passing, 35 FHE-pending
  PayGramCore.test.ts        52 passing, 38 FHE-pending
  integration.test.ts       41 passing, 30 FHE-pending

docs/
  ARCHITECTURE.md           System design and data flows
  TRUST_MODEL.md            EigenTrust adaptation and privacy model
  SETUP.md                  Installation and deployment guide
```

---

## Testing

```bash
# Run all tests
npm test

# Run with gas reporting
REPORT_GAS=true npm test

# Run specific test file
npx hardhat test test/TrustScoring.test.ts

# Run only non-FHE tests (no coprocessor needed)
npx hardhat test --grep "should"
```

Tests are structured with a `try/catch + this.skip()` pattern: non-FHE logic runs on vanilla Hardhat, and FHE-dependent tests are automatically skipped when the coprocessor is unavailable.

**119 tests passing** (107 FHE-pending, awaiting coprocessor integration).

---

## Key Innovations

1. **Oblivious payment routing** &mdash; Trust tier evaluation and salary routing happen entirely under FHE. The contract executes all three payment paths on every payroll run; `FHE.select` ensures only the correct path carries value. No observer can determine which tier an employee falls into.

2. **EigenTrust reputation on-chain** &mdash; Encrypted reputation scores are submitted by authorized oracles and stored as `euint64`. Tier boundaries are evaluated with `FHE.ge` comparisons that never reveal the underlying score, even to the contract owner.

3. **Batch payroll with bounded gas** &mdash; A single `executePayroll()` processes up to 50 employees per transaction. Each employee requires exactly 3 FHE operations for tier evaluation plus 3 payment record writes, keeping gas predictable.

4. **ERC-7984 observer access** &mdash; The `ObserverAccess` extension allows employers to set an observer on employee token accounts for payroll auditing. Observers can verify encrypted disbursements without accessing other employees' data.

5. **Escrow with milestone gating** &mdash; Low-trust and unscored employees receive payments into escrow. The employer must explicitly approve release, providing a dispute resolution mechanism without exposing payment amounts.

---

## Roadmap

- [x] TrustScoring contract with encrypted tier evaluation
- [x] PayGramCore payroll engine with oblivious routing
- [x] PayGramToken (ERC-7984) with supply cap, pause, observer access
- [x] Full test suite (119 passing, 107 FHE-pending)
- [x] Deployment to Sepolia with Etherscan verification
- [x] Frontend: employer dashboard, employee portal, wallet connection
- [x] Network switching UX (Sepolia auto-switch, wrong network banner)
- [x] Live FHE encryption in frontend via fhevmjs
- [ ] Oracle integration for real EigenTrust score submission
- [x] Multi-employer support (any wallet can register, manage employees independently)
- [ ] Payment release automation (keeper-compatible delayed releases)
- [ ] Mainnet deployment

---

<div align="center">

Built by [**Ludarep**](https://github.com/rudazy)

[Zama FHEVM](https://docs.zama.ai/fhevm) &#8226; [ERC-7984](https://eips.ethereum.org/EIPS/eip-7984) &#8226; [OpenZeppelin Confidential Contracts](https://github.com/OpenZeppelin/openzeppelin-contracts/tree/master/contracts) &#8226; [EigenTrust](https://nlp.stanford.edu/pubs/eigentrust.pdf)

</div>
