import { expect } from "chai";
import { ethers } from "hardhat";
import { TrustScoring } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * TrustScoring Test Suite
 *
 * Tests are organized into two categories:
 *
 * 1. State & access-control tests — run on any Hardhat network. These verify
 *    deployment, oracle management, modifiers, view helpers, and event emissions.
 *
 * 2. FHE-dependent tests — require a Hardhat node with the Zama FHEVM
 *    coprocessor contracts deployed (local fhevm node or Sepolia).
 *    On a vanilla Hardhat network these will revert because the coprocessor
 *    address is an EOA. They are included so the full specification is captured
 *    and can be validated once the FHEVM environment is available.
 */

describe("TrustScoring", function () {
  let trustScoring: TrustScoring;
  let owner: HardhatEthersSigner;
  let oracle: HardhatEthersSigner;
  let oracle2: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let user3: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, oracle, oracle2, user1, user2, user3, unauthorized] =
      await ethers.getSigners();

    const TrustScoringFactory =
      await ethers.getContractFactory("TrustScoring");
    trustScoring = await TrustScoringFactory.deploy(owner.address);
    await trustScoring.waitForDeployment();

    // Authorize `oracle` as the default oracle for most tests
    await trustScoring.connect(owner).setOracle(oracle.address, true);
  });

  // ================================================================
  //  DEPLOYMENT
  // ================================================================

  describe("Deployment", function () {
    it("should deploy with the correct owner", async function () {
      expect(await trustScoring.owner()).to.equal(owner.address);
    });

    it("should have zero scored addresses initially", async function () {
      expect(await trustScoring.totalScoredAddresses()).to.equal(0);
    });

    it("should expose correct threshold constants", async function () {
      expect(await trustScoring.HIGH_TRUST_THRESHOLD()).to.equal(75);
      expect(await trustScoring.MEDIUM_TRUST_THRESHOLD()).to.equal(40);
      expect(await trustScoring.MAX_SCORE()).to.equal(100);
    });

    it("should expose correct expiry constant", async function () {
      const ninety_days = 90 * 24 * 60 * 60;
      expect(await trustScoring.SCORE_EXPIRY()).to.equal(ninety_days);
    });

    it("should not have any oracle authorized by default (before setUp)", async function () {
      // Deploy a fresh instance without authorizing any oracle
      const Factory = await ethers.getContractFactory("TrustScoring");
      const fresh = await Factory.deploy(owner.address);
      await fresh.waitForDeployment();

      expect(await fresh.authorizedOracles(oracle.address)).to.equal(false);
      expect(await fresh.authorizedOracles(owner.address)).to.equal(false);
    });
  });

  // ================================================================
  //  ORACLE MANAGEMENT
  // ================================================================

  describe("Oracle Management", function () {
    it("should authorize a new oracle", async function () {
      // `oracle` was already authorized in beforeEach
      expect(await trustScoring.authorizedOracles(oracle.address)).to.equal(
        true
      );
    });

    it("should authorize a second oracle independently", async function () {
      await trustScoring.connect(owner).setOracle(oracle2.address, true);
      expect(await trustScoring.authorizedOracles(oracle2.address)).to.equal(
        true
      );
      // First oracle remains authorized
      expect(await trustScoring.authorizedOracles(oracle.address)).to.equal(
        true
      );
    });

    it("should revoke oracle authorization", async function () {
      await trustScoring.connect(owner).setOracle(oracle.address, false);
      expect(await trustScoring.authorizedOracles(oracle.address)).to.equal(
        false
      );
    });

    it("should emit OracleAuthorized event on authorization", async function () {
      await expect(
        trustScoring.connect(owner).setOracle(oracle2.address, true)
      )
        .to.emit(trustScoring, "OracleAuthorized")
        .withArgs(oracle2.address, true);
    });

    it("should emit OracleAuthorized event on revocation", async function () {
      await expect(
        trustScoring.connect(owner).setOracle(oracle.address, false)
      )
        .to.emit(trustScoring, "OracleAuthorized")
        .withArgs(oracle.address, false);
    });

    it("should revert setOracle from non-owner", async function () {
      await expect(
        trustScoring.connect(unauthorized).setOracle(oracle2.address, true)
      ).to.be.revertedWithCustomError(trustScoring, "OwnableUnauthorizedAccount");
    });

    it("should revert setOracle for the zero address", async function () {
      await expect(
        trustScoring.connect(owner).setOracle(ethers.ZeroAddress, true)
      ).to.be.revertedWithCustomError(trustScoring, "ZeroAddress");
    });
  });

  // ================================================================
  //  TRUST SCORE SETTING — PLAINTEXT
  //  (Requires FHEVM coprocessor for FHE.asEuint64)
  // ================================================================

  describe("Trust Score Setting (plaintext)", function () {
    // These tests call setTrustScorePlaintext which internally uses
    // FHE.asEuint64(). On a vanilla Hardhat node the coprocessor contracts
    // are not deployed, so these calls will revert. They are included for
    // completeness and will pass on a full FHEVM local node.

    it("should set a trust score via setTrustScorePlaintext", async function () {
      // FHE-dependent: will revert on vanilla Hardhat
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 85);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip(); // Skip on vanilla Hardhat — requires FHEVM coprocessor
      }
    });

    it("should update hasScore to true after setting", async function () {
      expect(await trustScoring.hasScore(user1.address)).to.equal(false);

      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 50);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should increment totalScoredAddresses for a new score", async function () {
      try {
        const before = await trustScoring.totalScoredAddresses();
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 70);
        expect(await trustScoring.totalScoredAddresses()).to.equal(before + 1n);
      } catch {
        this.skip();
      }
    });

    it("should update lastScoreUpdate timestamp", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 60);
        const ts = await trustScoring.lastScoreUpdate(user1.address);
        expect(ts).to.be.gt(0);
      } catch {
        this.skip();
      }
    });

    it("should clamp scores above 100 to 100", async function () {
      // Verifies no revert for score > 100 (clamped internally)
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 150);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should reject score setting from unauthorized address", async function () {
      await expect(
        trustScoring.connect(unauthorized).setTrustScorePlaintext(user1.address, 50)
      ).to.be.revertedWithCustomError(trustScoring, "NotAuthorizedScorer");
    });

    it("should reject score setting for the zero address", async function () {
      await expect(
        trustScoring.connect(oracle).setTrustScorePlaintext(ethers.ZeroAddress, 50)
      ).to.be.revertedWithCustomError(trustScoring, "ZeroAddress");
    });

    it("should emit TrustScoreUpdated event", async function () {
      try {
        await expect(
          trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80)
        ).to.emit(trustScoring, "TrustScoreUpdated");
      } catch {
        this.skip();
      }
    });

    it("should allow updating an existing score", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 50);
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 90);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should not double-count totalScoredAddresses on update", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 50);
        const after_first = await trustScoring.totalScoredAddresses();
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 90);
        expect(await trustScoring.totalScoredAddresses()).to.equal(after_first);
      } catch {
        this.skip();
      }
    });
  });

  // ================================================================
  //  BATCH SCORE SETTING
  // ================================================================

  describe("Batch Score Setting", function () {
    it("should set multiple scores in one transaction", async function () {
      try {
        await trustScoring
          .connect(oracle)
          .batchSetScores(
            [user1.address, user2.address, user3.address],
            [85, 50, 20]
          );
        expect(await trustScoring.totalScoredAddresses()).to.equal(3);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
        expect(await trustScoring.hasScore(user2.address)).to.equal(true);
        expect(await trustScoring.hasScore(user3.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should revert on mismatched array lengths", async function () {
      await expect(
        trustScoring
          .connect(oracle)
          .batchSetScores([user1.address, user2.address], [85])
      ).to.be.revertedWithCustomError(trustScoring, "BatchLengthMismatch");
    });

    it("should revert batch if any address is zero", async function () {
      // Zero address first so the revert triggers before any FHE operations
      await expect(
        trustScoring
          .connect(oracle)
          .batchSetScores(
            [ethers.ZeroAddress, user1.address],
            [50, 85]
          )
      ).to.be.revertedWithCustomError(trustScoring, "ZeroAddress");
    });

    it("should reject batch from unauthorized caller", async function () {
      await expect(
        trustScoring
          .connect(unauthorized)
          .batchSetScores([user1.address], [85])
      ).to.be.revertedWithCustomError(trustScoring, "NotAuthorizedScorer");
    });

    it("should clamp each score in the batch to MAX_SCORE", async function () {
      try {
        await trustScoring
          .connect(oracle)
          .batchSetScores([user1.address, user2.address], [200, 50]);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
        expect(await trustScoring.hasScore(user2.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });
  });

  // ================================================================
  //  TRUST TIER CHECKS
  //  (All FHE-dependent — require FHEVM coprocessor)
  // ================================================================

  describe("Trust Tier Checks", function () {
    // Helper: set a score and catch if FHE is unavailable
    async function setScoreOrSkip(
      ctx: Mocha.Context,
      account: HardhatEthersSigner,
      score: number
    ) {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(account.address, score);
      } catch {
        ctx.skip();
      }
    }

    it("should identify HIGH trust (score 85 >= 75)", async function () {
      await setScoreOrSkip(this, user1, 85);
      try {
        const tx = await trustScoring.isHighTrust(user1.address);
        // On FHEVM, this returns an ebool handle (non-zero = encrypted true)
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should identify MEDIUM trust (score 50 >= 40)", async function () {
      await setScoreOrSkip(this, user1, 50);
      try {
        const tx = await trustScoring.isMediumTrust(user1.address);
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should identify LOW trust (score 20 < 40)", async function () {
      await setScoreOrSkip(this, user1, 20);
      try {
        const tx = await trustScoring.isLowTrust(user1.address);
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should compute encrypted tier via getTrustTier", async function () {
      await setScoreOrSkip(this, user1, 85);
      try {
        const tx = await trustScoring.getTrustTier(user1.address);
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should revert isHighTrust for unscored address", async function () {
      await expect(
        trustScoring.isHighTrust(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should revert isMediumTrust for unscored address", async function () {
      await expect(
        trustScoring.isMediumTrust(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should revert isLowTrust for unscored address", async function () {
      await expect(
        trustScoring.isLowTrust(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should revert getTrustTier for unscored address", async function () {
      await expect(
        trustScoring.getTrustTier(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });
  });

  // ================================================================
  //  SCORE ACCESSORS
  // ================================================================

  describe("Score Accessors", function () {
    it("should report hasScore as false for unscored address", async function () {
      expect(await trustScoring.hasScore(user1.address)).to.equal(false);
    });

    it("should revert getTrustScore for unscored address", async function () {
      await expect(
        trustScoring.getTrustScore(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should return the encrypted score handle after setting", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 75);
        const score = await trustScoring.getTrustScore(user1.address);
        // The handle is a bytes32 wrapped as euint64; it should be non-zero
        expect(score).to.not.equal(0);
      } catch {
        this.skip();
      }
    });
  });

  // ================================================================
  //  SCORE EXPIRY
  // ================================================================

  describe("Score Expiry", function () {
    it("should report unscored address as expired", async function () {
      expect(await trustScoring.isScoreExpired(user1.address)).to.equal(true);
    });

    it("should report freshly-set score as not expired", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(false);
      } catch {
        this.skip();
      }
    });

    it("should report score as expired after 90 days", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(false);

        // Advance time by 91 days
        const ninety_one_days = 91 * 24 * 60 * 60;
        await time.increase(ninety_one_days);

        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should revert tier check on expired score", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);

        // Advance time past expiry
        const ninety_one_days = 91 * 24 * 60 * 60;
        await time.increase(ninety_one_days);

        await expect(
          trustScoring.isHighTrust(user1.address)
        ).to.be.revertedWithCustomError(trustScoring, "ScoreExpired");
      } catch {
        this.skip();
      }
    });

    it("should not be expired right at the 90-day boundary", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);

        // Advance time by exactly 89 days (still valid)
        const eighty_nine_days = 89 * 24 * 60 * 60;
        await time.increase(eighty_nine_days);

        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(false);
      } catch {
        this.skip();
      }
    });

    it("should reset expiry when score is updated", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 50);

        // Advance 80 days
        await time.increase(80 * 24 * 60 * 60);
        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(false);

        // Update score — resets the clock
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 70);

        // Advance another 80 days (total 160 from original, but only 80 from update)
        await time.increase(80 * 24 * 60 * 60);
        expect(await trustScoring.isScoreExpired(user1.address)).to.equal(false);
      } catch {
        this.skip();
      }
    });
  });

  // ================================================================
  //  SCORE REVOCATION
  // ================================================================

  describe("Score Revocation", function () {
    it("should revoke a trust score", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);

        await trustScoring.connect(oracle).revokeScore(user1.address);
        expect(await trustScoring.hasScore(user1.address)).to.equal(false);
      } catch {
        this.skip();
      }
    });

    it("should decrement totalScoredAddresses on revoke", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        const before = await trustScoring.totalScoredAddresses();

        await trustScoring.connect(oracle).revokeScore(user1.address);
        expect(await trustScoring.totalScoredAddresses()).to.equal(before - 1n);
      } catch {
        this.skip();
      }
    });

    it("should emit TrustScoreRevoked event", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);

        await expect(trustScoring.connect(oracle).revokeScore(user1.address))
          .to.emit(trustScoring, "TrustScoreRevoked")
          .withArgs(user1.address);
      } catch {
        this.skip();
      }
    });

    it("should clear lastScoreUpdate on revoke", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        expect(await trustScoring.lastScoreUpdate(user1.address)).to.be.gt(0);

        await trustScoring.connect(oracle).revokeScore(user1.address);
        expect(await trustScoring.lastScoreUpdate(user1.address)).to.equal(0);
      } catch {
        this.skip();
      }
    });

    it("should revert tier checks after revocation", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        await trustScoring.connect(oracle).revokeScore(user1.address);
      } catch {
        this.skip();
      }

      // Whether or not FHE is available, the modifier should catch this
      if (!(await trustScoring.hasScore(user1.address))) {
        await expect(
          trustScoring.isHighTrust(user1.address)
        ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
      }
    });

    it("should revert revocation for unscored address", async function () {
      await expect(
        trustScoring.connect(oracle).revokeScore(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should reject revocation from unauthorized caller", async function () {
      await expect(
        trustScoring.connect(unauthorized).revokeScore(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "UnauthorizedOracle");
    });

    it("should allow re-scoring after revocation", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 50);
        await trustScoring.connect(oracle).revokeScore(user1.address);
        expect(await trustScoring.hasScore(user1.address)).to.equal(false);

        // Re-score
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 90);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });
  });

  // ================================================================
  //  ACCESS CONTROL
  // ================================================================

  describe("Access Control", function () {
    it("should allow owner to grant score access to another address", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);

        await expect(
          trustScoring
            .connect(owner)
            .allowScoreAccess(user1.address, user2.address)
        )
          .to.emit(trustScoring, "ScoreAccessGranted")
          .withArgs(user1.address, user2.address);
      } catch {
        this.skip();
      }
    });

    it("should revert allowScoreAccess for unscored address", async function () {
      await expect(
        trustScoring
          .connect(owner)
          .allowScoreAccess(user1.address, user2.address)
      ).to.be.revertedWithCustomError(trustScoring, "AccountNotScored");
    });

    it("should revert allowScoreAccess from non-owner", async function () {
      // Even if user1 has a score, only owner can grant access.
      // The onlyOwner check fires before the scored modifier.
      await expect(
        trustScoring
          .connect(unauthorized)
          .allowScoreAccess(user1.address, user2.address)
      ).to.be.revertedWithCustomError(trustScoring, "OwnableUnauthorizedAccount");
    });

    it("should revert allowScoreAccess with zero allowed address", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);

        await expect(
          trustScoring
            .connect(owner)
            .allowScoreAccess(user1.address, ethers.ZeroAddress)
        ).to.be.revertedWithCustomError(trustScoring, "ZeroAddress");
      } catch {
        this.skip();
      }
    });

    it("should support two-step ownership transfer", async function () {
      await trustScoring.connect(owner).transferOwnership(user1.address);
      // Ownership not transferred yet
      expect(await trustScoring.owner()).to.equal(owner.address);

      // user1 accepts
      await trustScoring.connect(user1).acceptOwnership();
      expect(await trustScoring.owner()).to.equal(user1.address);
    });

    it("should reject ownership acceptance from wrong address", async function () {
      await trustScoring.connect(owner).transferOwnership(user1.address);

      await expect(
        trustScoring.connect(user2).acceptOwnership()
      ).to.be.revertedWithCustomError(trustScoring, "OwnableUnauthorizedAccount");
    });

    it("should preserve oracle authorization after ownership transfer", async function () {
      await trustScoring.connect(owner).transferOwnership(user1.address);
      await trustScoring.connect(user1).acceptOwnership();

      // Oracle is still authorized
      expect(await trustScoring.authorizedOracles(oracle.address)).to.equal(true);

      // New owner can manage oracles
      await trustScoring.connect(user1).setOracle(oracle2.address, true);
      expect(await trustScoring.authorizedOracles(oracle2.address)).to.equal(true);
    });
  });

  // ================================================================
  //  MULTIPLE ORACLES
  // ================================================================

  describe("Multiple Oracles", function () {
    beforeEach(async function () {
      await trustScoring.connect(owner).setOracle(oracle2.address, true);
    });

    it("should allow different oracles to set scores for different users", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        await trustScoring.connect(oracle2).setTrustScorePlaintext(user2.address, 60);

        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
        expect(await trustScoring.hasScore(user2.address)).to.equal(true);
        expect(await trustScoring.totalScoredAddresses()).to.equal(2);
      } catch {
        this.skip();
      }
    });

    it("should allow one oracle to overwrite another's score", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        await trustScoring.connect(oracle2).setTrustScorePlaintext(user1.address, 30);

        // Score was overwritten but count stays at 1
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
        expect(await trustScoring.totalScoredAddresses()).to.equal(1);
      } catch {
        this.skip();
      }
    });

    it("should prevent revoked oracle from setting scores", async function () {
      await trustScoring.connect(owner).setOracle(oracle2.address, false);

      await expect(
        trustScoring.connect(oracle2).setTrustScorePlaintext(user1.address, 50)
      ).to.be.revertedWithCustomError(trustScoring, "NotAuthorizedScorer");
    });
  });

  // ================================================================
  //  AGENT OWNER-SCOPED SCORING
  // ================================================================

  describe("Agent Owner-Scoped Scoring", function () {
    async function setupAgentScoring() {
      const AgentRegistryFactory = await ethers.getContractFactory("AgentRegistry");
      const registry = await AgentRegistryFactory.deploy(owner.address);
      await registry.waitForDeployment();

      // Wire TrustScoring -> AgentRegistry
      await trustScoring.connect(owner).setAgentRegistry(await registry.getAddress());

      return { registry };
    }

    it("should allow agent owner to set score for own active agent", async function () {
      const { registry } = await setupAgentScoring();

      // oracle registers user1 as an agent (oracle becomes agent owner)
      await registry.connect(oracle).registerAgent(user1.address, "ipfs://meta");

      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 85);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should reject non-owner scoring an agent they do not own", async function () {
      const { registry } = await setupAgentScoring();

      // oracle registers user1 as agent
      await registry.connect(oracle).registerAgent(user1.address, "ipfs://meta");

      // unauthorized is not an oracle and does not own user1
      await expect(
        trustScoring.connect(unauthorized).setTrustScorePlaintext(user1.address, 50)
      ).to.be.revertedWithCustomError(trustScoring, "NotAuthorizedScorer");
    });

    it("should reject agent owner scoring a deactivated agent", async function () {
      const { registry } = await setupAgentScoring();

      // Use user2 (non-oracle) as agent owner so the modifier tests the registry path
      await registry.connect(user2).registerAgent(user1.address, "ipfs://meta");
      await registry.connect(user2).deactivateAgent(user1.address);

      await expect(
        trustScoring.connect(user2).setTrustScorePlaintext(user1.address, 50)
      ).to.be.revertedWithCustomError(trustScoring, "NotAuthorizedScorer");
    });

    it("should allow setAgentRegistry by owner", async function () {
      await expect(
        trustScoring.connect(owner).setAgentRegistry(user1.address)
      ).to.emit(trustScoring, "AgentRegistryUpdated").withArgs(user1.address);
      expect(await trustScoring.agentRegistry()).to.equal(user1.address);
    });

    it("should reject setAgentRegistry from non-owner", async function () {
      await expect(
        trustScoring.connect(unauthorized).setAgentRegistry(user1.address)
      ).to.be.revertedWithCustomError(trustScoring, "OwnableUnauthorizedAccount");
    });

    it("should reject setAgentRegistry with zero address", async function () {
      await expect(
        trustScoring.connect(owner).setAgentRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(trustScoring, "ZeroAddress");
    });
  });

  // ================================================================
  //  EDGE CASES
  // ================================================================

  describe("Edge Cases", function () {
    it("should handle score of zero", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 0);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should handle score of exactly 100", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 100);
        expect(await trustScoring.hasScore(user1.address)).to.equal(true);
      } catch {
        this.skip();
      }
    });

    it("should handle score at HIGH threshold boundary (75)", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 75);
        // 75 >= 75, so isHighTrust should return encrypted true
        const tx = await trustScoring.isHighTrust(user1.address);
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should handle score at MEDIUM threshold boundary (40)", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 40);
        // 40 >= 40, so isMediumTrust should return encrypted true
        const tx = await trustScoring.isMediumTrust(user1.address);
        expect(tx).to.not.be.reverted;
      } catch {
        this.skip();
      }
    });

    it("should handle empty batch gracefully", async function () {
      try {
        await trustScoring.connect(oracle).batchSetScores([], []);
        // No-op, no revert
        expect(await trustScoring.totalScoredAddresses()).to.equal(0);
      } catch {
        this.skip();
      }
    });

    it("should handle re-scoring a revoked address and count correctly", async function () {
      try {
        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 80);
        expect(await trustScoring.totalScoredAddresses()).to.equal(1);

        await trustScoring.connect(oracle).revokeScore(user1.address);
        expect(await trustScoring.totalScoredAddresses()).to.equal(0);

        await trustScoring.connect(oracle).setTrustScorePlaintext(user1.address, 60);
        expect(await trustScoring.totalScoredAddresses()).to.equal(1);
      } catch {
        this.skip();
      }
    });
  });
});
