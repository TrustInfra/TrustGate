import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustGate, AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * TrustGate Test Suite
 *
 * Uses MockTrustScoring (no FHE dependency) and MockUSDC (6-decimal ERC-20)
 * so every test runs on vanilla Hardhat without a coprocessor.
 */
describe("TrustGate", function () {
  let trustGate: TrustGate;
  let registry: AgentRegistry;
  let mockScoring: any;
  let mockUsdc: any;

  let owner: HardhatEthersSigner;
  let depositor: HardhatEthersSigner;
  let depositor2: HardhatEthersSigner;
  let agentOwnerSigner: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let agent2: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  const USDC_DECIMALS = 6;
  const usdc = (amount: number) => BigInt(amount) * 10n ** BigInt(USDC_DECIMALS);
  const DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, depositor, depositor2, agentOwnerSigner, agent, agent2, unauthorized] =
      await ethers.getSigners();

    // Deploy mocks
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDCFactory.deploy();
    await mockUsdc.waitForDeployment();

    const MockScoringFactory = await ethers.getContractFactory("MockTrustScoring");
    mockScoring = await MockScoringFactory.deploy();
    await mockScoring.waitForDeployment();

    // Deploy real AgentRegistry
    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = await RegistryFactory.deploy(owner.address);
    await registry.waitForDeployment();

    // Deploy TrustGate
    const TrustGateFactory = await ethers.getContractFactory("TrustGate");
    trustGate = await TrustGateFactory.deploy(
      await mockUsdc.getAddress(),
      await mockScoring.getAddress(),
      await registry.getAddress(),
      owner.address
    );
    await trustGate.waitForDeployment();

    // Setup: register agent, set score, mint and approve USDC
    await registry.connect(agentOwnerSigner).registerAgent(agent.address, "ipfs://agent");
    await mockScoring.setScore(agent.address, 2); // HIGH tier

    await mockUsdc.mint(depositor.address, usdc(10_000));
    await mockUsdc.connect(depositor).approve(await trustGate.getAddress(), usdc(10_000));
  });

  // ================================================================
  //  DEPLOYMENT
  // ================================================================

  describe("Deployment", function () {
    it("should deploy with correct references", async function () {
      expect(await trustGate.usdc()).to.equal(await mockUsdc.getAddress());
      expect(await trustGate.owner()).to.equal(owner.address);
    });

    it("should expose correct constants", async function () {
      expect(await trustGate.DELAY_PERIOD()).to.equal(DAY);
      expect(await trustGate.TIER_HIGH()).to.equal(2);
      expect(await trustGate.TIER_MEDIUM()).to.equal(1);
      expect(await trustGate.TIER_LOW()).to.equal(0);
    });

    it("should revert deployment with zero USDC address", async function () {
      const Factory = await ethers.getContractFactory("TrustGate");
      await expect(
        Factory.deploy(
          ethers.ZeroAddress,
          await mockScoring.getAddress(),
          await registry.getAddress(),
          owner.address
        )
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");
    });

    it("should revert deployment with zero TrustScoring address", async function () {
      const Factory = await ethers.getContractFactory("TrustGate");
      await expect(
        Factory.deploy(
          await mockUsdc.getAddress(),
          ethers.ZeroAddress,
          await registry.getAddress(),
          owner.address
        )
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");
    });

    it("should revert deployment with zero AgentRegistry address", async function () {
      const Factory = await ethers.getContractFactory("TrustGate");
      await expect(
        Factory.deploy(
          await mockUsdc.getAddress(),
          await mockScoring.getAddress(),
          ethers.ZeroAddress,
          owner.address
        )
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");
    });
  });

  // ================================================================
  //  ADMIN
  // ================================================================

  describe("Admin", function () {
    it("should update TrustScoring reference", async function () {
      const newAddr = depositor.address; // any non-zero address
      await expect(trustGate.connect(owner).setTrustScoring(newAddr))
        .to.emit(trustGate, "TrustScoringUpdated")
        .withArgs(newAddr);
    });

    it("should update AgentRegistry reference", async function () {
      const newAddr = depositor.address;
      await expect(trustGate.connect(owner).setAgentRegistry(newAddr))
        .to.emit(trustGate, "AgentRegistryUpdated")
        .withArgs(newAddr);
    });

    it("should revert admin updates from non-owner", async function () {
      await expect(
        trustGate.connect(unauthorized).setTrustScoring(depositor.address)
      ).to.be.revertedWithCustomError(trustGate, "OwnableUnauthorizedAccount");

      await expect(
        trustGate.connect(unauthorized).setAgentRegistry(depositor.address)
      ).to.be.revertedWithCustomError(trustGate, "OwnableUnauthorizedAccount");
    });

    it("should revert admin updates with zero address", async function () {
      await expect(
        trustGate.connect(owner).setTrustScoring(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");

      await expect(
        trustGate.connect(owner).setAgentRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");
    });
  });

  // ================================================================
  //  DEPOSIT & WITHDRAW
  // ================================================================

  describe("Deposit & Withdraw", function () {
    it("should deposit USDC", async function () {
      await expect(trustGate.connect(depositor).deposit(usdc(1000)))
        .to.emit(trustGate, "Deposited")
        .withArgs(depositor.address, usdc(1000));

      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(1000));
    });

    it("should transfer USDC from depositor to contract on deposit", async function () {
      const before = await mockUsdc.balanceOf(depositor.address);
      await trustGate.connect(depositor).deposit(usdc(500));
      const after = await mockUsdc.balanceOf(depositor.address);

      expect(before - after).to.equal(usdc(500));
      expect(await mockUsdc.balanceOf(await trustGate.getAddress())).to.equal(usdc(500));
    });

    it("should withdraw USDC", async function () {
      await trustGate.connect(depositor).deposit(usdc(1000));

      await expect(trustGate.connect(depositor).withdraw(usdc(400)))
        .to.emit(trustGate, "Withdrawn")
        .withArgs(depositor.address, usdc(400));

      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(600));
    });

    it("should revert deposit of zero", async function () {
      await expect(
        trustGate.connect(depositor).deposit(0)
      ).to.be.revertedWithCustomError(trustGate, "ZeroAmount");
    });

    it("should revert withdraw of zero", async function () {
      await expect(
        trustGate.connect(depositor).withdraw(0)
      ).to.be.revertedWithCustomError(trustGate, "ZeroAmount");
    });

    it("should revert withdraw exceeding balance", async function () {
      await trustGate.connect(depositor).deposit(usdc(100));

      await expect(
        trustGate.connect(depositor).withdraw(usdc(200))
      ).to.be.revertedWithCustomError(trustGate, "InsufficientDeposit");
    });
  });

  // ================================================================
  //  ALLOWANCE
  // ================================================================

  describe("Allowance", function () {
    it("should set allowance for an agent", async function () {
      await expect(
        trustGate.connect(depositor).setAllowance(agent.address, usdc(500))
      )
        .to.emit(trustGate, "AllowanceSet")
        .withArgs(depositor.address, agent.address, usdc(500));

      expect(await trustGate.allowances(depositor.address, agent.address)).to.equal(usdc(500));
    });

    it("should overwrite existing allowance", async function () {
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(500));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(200));

      expect(await trustGate.allowances(depositor.address, agent.address)).to.equal(usdc(200));
    });

    it("should revoke allowance by setting to zero", async function () {
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(500));
      await trustGate.connect(depositor).setAllowance(agent.address, 0);

      expect(await trustGate.allowances(depositor.address, agent.address)).to.equal(0);
    });

    it("should revert setAllowance for zero address", async function () {
      await expect(
        trustGate.connect(depositor).setAllowance(ethers.ZeroAddress, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "ZeroAddress");
    });
  });

  // ================================================================
  //  CLAIM — HIGH TIER (INSTANT)
  // ================================================================

  describe("Claim — HIGH Tier (instant)", function () {
    beforeEach(async function () {
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(2000));
      // agent already has HIGH tier (2) from global beforeEach
    });

    it("should transfer USDC instantly to HIGH-tier agent", async function () {
      const before = await mockUsdc.balanceOf(agent.address);

      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      const after = await mockUsdc.balanceOf(agent.address);
      expect(after - before).to.equal(usdc(500));
    });

    it("should create a Released claim record", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      const [dep, ag, amount, tier, status] = await trustGate.getClaim(1);
      expect(dep).to.equal(depositor.address);
      expect(ag).to.equal(agent.address);
      expect(amount).to.equal(usdc(500));
      expect(tier).to.equal(2);
      expect(status).to.equal(2); // Released
    });

    it("should deduct from deposit and allowance", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(4500));
      expect(await trustGate.allowances(depositor.address, agent.address)).to.equal(usdc(1500));
    });

    it("should emit ClaimCreated and ClaimReleased events", async function () {
      const tx = trustGate.connect(agent).claim(depositor.address, usdc(500));

      await expect(tx)
        .to.emit(trustGate, "ClaimCreated")
        .withArgs(1, depositor.address, agent.address, usdc(500), 2);

      await expect(tx)
        .to.emit(trustGate, "ClaimReleased")
        .withArgs(1);
    });
  });

  // ================================================================
  //  CLAIM — MEDIUM TIER (TIME-LOCKED)
  // ================================================================

  describe("Claim — MEDIUM Tier (time-locked)", function () {
    beforeEach(async function () {
      await mockScoring.setScore(agent.address, 1); // MEDIUM tier
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(2000));
    });

    it("should create a Pending claim with release time", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      const [, , , , status, releaseTime] = await trustGate.getClaim(1);
      expect(status).to.equal(1); // Pending
      expect(releaseTime).to.be.gt(0);
    });

    it("should not transfer USDC on claim creation", async function () {
      const before = await mockUsdc.balanceOf(agent.address);
      await trustGate.connect(agent).claim(depositor.address, usdc(500));
      const after = await mockUsdc.balanceOf(agent.address);

      expect(after).to.equal(before);
    });

    it("should release after delay period", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      await time.increase(DAY + 1);

      const before = await mockUsdc.balanceOf(agent.address);
      await trustGate.connect(agent).releaseClaim(1);
      const after = await mockUsdc.balanceOf(agent.address);

      expect(after - before).to.equal(usdc(500));

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(2); // Released
    });

    it("should revert release before delay expires", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      await expect(
        trustGate.connect(agent).releaseClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "TimeLockNotExpired");
    });

    it("should allow anyone to release after delay", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));
      await time.increase(DAY + 1);

      // unauthorized user triggers release — funds go to agent
      await trustGate.connect(unauthorized).releaseClaim(1);

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(2); // Released
    });

    it("should emit ClaimReleased on release", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));
      await time.increase(DAY + 1);

      await expect(trustGate.connect(agent).releaseClaim(1))
        .to.emit(trustGate, "ClaimReleased")
        .withArgs(1);
    });
  });

  // ================================================================
  //  CLAIM — LOW TIER (ESCROWED)
  // ================================================================

  describe("Claim — LOW Tier (escrowed)", function () {
    beforeEach(async function () {
      await mockScoring.setScore(agent.address, 0); // LOW tier
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(2000));
    });

    it("should create a Pending claim with zero release time", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      const [, , , , status, releaseTime] = await trustGate.getClaim(1);
      expect(status).to.equal(1); // Pending
      expect(releaseTime).to.equal(0); // No auto-release
    });

    it("should release on depositor approval", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      const before = await mockUsdc.balanceOf(agent.address);
      await trustGate.connect(depositor).approveClaim(1);
      const after = await mockUsdc.balanceOf(agent.address);

      expect(after - before).to.equal(usdc(500));

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(2); // Released
    });

    it("should emit ClaimApproved on approval", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      await expect(trustGate.connect(depositor).approveClaim(1))
        .to.emit(trustGate, "ClaimApproved")
        .withArgs(1);
    });

    it("should revert approval from non-depositor", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      await expect(
        trustGate.connect(unauthorized).approveClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "NotClaimDepositor");
    });

    it("should revert releaseClaim on LOW-tier (requires approval)", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));

      await expect(
        trustGate.connect(depositor).releaseClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "EscrowRequiresApproval");
    });
  });

  // ================================================================
  //  CANCEL CLAIM
  // ================================================================

  describe("Cancel Claim", function () {
    beforeEach(async function () {
      await mockScoring.setScore(agent.address, 1); // MEDIUM tier
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(2000));
      await trustGate.connect(agent).claim(depositor.address, usdc(500));
    });

    it("should cancel a pending claim and refund deposit", async function () {
      await trustGate.connect(depositor).cancelClaim(1);

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(3); // Cancelled

      // Deposit refunded
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(5000));
    });

    it("should emit ClaimCancelled event", async function () {
      await expect(trustGate.connect(depositor).cancelClaim(1))
        .to.emit(trustGate, "ClaimCancelled")
        .withArgs(1);
    });

    it("should allow contract owner to cancel", async function () {
      await trustGate.connect(owner).cancelClaim(1);

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(3); // Cancelled
    });

    it("should revert cancel from unauthorized caller", async function () {
      await expect(
        trustGate.connect(unauthorized).cancelClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "NotAuthorizedCanceller");
    });

    it("should revert cancel of already-released claim", async function () {
      await time.increase(DAY + 1);
      await trustGate.connect(agent).releaseClaim(1);

      await expect(
        trustGate.connect(depositor).cancelClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "ClaimNotPending");
    });

    it("should revert cancel of already-cancelled claim", async function () {
      await trustGate.connect(depositor).cancelClaim(1);

      await expect(
        trustGate.connect(depositor).cancelClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "ClaimNotPending");
    });
  });

  // ================================================================
  //  CLAIM VALIDATION
  // ================================================================

  describe("Claim Validation", function () {
    beforeEach(async function () {
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(2000));
    });

    it("should revert claim of zero amount", async function () {
      await expect(
        trustGate.connect(agent).claim(depositor.address, 0)
      ).to.be.revertedWithCustomError(trustGate, "ZeroAmount");
    });

    it("should revert claim from unregistered agent", async function () {
      await expect(
        trustGate.connect(unauthorized).claim(depositor.address, usdc(100))
      ).to.be.reverted;
    });

    it("should revert claim from agent without score", async function () {
      await registry.connect(agentOwnerSigner).registerAgent(agent2.address, "");

      await trustGate.connect(depositor).setAllowance(agent2.address, usdc(1000));

      await expect(
        trustGate.connect(agent2).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotScored");
    });

    it("should revert claim exceeding allowance", async function () {
      await expect(
        trustGate.connect(agent).claim(depositor.address, usdc(3000))
      ).to.be.revertedWithCustomError(trustGate, "InsufficientAllowance");
    });

    it("should revert claim exceeding deposit balance", async function () {
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(100_000));

      await expect(
        trustGate.connect(agent).claim(depositor.address, usdc(10_000))
      ).to.be.revertedWithCustomError(trustGate, "InsufficientDeposit");
    });

    it("should revert claim from deactivated agent", async function () {
      await registry.connect(agentOwnerSigner).deactivateAgent(agent.address);

      await expect(
        trustGate.connect(agent).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotActive");
    });

    it("should revert claim from suspended agent", async function () {
      await registry.connect(owner).suspendAgent(agent.address);

      await expect(
        trustGate.connect(agent).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotActive");
    });
  });

  // ================================================================
  //  VIEW FUNCTIONS
  // ================================================================

  describe("View Functions", function () {
    it("should return claimable amount bounded by allowance", async function () {
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(200));

      expect(
        await trustGate.getClaimableAmount(depositor.address, agent.address)
      ).to.equal(usdc(200));
    });

    it("should return claimable amount bounded by deposit", async function () {
      await trustGate.connect(depositor).deposit(usdc(100));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(500));

      expect(
        await trustGate.getClaimableAmount(depositor.address, agent.address)
      ).to.equal(usdc(100));
    });

    it("should return zero claimable when no allowance", async function () {
      await trustGate.connect(depositor).deposit(usdc(5000));

      expect(
        await trustGate.getClaimableAmount(depositor.address, agent.address)
      ).to.equal(0);
    });

    it("should return zero claimable when no deposit", async function () {
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(500));

      expect(
        await trustGate.getClaimableAmount(depositor.address, agent.address)
      ).to.equal(0);
    });
  });

  // ================================================================
  //  MULTIPLE CLAIMS
  // ================================================================

  describe("Multiple Claims", function () {
    beforeEach(async function () {
      await trustGate.connect(depositor).deposit(usdc(5000));
      await trustGate.connect(depositor).setAllowance(agent.address, usdc(3000));
    });

    it("should handle sequential claims correctly", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(500));
      await trustGate.connect(agent).claim(depositor.address, usdc(700));

      expect(await trustGate.claimCounter()).to.equal(2);
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(3800));
      expect(await trustGate.allowances(depositor.address, agent.address)).to.equal(usdc(1800));
    });

    it("should increment claim IDs", async function () {
      await trustGate.connect(agent).claim(depositor.address, usdc(100));
      await trustGate.connect(agent).claim(depositor.address, usdc(200));

      const [, , amount1] = await trustGate.getClaim(1);
      const [, , amount2] = await trustGate.getClaim(2);

      expect(amount1).to.equal(usdc(100));
      expect(amount2).to.equal(usdc(200));
    });
  });
});
