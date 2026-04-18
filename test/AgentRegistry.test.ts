import { expect } from "chai";
import { ethers } from "hardhat";
import { AgentRegistry } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("AgentRegistry", function () {
  let registry: AgentRegistry;
  let owner: HardhatEthersSigner;
  let agentOwner1: HardhatEthersSigner;
  let agentOwner2: HardhatEthersSigner;
  let agent1: HardhatEthersSigner;
  let agent2: HardhatEthersSigner;
  let agent3: HardhatEthersSigner;
  let unauthorized: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, agentOwner1, agentOwner2, agent1, agent2, agent3, unauthorized] =
      await ethers.getSigners();

    const Factory = await ethers.getContractFactory("AgentRegistry");
    registry = await Factory.deploy(owner.address);
    await registry.waitForDeployment();
  });

  // ================================================================
  //  DEPLOYMENT
  // ================================================================

  describe("Deployment", function () {
    it("should deploy with the correct owner", async function () {
      expect(await registry.owner()).to.equal(owner.address);
    });

    it("should have zero active agents initially", async function () {
      expect(await registry.totalActiveAgents()).to.equal(0);
    });
  });

  // ================================================================
  //  REGISTRATION
  // ================================================================

  describe("Registration", function () {
    it("should register an agent", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "ipfs://agent1");

      const [agOwner, status, registeredAt, metadataURI] =
        await registry.getAgent(agent1.address);

      expect(agOwner).to.equal(agentOwner1.address);
      expect(status).to.equal(1); // Active
      expect(registeredAt).to.be.gt(0);
      expect(metadataURI).to.equal("ipfs://agent1");
    });

    it("should increment totalActiveAgents", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
      expect(await registry.totalActiveAgents()).to.equal(1);

      await registry.connect(agentOwner1).registerAgent(agent2.address, "");
      expect(await registry.totalActiveAgents()).to.equal(2);
    });

    it("should mark caller as agent owner", async function () {
      expect(await registry.isAgentOwner(agentOwner1.address)).to.equal(false);

      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
      expect(await registry.isAgentOwner(agentOwner1.address)).to.equal(true);
    });

    it("should track agents by owner", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
      await registry.connect(agentOwner1).registerAgent(agent2.address, "");

      const agents = await registry.getAgentsByOwner(agentOwner1.address);
      expect(agents).to.have.lengthOf(2);
      expect(agents[0]).to.equal(agent1.address);
      expect(agents[1]).to.equal(agent2.address);
    });

    it("should emit AgentRegistered event", async function () {
      await expect(
        registry.connect(agentOwner1).registerAgent(agent1.address, "ipfs://meta")
      )
        .to.emit(registry, "AgentRegistered")
        .withArgs(agent1.address, agentOwner1.address, "ipfs://meta");
    });

    it("should allow different owners to register different agents", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
      await registry.connect(agentOwner2).registerAgent(agent2.address, "");

      expect(await registry.isActiveAgent(agentOwner1.address, agent1.address)).to.equal(true);
      expect(await registry.isActiveAgent(agentOwner2.address, agent2.address)).to.equal(true);
      expect(await registry.isActiveAgent(agentOwner1.address, agent2.address)).to.equal(false);
    });

    it("should revert on zero address agent", async function () {
      await expect(
        registry.connect(agentOwner1).registerAgent(ethers.ZeroAddress, "")
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });

    it("should revert on duplicate registration", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");

      await expect(
        registry.connect(agentOwner2).registerAgent(agent1.address, "")
      ).to.be.revertedWithCustomError(registry, "AgentAlreadyRegistered");
    });
  });

  // ================================================================
  //  DEACTIVATION
  // ================================================================

  describe("Deactivation", function () {
    beforeEach(async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
    });

    it("should deactivate an agent", async function () {
      await registry.connect(agentOwner1).deactivateAgent(agent1.address);

      const [, status] = await registry.getAgent(agent1.address);
      expect(status).to.equal(3); // Deactivated
    });

    it("should decrement totalActiveAgents", async function () {
      expect(await registry.totalActiveAgents()).to.equal(1);

      await registry.connect(agentOwner1).deactivateAgent(agent1.address);
      expect(await registry.totalActiveAgents()).to.equal(0);
    });

    it("should report agent as not active after deactivation", async function () {
      await registry.connect(agentOwner1).deactivateAgent(agent1.address);
      expect(await registry.isActiveAgent(agentOwner1.address, agent1.address)).to.equal(false);
    });

    it("should emit AgentDeactivated event", async function () {
      await expect(
        registry.connect(agentOwner1).deactivateAgent(agent1.address)
      )
        .to.emit(registry, "AgentDeactivated")
        .withArgs(agent1.address, agentOwner1.address);
    });

    it("should revert deactivation from non-owner", async function () {
      await expect(
        registry.connect(unauthorized).deactivateAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "NotAgentOwner");
    });

    it("should revert deactivation for unregistered agent", async function () {
      await expect(
        registry.connect(agentOwner1).deactivateAgent(agent2.address)
      ).to.be.revertedWithCustomError(registry, "AgentNotFound");
    });

    it("should revert double deactivation", async function () {
      await registry.connect(agentOwner1).deactivateAgent(agent1.address);

      await expect(
        registry.connect(agentOwner1).deactivateAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "InvalidStatusTransition");
    });
  });

  // ================================================================
  //  SUSPENSION & REACTIVATION
  // ================================================================

  describe("Suspension & Reactivation", function () {
    beforeEach(async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
    });

    it("should suspend an active agent (contract owner only)", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);

      const [, status] = await registry.getAgent(agent1.address);
      expect(status).to.equal(2); // Suspended
      expect(await registry.totalActiveAgents()).to.equal(0);
    });

    it("should emit AgentSuspended event", async function () {
      await expect(registry.connect(owner).suspendAgent(agent1.address))
        .to.emit(registry, "AgentSuspended")
        .withArgs(agent1.address);
    });

    it("should revert suspension from non-contract-owner", async function () {
      await expect(
        registry.connect(agentOwner1).suspendAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should revert suspension of non-active agent", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);

      await expect(
        registry.connect(owner).suspendAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "AgentNotActive");
    });

    it("should reactivate a suspended agent", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);
      await registry.connect(owner).reactivateAgent(agent1.address);

      const [, status] = await registry.getAgent(agent1.address);
      expect(status).to.equal(1); // Active
      expect(await registry.totalActiveAgents()).to.equal(1);
    });

    it("should emit AgentReactivated event", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);

      await expect(registry.connect(owner).reactivateAgent(agent1.address))
        .to.emit(registry, "AgentReactivated")
        .withArgs(agent1.address);
    });

    it("should revert reactivation of non-suspended agent", async function () {
      await expect(
        registry.connect(owner).reactivateAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "AgentNotSuspended");
    });

    it("should revert reactivation from non-contract-owner", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);

      await expect(
        registry.connect(agentOwner1).reactivateAgent(agent1.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });

    it("should allow deactivation of suspended agent by owner", async function () {
      await registry.connect(owner).suspendAgent(agent1.address);

      // Agent owner should still be able to deactivate a suspended agent
      await registry.connect(agentOwner1).deactivateAgent(agent1.address);
      const [, status] = await registry.getAgent(agent1.address);
      expect(status).to.equal(3); // Deactivated
    });
  });

  // ================================================================
  //  METADATA
  // ================================================================

  describe("Metadata", function () {
    beforeEach(async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "ipfs://v1");
    });

    it("should update metadata", async function () {
      await registry.connect(agentOwner1).updateMetadata(agent1.address, "ipfs://v2");

      const [, , , metadataURI] = await registry.getAgent(agent1.address);
      expect(metadataURI).to.equal("ipfs://v2");
    });

    it("should emit AgentMetadataUpdated event", async function () {
      await expect(
        registry.connect(agentOwner1).updateMetadata(agent1.address, "ipfs://v2")
      )
        .to.emit(registry, "AgentMetadataUpdated")
        .withArgs(agent1.address, "ipfs://v2");
    });

    it("should revert metadata update from non-agent-owner", async function () {
      await expect(
        registry.connect(unauthorized).updateMetadata(agent1.address, "ipfs://hack")
      ).to.be.revertedWithCustomError(registry, "NotAgentOwner");
    });

    it("should revert metadata update for unregistered agent", async function () {
      await expect(
        registry.connect(agentOwner1).updateMetadata(agent2.address, "ipfs://v2")
      ).to.be.revertedWithCustomError(registry, "AgentNotFound");
    });
  });

  // ================================================================
  //  VIEW FUNCTIONS
  // ================================================================

  describe("View Functions", function () {
    it("should return empty array for owner with no agents", async function () {
      const agents = await registry.getAgentsByOwner(agentOwner1.address);
      expect(agents).to.have.lengthOf(0);
    });

    it("should return default values for unregistered agent", async function () {
      const [agOwner, status, registeredAt, metadataURI] =
        await registry.getAgent(agent1.address);

      expect(agOwner).to.equal(ethers.ZeroAddress);
      expect(status).to.equal(0); // None
      expect(registeredAt).to.equal(0);
      expect(metadataURI).to.equal("");
    });

    it("should report isActiveAgent false for wrong owner", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");
      expect(await registry.isActiveAgent(agentOwner2.address, agent1.address)).to.equal(false);
    });

    it("should report isAgentOwner false for address with no agents", async function () {
      expect(await registry.isAgentOwner(unauthorized.address)).to.equal(false);
    });
  });

  // ================================================================
  //  OWNERSHIP TRANSFER
  // ================================================================

  describe("Ownership Transfer", function () {
    it("should support two-step ownership transfer", async function () {
      await registry.connect(owner).transferOwnership(agentOwner1.address);
      expect(await registry.owner()).to.equal(owner.address);

      await registry.connect(agentOwner1).acceptOwnership();
      expect(await registry.owner()).to.equal(agentOwner1.address);
    });

    it("should allow new owner to suspend agents", async function () {
      await registry.connect(agentOwner1).registerAgent(agent1.address, "");

      await registry.connect(owner).transferOwnership(agentOwner2.address);
      await registry.connect(agentOwner2).acceptOwnership();

      await registry.connect(agentOwner2).suspendAgent(agent1.address);
      const [, status] = await registry.getAgent(agent1.address);
      expect(status).to.equal(2); // Suspended
    });
  });
});
