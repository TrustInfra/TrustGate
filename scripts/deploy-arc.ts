import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Arc Testnet deployment script.
 * Uses TrustScoringPlaintext (no FHE) since Arc lacks Zama coprocessor.
 *
 * Run: npx hardhat run scripts/deploy-arc.ts --network arcTestnet
 */
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(60));
  console.log("  TrustGate — Arc Testnet Deployment");
  console.log("=".repeat(60));
  console.log(`  Network : arcTestnet (chainId: ${network.chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  USDC    : ${ARC_TESTNET_USDC}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance : ${ethers.formatUnits(balance, 18)} USDC (native 18-dec)`);
  console.log("");

  if (balance === 0n) {
    throw new Error("Deployer has zero balance. Get USDC from https://faucet.circle.com");
  }

  // ── 1. TrustScoringPlaintext ─────────────────────────────────
  console.log("  [1/3] Deploying TrustScoringPlaintext...");
  const TrustScoringFactory = await ethers.getContractFactory("TrustScoringPlaintext");
  const trustScoring = await TrustScoringFactory.deploy(deployer.address);
  await trustScoring.waitForDeployment();
  const trustScoringAddr = await trustScoring.getAddress();
  console.log(`  TrustScoringPlaintext: ${trustScoringAddr}`);
  console.log("");

  // ── 2. AgentRegistry ─────────────────────────────────────────
  console.log("  [2/3] Deploying AgentRegistry...");
  const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistryFactory.deploy(deployer.address);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log(`  AgentRegistry: ${agentRegistryAddr}`);
  console.log("");

  // ── 3. TrustGate ─────────────────────────────────────────────
  console.log("  [3/3] Deploying TrustGate...");
  const TrustGateFactory = await ethers.getContractFactory("TrustGate");
  const trustGate = await TrustGateFactory.deploy(
    ARC_TESTNET_USDC,
    trustScoringAddr,
    agentRegistryAddr,
    deployer.address
  );
  await trustGate.waitForDeployment();
  const trustGateAddr = await trustGate.getAddress();
  console.log(`  TrustGate: ${trustGateAddr}`);
  console.log("");

  // ── Wire-up ──────────────────────────────────────────────────
  console.log("  Wiring contracts...");

  console.log("  Setting AgentRegistry on TrustScoring...");
  const tx1 = await trustScoring.setAgentRegistry(agentRegistryAddr);
  await tx1.wait();
  console.log(`  Tx: ${tx1.hash}`);

  console.log("  Authorizing deployer as oracle...");
  const tx2 = await trustScoring.setOracle(deployer.address, true);
  await tx2.wait();
  console.log(`  Tx: ${tx2.hash}`);
  console.log("");

  // ── Export addresses ─────────────────────────────────────────
  const addresses = {
    network: "arcTestnet",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    contracts: {
      TrustScoringPlaintext: trustScoringAddr,
      AgentRegistry: agentRegistryAddr,
      TrustGate: trustGateAddr,
      USDC: ARC_TESTNET_USDC,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.resolve(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputFile = path.join(outputDir, "arcTestnet-addresses.json");
  fs.writeFileSync(outputFile, JSON.stringify(addresses, null, 2));

  console.log("  Deployment complete.");
  console.log("=".repeat(60));
  console.log("");
  console.log("  Addresses:");
  console.log(`    TrustScoringPlaintext : ${trustScoringAddr}`);
  console.log(`    AgentRegistry         : ${agentRegistryAddr}`);
  console.log(`    TrustGate             : ${trustGateAddr}`);
  console.log(`    USDC (ERC-20)         : ${ARC_TESTNET_USDC}`);
  console.log("");
  console.log(`  Explorer: https://testnet.arcscan.app`);
  console.log(`  Exported: ${outputFile}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
