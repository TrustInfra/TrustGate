import { ethers } from "hardhat";

/** Ops owner. Must call acceptOwnership() from this address. */
const OPS_OWNER = "0x60C05e2d820CE989E944ED4e7bb33bAEB8705c62";

const ADDRS = {
  TrustScoringPlaintext: "0x1c0fDF6Bcf927824113271FccECb007fC43B41ee",
  AgentRegistry: "0xF27f123D4b3148811d65E4b8AF02bf0767e944e5",
  TrustGate: "0xD7f66981364be30D42D7cA5373d690FEa1045628",
};

const MIN_MAX_FEE = ethers.parseUnits("50", "gwei");
const MIN_PRIORITY_FEE = ethers.parseUnits("2", "gwei");

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (Number(network.chainId) !== 5042) {
    throw new Error(`Expected Arc Mainnet 5042, got ${network.chainId}`);
  }
  const overrides = {
    maxFeePerGas: MIN_MAX_FEE,
    maxPriorityFeePerGas: MIN_PRIORITY_FEE,
  };

  const fs = await import("fs");
  const path = await import("path");
  const deployed = JSON.parse(
    fs.readFileSync(
      path.resolve(__dirname, "..", "deployments", "arcMainnet-addresses.json"),
      "utf8"
    )
  );
  const subjectStake = deployed.contracts.SubjectStake as string;

  const ownableAbi = [
    "function transferOwnership(address newOwner)",
    "function owner() view returns (address)",
    "function pendingOwner() view returns (address)",
  ];
  const scoringAbi = [
    ...ownableAbi,
    "function setOracle(address oracle, bool authorized)",
  ];

  const scoring = new ethers.Contract(
    ADDRS.TrustScoringPlaintext,
    scoringAbi,
    signer
  );
  const registry = new ethers.Contract(ADDRS.AgentRegistry, ownableAbi, signer);
  const gate = new ethers.Contract(ADDRS.TrustGate, ownableAbi, signer);
  const stake = new ethers.Contract(subjectStake, ownableAbi, signer);

  console.log(`From ${signer.address}`);
  console.log(`Pending ops owner ${OPS_OWNER}`);

  const txOracle = await scoring.setOracle(OPS_OWNER, true, overrides);
  await txOracle.wait();
  console.log(`setOracle ${OPS_OWNER} true`);

  for (const [name, c] of [
    ["TrustScoringPlaintext", scoring],
    ["AgentRegistry", registry],
    ["TrustGate", gate],
    ["SubjectStake", stake],
  ] as const) {
    const owner = await c.owner();
    console.log(`${name} owner ${owner}`);
    const tx = await c.transferOwnership(OPS_OWNER, overrides);
    await tx.wait();
    const pending = await c.pendingOwner();
    console.log(`${name} pendingOwner ${pending}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
