import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import * as fs from "fs";
import * as path from "path";

/**
 * Arc Testnet USDC (ERC-20 interface).
 * USDC is the native gas token on Arc. Native balance uses 18 decimals,
 * but the ERC-20 interface uses 6 decimals. Always use this address
 * for balance reads and transfers.
 */
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

const deployAll: DeployFunction = async function (
  hre: HardhatRuntimeEnvironment
) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  const isLive =
    hre.network.name !== "hardhat" && hre.network.name !== "localhost";
  const confirmations = isLive ? 2 : 0;

  log("=".repeat(60));
  log("  TrustGate — Deployment");
  log("=".repeat(60));
  log(`  Network : ${hre.network.name} (chainId: ${hre.network.config.chainId})`);
  log(`  Deployer: ${deployer}`);
  log("");

  // ── Resolve USDC address ─────────────────────────────────────
  let usdcAddress: string;

  if (hre.network.name === "arcTestnet") {
    usdcAddress = ARC_TESTNET_USDC;
    log(`  USDC (Arc Testnet ERC-20): ${usdcAddress}`);
  } else if (isLive) {
    usdcAddress = process.env.USDC_ADDRESS ?? "";
    if (!usdcAddress) {
      throw new Error(
        "USDC_ADDRESS env var required for live network deployment"
      );
    }
    log(`  USDC (env): ${usdcAddress}`);
  } else {
    // Local network: deploy a mock USDC
    log("  [0/5] Deploying MockUSDC for local testing...");
    const mockUsdc = await deploy("MockUSDC", {
      from: deployer,
      args: [],
      log: true,
      waitConfirmations: 0,
    });
    usdcAddress = mockUsdc.address;
    log(`  MockUSDC deployed at: ${usdcAddress}`);
  }
  log("");

  // ── 1. TrustScoring ──────────────────────────────────────────
  // Use TrustScoringPlaintext on chains without the Zama FHE coprocessor.
  // FHE-enabled TrustScoring requires ZamaEthereumConfig which only supports
  // specific chain IDs (Ethereum mainnet, Sepolia, Zama devnet).
  const useFHE = hre.network.config.chainId === 1 ||
    hre.network.config.chainId === 11155111;
  const scoringContract = useFHE ? "TrustScoring" : "TrustScoringPlaintext";

  log(`  [1/5] Deploying ${scoringContract}...`);
  const trustScoring = await deploy(scoringContract, {
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: confirmations,
  });
  log(`  ${scoringContract} deployed at: ${trustScoring.address}`);
  log("");

  // ── 2. AgentRegistry ────────────────────────────────────────
  log("  [2/5] Deploying AgentRegistry...");
  const agentRegistry = await deploy("AgentRegistry", {
    from: deployer,
    args: [deployer],
    log: true,
    waitConfirmations: confirmations,
  });
  log(`  AgentRegistry deployed at: ${agentRegistry.address}`);
  log("");

  // ── 3. TrustGate ────────────────────────────────────────────
  log("  [3/5] Deploying TrustGate...");
  const trustGate = await deploy("TrustGate", {
    from: deployer,
    args: [
      usdcAddress,
      trustScoring.address,
      agentRegistry.address,
      deployer,
    ],
    log: true,
    waitConfirmations: confirmations,
  });
  log(`  TrustGate deployed at: ${trustGate.address}`);
  log("");

  // ── 4. Wire contracts ───────────────────────────────────────
  log("  [4/5] Wiring contracts...");

  // 4a. Set AgentRegistry on TrustScoring
  const trustContract = await hre.ethers.getContractAt(
    scoringContract,
    trustScoring.address
  );
  const currentRegistry = await trustContract.agentRegistry();
  if (currentRegistry !== agentRegistry.address) {
    const tx1 = await trustContract.setAgentRegistry(agentRegistry.address);
    const receipt1 = await tx1.wait();
    log(`  TrustScoring.setAgentRegistry -> ${agentRegistry.address}`);
    log(`  Tx: ${receipt1?.hash}`);
  } else {
    log(`  TrustScoring.agentRegistry already set`);
  }

  // 4b. Authorize deployer as oracle on TrustScoring
  const isDeployerOracle = await trustContract.authorizedOracles(deployer);
  if (!isDeployerOracle) {
    const tx2 = await trustContract.setOracle(deployer, true);
    const receipt2 = await tx2.wait();
    log(`  TrustScoring: deployer authorized as oracle`);
    log(`  Tx: ${receipt2?.hash}`);
  } else {
    log(`  TrustScoring: deployer already authorized as oracle`);
  }
  log("");

  // ── 5. Export deployment addresses ──────────────────────────
  log("  [5/5] Exporting addresses...");
  const addresses = {
    network: hre.network.name,
    chainId: hre.network.config.chainId,
    deployer,
    contracts: {
      TrustScoring: trustScoring.address,
      AgentRegistry: agentRegistry.address,
      TrustGate: trustGate.address,
      USDC: usdcAddress,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.resolve(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputFile = path.join(outputDir, `${hre.network.name}-addresses.json`);
  fs.writeFileSync(outputFile, JSON.stringify(addresses, null, 2));
  log(`  Addresses exported to: ${outputFile}`);

  log("");
  log("  Deployment complete.");
  log("=".repeat(60));
  log("");
  log("  Summary:");
  log(`    USDC          : ${usdcAddress}`);
  log(`    TrustScoring  : ${trustScoring.address}`);
  log(`    AgentRegistry : ${agentRegistry.address}`);
  log(`    TrustGate     : ${trustGate.address}`);
  log("=".repeat(60));
};

deployAll.tags = ["all", "TrustScoring", "AgentRegistry", "TrustGate"];
export default deployAll;
