import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const ADDRS = {
  TrustScoringPlaintext: "0x1c0fDF6Bcf927824113271FccECb007fC43B41ee",
  AgentRegistry: "0xF27f123D4b3148811d65E4b8AF02bf0767e944e5",
  TrustGate: "0xD7f66981364be30D42D7cA5373d690FEa1045628",
};

const MIN_MAX_FEE = ethers.parseUnits("50", "gwei");
const MIN_PRIORITY_FEE = ethers.parseUnits("2", "gwei");

async function main() {
  const [signer] = await ethers.getSigners();
  if (Number((await ethers.provider.getNetwork()).chainId) !== 5042) {
    throw new Error("Use --network arcMainnet");
  }
  const deployed = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "deployments", "arcMainnet-addresses.json"),
      "utf8"
    )
  );
  const abi = [
    "function acceptOwnership()",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
  ];
  const overrides = {
    maxFeePerGas: MIN_MAX_FEE,
    maxPriorityFeePerGas: MIN_PRIORITY_FEE,
  };
  const list: [string, string][] = [
    ["TrustScoringPlaintext", ADDRS.TrustScoringPlaintext],
    ["AgentRegistry", ADDRS.AgentRegistry],
    ["TrustGate", ADDRS.TrustGate],
    ["SubjectStake", deployed.contracts.SubjectStake],
  ];
  console.log(`Acceptor ${signer.address}`);
  for (const [name, addr] of list) {
    const c = new ethers.Contract(addr, abi, signer);
    const pending = await c.pendingOwner();
    if (pending.toLowerCase() !== signer.address.toLowerCase()) {
      throw new Error(`${name} pendingOwner is ${pending}, not ${signer.address}`);
    }
    const tx = await c.acceptOwnership(overrides);
    await tx.wait();
    console.log(`${name} owner now ${await c.owner()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
