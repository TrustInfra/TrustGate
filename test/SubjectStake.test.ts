import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("SubjectStake", function () {
  let vault: any;
  let usdc: any;
  let owner: HardhatEthersSigner;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  const usdcAmt = (n: number) => BigInt(n) * 10n ** 6n;
  const DAY = 24 * 60 * 60;

  beforeEach(async function () {
    [owner, alice, bob] = await ethers.getSigners();
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const Factory = await ethers.getContractFactory("SubjectStake");
    vault = await Factory.deploy(await usdc.getAddress(), owner.address);
    await vault.waitForDeployment();

    await usdc.mint(alice.address, usdcAmt(10_000));
    await usdc.mint(bob.address, usdcAmt(10_000));
    await usdc.connect(alice).approve(await vault.getAddress(), usdcAmt(10_000));
    await usdc.connect(bob).approve(await vault.getAddress(), usdcAmt(10_000));
  });

  it("computes subjectId as keccak256(kind:canonical)", async function () {
    const id = await vault.subjectIdOf("x", "trustgated");
    const packed = ethers.solidityPackedKeccak256(
      ["string"],
      ["x:trustgated"]
    );
    // abi.encodePacked(kind, ":", canonical) on two strings concatenates bytes
    const expected = ethers.keccak256(
      ethers.concat([
        ethers.toUtf8Bytes("x"),
        ethers.toUtf8Bytes(":"),
        ethers.toUtf8Bytes("trustgated"),
      ])
    );
    expect(id).to.equal(expected);
    expect(id).to.equal(packed);
  });

  it("rejects below-minimum stake", async function () {
    await expect(
      vault.connect(alice).stake("x", "trustgated", 0, usdcAmt(0), "")
    ).to.be.revertedWithCustomError(vault, "BelowMinimum");
  });

  it("stakes support and challenge independently", async function () {
    await vault.connect(alice).stake("x", "trustgated", 0, usdcAmt(10), "credible");
    await vault.connect(bob).stake("x", "trustgated", 1, usdcAmt(4), "sybil");
    const id = await vault.subjectIdOf("x", "trustgated");
    const subject = await vault.subjects(id);
    expect(subject.exists).to.equal(true);
    expect(subject.supportTotal).to.equal(usdcAmt(10));
    expect(subject.challengeTotal).to.equal(usdcAmt(4));
    expect(subject.stakerCount).to.equal(2);
    expect(subject.supportStakers).to.equal(1);
    expect(subject.challengeStakers).to.equal(1);
    const alicePos = await vault.positions(id, alice.address);
    expect(alicePos.supportReason).to.equal("credible");
  });

  it("unbond is locked for 7 days then withdraws to the staker", async function () {
    await vault.connect(alice).stake("github", "ethereum", 0, usdcAmt(25), "");
    const id = await vault.subjectIdOf("github", "ethereum");
    await vault.connect(alice).requestUnbond(id, 0, usdcAmt(25));
    await expect(
      vault.connect(alice).withdraw(id, 0)
    ).to.be.revertedWithCustomError(vault, "StillLocked");

    await time.increase(7 * DAY);
    const before = await usdc.balanceOf(alice.address);
    await vault.connect(alice).withdraw(id, 0);
    const after = await usdc.balanceOf(alice.address);
    expect(after - before).to.equal(usdcAmt(25));
    await expect(
      vault.connect(alice).withdraw(id, 0)
    ).to.be.revertedWithCustomError(vault, "AlreadyClaimed");
  });

  it("creates the subject on first stake", async function () {
    const id = await vault.subjectIdOf("website", "https://trustgated.xyz");
    const before = await vault.subjects(id);
    expect(before.exists).to.equal(false);
    await vault
      .connect(alice)
      .stake("website", "https://trustgated.xyz", 0, usdcAmt(1), "");
    const after = await vault.subjects(id);
    expect(after.exists).to.equal(true);
    expect(after.kind).to.equal("website");
    expect(after.canonical).to.equal("https://trustgated.xyz");
  });

  it("creates a claim under a parent and tracks both sides", async function () {
    await vault.connect(alice).stake("x", "trustgated", 0, usdcAmt(5), "");
    await vault
      .connect(alice)
      .stakeClaim(
        "x",
        "trustgated",
        "has tag Layer 1",
        0,
        usdcAmt(3),
        "ships mainnet"
      );
    await vault
      .connect(bob)
      .stakeClaim("x", "trustgated", "has tag Layer 1", 1, usdcAmt(2), "not l1");

    const parentId = await vault.subjectIdOf("x", "trustgated");
    expect(await vault.childClaimCount(parentId)).to.equal(1);
    const claimId = await vault.childClaimAt(parentId, 0);
    const claim = await vault.subjects(claimId);
    expect(claim.kind).to.equal("claim");
    expect(claim.statement).to.equal("has tag Layer 1");
    expect(claim.parentId).to.equal(parentId);
    expect(claim.supportStakers).to.equal(1);
    expect(claim.challengeStakers).to.equal(1);
    expect(await vault.listedStakerCount(claimId)).to.equal(2);
    const bobPos = await vault.positions(claimId, bob.address);
    expect(bobPos.challengeReason).to.equal("not l1");
  });

  it("reuses claimed unbond slots so a 21st unbond is not frozen", async function () {
    await vault.connect(alice).stake("x", "queue", 0, usdcAmt(25), "");
    const id = await vault.subjectIdOf("x", "queue");
    for (let i = 0; i < 20; i++) {
      await vault.connect(alice).requestUnbond(id, 0, usdcAmt(1));
    }
    await expect(
      vault.connect(alice).requestUnbond(id, 0, usdcAmt(1))
    ).to.be.revertedWithCustomError(vault, "UnbondQueueFull");

    await time.increase(7 * DAY);
    await vault.connect(alice).withdraw(id, 0);
    await vault.connect(alice).requestUnbond(id, 0, usdcAmt(1));
    const reused = await vault.getUnbond(id, alice.address, 0);
    expect(reused.claimed).to.equal(false);
    expect(reused.amount).to.equal(usdcAmt(1));
  });

  it("does not duplicate listed stakers after full exit and restake", async function () {
    await vault.connect(alice).stake("x", "once", 0, usdcAmt(2), "");
    const id = await vault.subjectIdOf("x", "once");
    await vault.connect(alice).requestUnbond(id, 0, usdcAmt(2));
    await vault.connect(alice).stake("x", "once", 0, usdcAmt(2), "");
    expect(await vault.listedStakerCount(id)).to.equal(1);
  });

  it("rejects 1-wei unbond", async function () {
    await vault.connect(alice).stake("x", "dust", 0, usdcAmt(2), "");
    const id = await vault.subjectIdOf("x", "dust");
    await expect(
      vault.connect(alice).requestUnbond(id, 0, 1n)
    ).to.be.revertedWithCustomError(vault, "BelowMinimum");
  });
});
