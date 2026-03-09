# Setup Guide — Trusted PayGram

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | >= 18.x | Runtime |
| npm | >= 9.x | Package management |
| Git | >= 2.x | Version control |
| MetaMask | Latest | Browser wallet for Sepolia interaction |

## Installation

```bash
git clone https://github.com/<your-org>/trusted-paygram.git
cd trusted-paygram
npm install
```

## Environment Configuration

Trusted PayGram uses a `.env` file with `dotenv/config`. Copy the example and fill in your values:

```bash
cp .env.example .env
```

Required variables for Sepolia / Mainnet deployment:

```
PRIVATE_KEY=<your-deployer-private-key>
SEPOLIA_RPC_URL=<your-sepolia-rpc-url>
ETHERSCAN_API_KEY=<your-etherscan-api-key>
```

> **Note:** For local development only (Hardhat network), you do not need to set any variables.

## Local Development

### Compile contracts

```bash
npm run compile
```

### Run the test suite

```bash
npm test
```

### Start a local Hardhat node

```bash
npm run node
```

### Deploy to localhost

In a separate terminal (while the node is running):

```bash
npm run deploy:localhost
```

The deploy script will print all contract addresses.

## Sepolia Testnet Deployment

### 1. Get Sepolia ETH

Visit a Sepolia faucet to obtain test ETH for your deployer address:
- https://sepoliafaucet.com
- https://faucets.chain.link/sepolia

### 2. Configure `.env`

Ensure `PRIVATE_KEY`, `SEPOLIA_RPC_URL`, and `ETHERSCAN_API_KEY` are set in your `.env` file.

### 3. Deploy

```bash
npx hardhat run scripts/deploy-sepolia.ts --network sepolia
```

### 4. Verify on Etherscan (optional)

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <CONSTRUCTOR_ARGS...>
```

## MetaMask Configuration

To interact with deployed contracts on Sepolia:

1. Open MetaMask and switch to the **Sepolia** test network
2. Import the `cPAY` token:
   - Click "Import tokens"
   - Paste the deployed `PayGramToken` contract address
   - Symbol: `cPAY`
   - Decimals: `18`

> **Note:** Because cPAY uses encrypted balances (ERC-7984), MetaMask will not display the actual balance.  Use the frontend application or direct contract calls with FHE decryption to view balances.

## Project Scripts

| Script | Description |
|--------|-------------|
| `npm run compile` | Compile Solidity contracts |
| `npm test` | Run all tests |
| `npm run node` | Start local Hardhat node |
| `npm run deploy:localhost` | Deploy to local node |
| `npm run deploy:sepolia` | Deploy to Sepolia testnet |
| `npm run clean` | Remove build artifacts |
| `npm run lint` | Lint Solidity files |
| `npm run coverage` | Generate test coverage report |

## Troubleshooting

### "Cannot find module @fhevm/solidity"

Make sure you have installed dependencies:

```bash
npm install
```

If the issue persists, clear the cache and reinstall:

```bash
npm run clean
rm -rf node_modules package-lock.json
npm install
```

### Hardhat compilation errors with FHEVM

Ensure your Solidity version is set to `0.8.27` with `evmVersion: "cancun"` in `hardhat.config.ts`. Note: `@fhevm/solidity` has no Hardhat plugin -- do not import `@fhevm/solidity/hardhat`.

### "Nonce too high" on Sepolia

Reset your MetaMask account nonce:
1. MetaMask → Settings → Advanced → Clear activity tab data

### Local node tests failing

The local Hardhat node does not include the FHE coprocessor.  Some FHE operations will only work on networks with the Zama coprocessor deployed (Sepolia with Zama gateway).  Unit tests should mock FHE operations where necessary.
