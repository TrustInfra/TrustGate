import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";
import "dotenv/config";

// ── Environment variables (loaded from .env) ─────────────────────────
const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL ?? "https://rpc.sepolia.org";
const MAINNET_RPC_URL =
  process.env.MAINNET_RPC_URL ?? "https://eth.llamarpc.com";
const ARC_TESTNET_RPC_URL =
  process.env.ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY ?? "";

// Validate private key format for live networks
const liveAccounts: string[] =
  PRIVATE_KEY.length >= 64
    ? [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : `0x${PRIVATE_KEY}`]
    : [];

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun",
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: liveAccounts,
      chainId: 11155111,
    },
    mainnet: {
      url: MAINNET_RPC_URL,
      accounts: liveAccounts,
      chainId: 1,
    },
    arcTestnet: {
      url: ARC_TESTNET_RPC_URL,
      accounts: liveAccounts,
      chainId: 5042002,
    },
  },
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      arcTestnet: ETHERSCAN_API_KEY,
    },
    customChains: [
      {
        network: "arcTestnet",
        chainId: 5042002,
        urls: {
          apiURL: "https://testnet.arcscan.app/api",
          browserURL: "https://testnet.arcscan.app",
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
  },
};

export default config;
