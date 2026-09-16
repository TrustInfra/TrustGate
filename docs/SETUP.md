# Setup Guide — TrustGate

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.x | Runtime |
| npm | >= 9.x | Package management |
| Git | >= 2.x | Version control |

## Installation

```bash
git clone https://github.com/<your-org>/trustgate.git
cd trustgate
npm install
```

## Environment Configuration

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Required for Arc mainnet deployment:

```
PRIVATE_KEY=<your-deployer-private-key>
```

Optional overrides:

```
ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.io
ETHERSCAN_API_KEY=<for-contract-verification>
```

## Local Development

### Compile contracts

```bash
npx hardhat compile
```

### Run tests

```bash
npx hardhat test
```

Tests use `MockTrustScoring` (no FHE dependency) and `MockUSDC` (6-decimal ERC-20)
so the full suite runs on vanilla Hardhat without a coprocessor.

### Test coverage

```bash
npx hardhat coverage
```

## Arc Mainnet

### Network Details

| Property | Value |
|----------|-------|
| Network Name | Arc |
| RPC URL | https://rpc.mainnet.arc.io |
| Chain ID | 5042 |
| Native Gas Token | USDC (18 decimals native, 6 decimals ERC-20) |
| USDC ERC-20 Address | `0x3600000000000000000000000000000000000000` |
| EURC Address | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` |
| Block Explorer | https://explorer.arc.io |

### Important: USDC Decimals

USDC is the native gas token on Arc. The native balance uses **18 decimals**,
but the ERC-20 interface uses **6 decimals**. All contracts use the ERC-20
interface exclusively. Never mix native balance reads with ERC-20 amounts.

### Deploy to Arc Mainnet

Fund the deployer with real Arc Mainnet USDC (gas). Then:

```bash
npx hardhat run scripts/deploy-arc.ts --network arcMainnet
```

The script deploys:
1. **TrustScoringPlaintext** — plaintext scoring (no FHE on Arc)
2. **AgentRegistry** — permissionless agent registration
3. **TrustGate** — trust-gated USDC payment gateway

Then wires them together, deploys SubjectStake, and exports addresses to `deployments/arcMainnet-addresses.json`.

### Verify (optional)

```bash
npx hardhat verify --network arcMainnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS...>
```

## Contract Interactions

### Register an agent

```typescript
const registry = await ethers.getContractAt("AgentRegistry", REGISTRY_ADDRESS);
await registry.registerAgent(agentWallet, "ipfs://metadata");
```

### Set a trust score

```typescript
const scoring = await ethers.getContractAt("TrustScoringPlaintext", SCORING_ADDRESS);
await scoring.setTrustScore(agentWallet, 85); // HIGH tier (>= 75)
```

### Deposit USDC and set allowance

```typescript
const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);
const gate = await ethers.getContractAt("TrustGate", GATE_ADDRESS);

await usdc.approve(GATE_ADDRESS, amount);
await gate.deposit(amount);
await gate.setAllowance(agentWallet, amount);
```

### Agent claims USDC

```typescript
// Called by the agent wallet
await gate.connect(agentSigner).claim(depositorAddress, amount);
// HIGH tier: instant transfer
// MEDIUM tier: creates time-locked claim (24h)
// LOW tier: creates escrowed claim (depositor must approve)
```

## Project Scripts

| Script | Description |
|--------|-------------|
| `npx hardhat compile` | Compile Solidity contracts |
| `npx hardhat test` | Run all tests |
| `npx hardhat run scripts/deploy-arc.ts --network arcMainnet` | Deploy to Arc mainnet |
| `npx hardhat clean` | Remove build artifacts |
| `npx hardhat coverage` | Generate test coverage report |
