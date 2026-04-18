import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustGate, AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * TrustGate Integration Tests
 *
 * End-to-end flows exercising the full contract stack:
 *   AgentRegistry + MockTrustScoring + TrustGate + MockUSDC
 *
 * Uses mocks for TrustScoring (no FHE) and USDC so everything
 * runs on vanilla Hardhat without a coprocessor.
 */
describe("TrustGate — Integration", function () {
  let trustGate: TrustGate;
  let registry: AgentRegistry;
  let mockScoring: any;
  let mockUsdc: any;

  let owner: HardhatEthersSigner;
  let depositor: HardhatEthersSigner;
  let agentOwnerSigner: HardhatEthersSigner;
  let highAgent: HardhatEthersSigner;
  let medAgent: HardhatEthersSigner;
  let lowAgent: HardhatEthersSigner;
  let extra: HardhatEthersSigner;

  const USDC_DECIMALS = 6;
  const usdc = (amount: number) => BigInt(amount) * 10n ** BigInt(USDC_DECIMALS);
  const DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, depositor, agentOwnerSigner, highAgent, medAgent, lowAgent, extra] =
      await ethers.getSigners();

    // Deploy all contracts
    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDCFactory.deploy();

    const MockScoringFactory = await ethers.getContractFactory("MockTrustScoring");
    mockScoring = await MockScoringFactory.deploy();

    const RegistryFactory = await ethers.getContractFactory("AgentRegistry");
    registry = await RegistryFactory.deploy(owner.address);

    const TrustGateFactory = await ethers.getContractFactory("TrustGate");
    trustGate = await TrustGateFactory.deploy(
      await mockUsdc.getAddress(),
      await mockScoring.getAddress(),
      await registry.getAddress(),
      owner.address
    );

    // Register three agents with different trust tiers
    await registry.connect(agentOwnerSigner).registerAgent(highAgent.address, "ipfs://high");
    await registry.connect(agentOwnerSigner).registerAgent(medAgent.address, "ipfs://med");
    await registry.connect(agentOwnerSigner).registerAgent(lowAgent.address, "ipfs://low");

    await mockScoring.setScore(highAgent.address, 2); // HIGH
    await mockScoring.setScore(medAgent.address, 1);  // MEDIUM
    await mockScoring.setScore(lowAgent.address, 0);  // LOW

    // Fund depositor
    await mockUsdc.mint(depositor.address, usdc(50_000));
    await mockUsdc.connect(depositor).approve(await trustGate.getAddress(), usdc(50_000));
    await trustGate.connect(depositor).deposit(usdc(50_000));

    // Set allowances
    await trustGate.connect(depositor).setAllowance(highAgent.address, usdc(10_000));
    await trustGate.connect(depositor).setAllowance(medAgent.address, usdc(10_000));
    await trustGate.connect(depositor).setAllowance(lowAgent.address, usdc(10_000));
  });

  // ================================================================
  //  FULL LIFECYCLE — THREE TIERS
  // ================================================================

  describe("Full Lifecycle — Three Tiers", function () {
    it("should route HIGH-tier claim instantly", async function () {
      const before = await mockUsdc.balanceOf(highAgent.address);

      await trustGate.connect(highAgent).claim(depositor.address, usdc(1000));

      const after = await mockUsdc.balanceOf(highAgent.address);
      expect(after - before).to.equal(usdc(1000));

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(2); // Released
    });

    it("should route MEDIUM-tier claim with 24h delay then release", async function () {
      await trustGate.connect(medAgent).claim(depositor.address, usdc(1000));

      // Funds locked, not transferred yet
      const mid = await mockUsdc.balanceOf(medAgent.address);
      expect(mid).to.equal(0);

      // Cannot release early
      await expect(
        trustGate.releaseClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "TimeLockNotExpired");

      // Advance past delay
      await time.increase(DAY + 1);

      await trustGate.releaseClaim(1);

      expect(await mockUsdc.balanceOf(medAgent.address)).to.equal(usdc(1000));

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(2); // Released
    });

    it("should route LOW-tier claim to escrow then approve", async function () {
      await trustGate.connect(lowAgent).claim(depositor.address, usdc(1000));

      // Cannot releaseClaim on LOW tier
      await expect(
        trustGate.releaseClaim(1)
      ).to.be.revertedWithCustomError(trustGate, "EscrowRequiresApproval");

      // Depositor approves
      await trustGate.connect(depositor).approveClaim(1);

      expect(await mockUsdc.balanceOf(lowAgent.address)).to.equal(usdc(1000));
    });

    it("should handle all three tiers in sequence", async function () {
      // HIGH — instant
      await trustGate.connect(highAgent).claim(depositor.address, usdc(1000));
      expect(await mockUsdc.balanceOf(highAgent.address)).to.equal(usdc(1000));

      // MEDIUM — delayed
      await trustGate.connect(medAgent).claim(depositor.address, usdc(2000));
      expect(await mockUsdc.balanceOf(medAgent.address)).to.equal(0);

      // LOW — escrowed
      await trustGate.connect(lowAgent).claim(depositor.address, usdc(3000));
      expect(await mockUsdc.balanceOf(lowAgent.address)).to.equal(0);

      // Release MEDIUM after delay
      await time.increase(DAY + 1);
      await trustGate.releaseClaim(2);
      expect(await mockUsdc.balanceOf(medAgent.address)).to.equal(usdc(2000));

      // Approve LOW
      await trustGate.connect(depositor).approveClaim(3);
      expect(await mockUsdc.balanceOf(lowAgent.address)).to.equal(usdc(3000));

      // Depositor balance reduced correctly
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(44_000));
    });
  });

  // ================================================================
  //  CANCEL & REFUND FLOW
  // ================================================================

  describe("Cancel & Refund Flow", function () {
    it("should refund depositor on cancel and allow re-claim", async function () {
      // MEDIUM claim
      await trustGate.connect(medAgent).claim(depositor.address, usdc(2000));
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(48_000));

      // Cancel
      await trustGate.connect(depositor).cancelClaim(1);
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(50_000));

      // Allowance was already consumed — agent needs new allowance to re-claim
      expect(await trustGate.allowances(depositor.address, medAgent.address)).to.equal(usdc(8000));

      // Agent can claim again from remaining allowance
      await trustGate.connect(medAgent).claim(depositor.address, usdc(1000));
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(49_000));
    });

    it("should allow contract owner to cancel any claim", async function () {
      await trustGate.connect(lowAgent).claim(depositor.address, usdc(500));

      await trustGate.connect(owner).cancelClaim(1);

      const [, , , , status] = await trustGate.getClaim(1);
      expect(status).to.equal(3); // Cancelled
    });
  });

  // ================================================================
  //  AGENT LIFECYCLE INTEGRATION
  // ================================================================

  describe("Agent Lifecycle Integration", function () {
    it("should block claims after agent suspension", async function () {
      await registry.connect(owner).suspendAgent(highAgent.address);

      await expect(
        trustGate.connect(highAgent).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotActive");
    });

    it("should allow claims after agent reactivation", async function () {
      await registry.connect(owner).suspendAgent(highAgent.address);
      await registry.connect(owner).reactivateAgent(highAgent.address);

      await trustGate.connect(highAgent).claim(depositor.address, usdc(100));
      expect(await mockUsdc.balanceOf(highAgent.address)).to.equal(usdc(100));
    });

    it("should permanently block claims after deactivation", async function () {
      await registry.connect(agentOwnerSigner).deactivateAgent(highAgent.address);

      await expect(
        trustGate.connect(highAgent).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotActive");
    });
  });

  // ================================================================
  //  TRUST SCORE CHANGES
  // ================================================================

  describe("Trust Score Changes", function () {
    it("should route differently when agent tier changes", async function () {
      // Agent starts as HIGH — instant
      await trustGate.connect(highAgent).claim(depositor.address, usdc(500));
      expect(await mockUsdc.balanceOf(highAgent.address)).to.equal(usdc(500));

      // Downgrade to MEDIUM
      await mockScoring.setScore(highAgent.address, 1);

      await trustGate.connect(highAgent).claim(depositor.address, usdc(500));

      // Second claim should be pending (MEDIUM = time-locked)
      const [, , , , status] = await trustGate.getClaim(2);
      expect(status).to.equal(1); // Pending
    });

    it("should block claims when score is cleared", async function () {
      await mockScoring.clearScore(highAgent.address);

      await expect(
        trustGate.connect(highAgent).claim(depositor.address, usdc(100))
      ).to.be.revertedWithCustomError(trustGate, "AgentNotScored");
    });
  });

  // ================================================================
  //  MULTI-DEPOSITOR
  // ================================================================

  describe("Multi-Depositor", function () {
    let depositor2: HardhatEthersSigner;

    beforeEach(async function () {
      depositor2 = extra;

      await mockUsdc.mint(depositor2.address, usdc(20_000));
      await mockUsdc.connect(depositor2).approve(await trustGate.getAddress(), usdc(20_000));
      await trustGate.connect(depositor2).deposit(usdc(20_000));
      await trustGate.connect(depositor2).setAllowance(highAgent.address, usdc(5000));
    });

    it("should track deposits independently per depositor", async function () {
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(50_000));
      expect(await trustGate.deposits(depositor2.address)).to.equal(usdc(20_000));
    });

    it("should allow agent to claim from multiple depositors", async function () {
      await trustGate.connect(highAgent).claim(depositor.address, usdc(1000));
      await trustGate.connect(highAgent).claim(depositor2.address, usdc(2000));

      expect(await mockUsdc.balanceOf(highAgent.address)).to.equal(usdc(3000));
      expect(await trustGate.deposits(depositor.address)).to.equal(usdc(49_000));
      expect(await trustGate.deposits(depositor2.address)).to.equal(usdc(18_000));
    });
  });

  // ================================================================
  //  CLAIMABLE AMOUNT VIEW
  // ================================================================

  describe("Claimable Amount Accuracy", function () {
    it("should decrease as claims consume allowance and deposit", async function () {
      const initial = await trustGate.getClaimableAmount(
        depositor.address,
        highAgent.address
      );
      expect(initial).to.equal(usdc(10_000));

      await trustGate.connect(highAgent).claim(depositor.address, usdc(3000));

      const after = await trustGate.getClaimableAmount(
        depositor.address,
        highAgent.address
      );
      expect(after).to.equal(usdc(7000));
    });

    it("should recover after cancel refunds deposit", async function () {
      await mockScoring.setScore(highAgent.address, 1); // MEDIUM for pending claim

      await trustGate.connect(highAgent).claim(depositor.address, usdc(5000));

      const during = await trustGate.getClaimableAmount(
        depositor.address,
        highAgent.address
      );
      // allowance reduced to 5000, deposit reduced to 45000 → min = 5000
      expect(during).to.equal(usdc(5000));

      await trustGate.connect(depositor).cancelClaim(1);

      const afterCancel = await trustGate.getClaimableAmount(
        depositor.address,
        highAgent.address
      );
      // deposit restored to 50000, allowance still 5000 → min = 5000
      expect(afterCancel).to.equal(usdc(5000));
    });
  });
});
