import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ARC_USDC = "0x3600000000000000000000000000000000000000";
const MIN_MAX_FEE = ethers.parseUnits("50", "gwei");
const MIN_PRIORITY_FEE = ethers.parseUnits("2", "gwei");

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 5042) {
    throw new Error(`Expected Arc Mainnet 5042, got ${network.chainId}`);
  }
  const overrides = {
    maxFeePerGas: MIN_MAX_FEE,
    maxPriorityFeePerGas: MIN_PRIORITY_FEE,
  };

  console.log(`Deployer ${deployer.address}`);
  const Factory = await ethers.getContractFactory("SubjectStake");
  const vault = await Factory.deploy(ARC_USDC, deployer.address, overrides);
  await vault.waitForDeployment();
  const addr = await vault.getAddress();
  console.log(`SubjectStake ${addr}`);

  const file = path.resolve(__dirname, "..", "deployments", "arcMainnet-addresses.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.contracts.SubjectStake = addr;
  json.subjectStakeRedeployedAt = new Date().toISOString();
  fs.writeFileSync(file, JSON.stringify(json, null, 2));
  console.log(`Updated ${file}`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
