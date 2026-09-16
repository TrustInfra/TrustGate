import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Arc deployment. Uses TrustScoringPlaintext (no FHE).
 *
 *   npx hardhat run scripts/deploy-arc.ts --network arcMainnet
 *   npx hardhat run scripts/deploy-arc.ts --network arcTestnet
 *
 * Arc mempool drops txs with maxFeePerGas below 20 gwei.
 */
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const MIN_MAX_FEE = ethers.parseUnits("50", "gwei");
const MIN_PRIORITY_FEE = ethers.parseUnits("2", "gwei");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  const isMainnet = chainId === 5042;
  const networkName = isMainnet ? "arcMainnet" : "arcTestnet";
  const explorer = isMainnet
    ? "https://explorer.arc.io"
    : "https://explorer.testnet.arc.io";

  if (chainId !== 5042 && chainId !== 5042002) {
    throw new Error(`Unexpected chainId ${chainId}. Use arcMainnet or arcTestnet.`);
  }

  const overrides = {
    maxFeePerGas: MIN_MAX_FEE,
    maxPriorityFeePerGas: MIN_PRIORITY_FEE,
  };

  console.log("=".repeat(60));
  console.log(`  TrustGate — ${networkName} Deployment`);
  console.log("=".repeat(60));
  console.log(`  Network : ${networkName} (chainId: ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  USDC    : ${ARC_USDC}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance : ${ethers.formatUnits(balance, 18)} USDC (native 18-dec)`);
  console.log("");

  if (balance === 0n) {
    throw new Error(
      isMainnet
        ? "Deployer has zero balance. Fund with real Arc Mainnet USDC for gas."
        : "Deployer has zero balance. Get USDC from https://faucet.circle.com"
    );
  }

  console.log("  [1/4] Deploying TrustScoringPlaintext...");
  const TrustScoringFactory = await ethers.getContractFactory("TrustScoringPlaintext");
  const trustScoring = await TrustScoringFactory.deploy(deployer.address, overrides);
  await trustScoring.waitForDeployment();
  const trustScoringAddr = await trustScoring.getAddress();
  console.log(`  TrustScoringPlaintext: ${trustScoringAddr}`);
  console.log("");

  console.log("  [2/4] Deploying AgentRegistry...");
  const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
  const agentRegistry = await AgentRegistryFactory.deploy(deployer.address, overrides);
  await agentRegistry.waitForDeployment();
  const agentRegistryAddr = await agentRegistry.getAddress();
  console.log(`  AgentRegistry: ${agentRegistryAddr}`);
  console.log("");

  console.log("  [3/4] Deploying TrustGate...");
  const TrustGateFactory = await ethers.getContractFactory("TrustGate");
  const trustGate = await TrustGateFactory.deploy(
    ARC_USDC,
    trustScoringAddr,
    agentRegistryAddr,
    deployer.address,
    overrides
  );
  await trustGate.waitForDeployment();
  const trustGateAddr = await trustGate.getAddress();
  console.log(`  TrustGate: ${trustGateAddr}`);
  console.log("");

  console.log("  [4/4] Deploying SubjectStake...");
  const StakeFactory = await ethers.getContractFactory("SubjectStake");
  const subjectStake = await StakeFactory.deploy(ARC_USDC, deployer.address, overrides);
  await subjectStake.waitForDeployment();
  const subjectStakeAddr = await subjectStake.getAddress();
  console.log(`  SubjectStake: ${subjectStakeAddr}`);
  console.log("");

  console.log("  Wiring contracts...");
  const tx1 = await trustScoring.setAgentRegistry(agentRegistryAddr, overrides);
  await tx1.wait();
  const tx2 = await trustScoring.setOracle(deployer.address, true, overrides);
  await tx2.wait();
  console.log("");

  const addresses = {
    network: networkName,
    chainId,
    deployer: deployer.address,
    contracts: {
      TrustScoringPlaintext: trustScoringAddr,
      AgentRegistry: agentRegistryAddr,
      TrustGate: trustGateAddr,
      SubjectStake: subjectStakeAddr,
      USDC: ARC_USDC,
    },
    deployedAt: new Date().toISOString(),
  };

  const outputDir = path.resolve(__dirname, "..", "deployments");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputFile = path.join(outputDir, `${networkName}-addresses.json`);
  fs.writeFileSync(outputFile, JSON.stringify(addresses, null, 2));

  console.log("  Deployment complete.");
  console.log("=".repeat(60));
  console.log(`    TrustScoringPlaintext : ${trustScoringAddr}`);
  console.log(`    AgentRegistry         : ${agentRegistryAddr}`);
  console.log(`    TrustGate             : ${trustGateAddr}`);
  console.log(`    SubjectStake          : ${subjectStakeAddr}`);
  console.log(`    USDC (ERC-20)         : ${ARC_USDC}`);
  console.log(`  Explorer: ${explorer}`);
  console.log(`  Exported: ${outputFile}`);
  console.log("=".repeat(60));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
