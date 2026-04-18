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

Required for Arc testnet deployment:

```
PRIVATE_KEY=<your-deployer-private-key>
```

Optional overrides:

```
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
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

## Arc Testnet

### Network Details

| Property | Value |
|----------|-------|
| Network Name | Arc Testnet |
| RPC URL | https://rpc.testnet.arc.network |
| Chain ID | 5042002 |
| Native Gas Token | USDC (18 decimals native, 6 decimals ERC-20) |
| USDC ERC-20 Address | `0x3600000000000000000000000000000000000000` |
| EURC Address | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| Block Explorer | https://testnet.arcscan.app |
| Faucet | https://faucet.circle.com (select Arc Testnet + USDC) |

### Important: USDC Decimals

USDC is the native gas token on Arc. The native balance uses **18 decimals**,
but the ERC-20 interface uses **6 decimals**. All contracts use the ERC-20
interface exclusively. Never mix native balance reads with ERC-20 amounts.

### Get Testnet USDC

1. Visit https://faucet.circle.com
2. Select **Arc Testnet** and **USDC**
3. Enter your deployer wallet address
4. Request funds

### Deploy to Arc Testnet

```bash
npx hardhat run scripts/deploy-arc.ts --network arcTestnet
```

The script deploys:
1. **TrustScoringPlaintext** — plaintext scoring (no FHE on Arc)
2. **AgentRegistry** — permissionless agent registration
3. **TrustGate** — trust-gated USDC payment gateway

Then wires them together and exports addresses to `deployments/arcTestnet-addresses.json`.

### Current Deployment

| Contract | Address |
|----------|---------|
| TrustScoringPlaintext | `0xEb979Dc25396ba4be6cEA41EAfEa894C55772246` |
| AgentRegistry | `0x73d3cf7f2734C334927f991fe87D06d595d398b4` |
| TrustGate | `0x52E17bC482d00776d73811680CbA9914e83E33CC` |
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` |

### Verify on Arcscan (optional)

```bash
npx hardhat verify --network arcTestnet <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS...>
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
| `npx hardhat run scripts/deploy-arc.ts --network arcTestnet` | Deploy to Arc testnet |
| `npx hardhat clean` | Remove build artifacts |
| `npx hardhat coverage` | Generate test coverage report |
