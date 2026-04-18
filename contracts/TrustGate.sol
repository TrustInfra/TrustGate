// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITrustScoring} from "./ITrustScoring.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";

/**
 * @title TrustGate
 * @notice Trust-gated USDC payment gateway for AI agents. Depositors fund the
 *         gate and set per-agent spending allowances. Agents autonomously claim
 *         USDC up to their allowance, with payment routing determined by their
 *         trust tier from TrustScoring:
 *
 *         - HIGH   (tier 2, score >= 75): instant USDC transfer
 *         - MEDIUM (tier 1, score >= 40): 24-hour time-locked release
 *         - LOW    (tier 0, score <  40): escrowed until depositor approves
 *
 * @dev Uses plaintext tier cache from TrustScoring. Since USDC is a standard
 *      ERC20 with visible transfer amounts, oblivious FHE routing adds cost
 *      without privacy benefit here.
 *
 *      Arc Testnet: USDC is the native gas token. Native balance uses 18
 *      decimals but the ERC-20 interface at 0x3600...0000 uses 6 decimals.
 *      This contract exclusively uses the ERC-20 interface — all amounts
 *      are in 6-decimal USDC. Never mix with native balance reads.
 */
contract TrustGate is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────

    uint256 public constant DELAY_PERIOD = 24 hours;
    uint8   public constant TIER_HIGH    = 2;
    uint8   public constant TIER_MEDIUM  = 1;
    uint8   public constant TIER_LOW     = 0;

    // ──────────────────────────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────────────────────────

    enum ClaimStatus {
        None,
        Pending,
        Released,
        Cancelled
    }

    struct Claim {
        address depositor;
        address agent;
        uint256 amount;
        uint8 tier;
        ClaimStatus status;
        uint256 releaseTime;
        uint256 createdAt;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    /// @notice USDC token used for all payments.
    IERC20 public immutable usdc;

    /// @notice TrustScoring contract for trust-tier lookups.
    ITrustScoring public trustScoring;

    /// @notice AgentRegistry contract for agent validation.
    IAgentRegistry public agentRegistry;

    /// @dev Depositor address → available USDC balance (not locked in claims).
    mapping(address => uint256) public deposits;

    /// @dev Depositor → agent → remaining spending allowance.
    mapping(address => mapping(address => uint256)) public allowances;

    /// @dev Claim ID → claim record.
    mapping(uint256 => Claim) public claims;

    /// @notice Monotonically increasing claim counter.
    uint256 public claimCounter;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event Deposited(address indexed depositor, uint256 amount);
    event Withdrawn(address indexed depositor, uint256 amount);
    event AllowanceSet(address indexed depositor, address indexed agent, uint256 amount);
    event ClaimCreated(
        uint256 indexed claimId,
        address indexed depositor,
        address indexed agent,
        uint256 amount,
        uint8 tier
    );
    event ClaimReleased(uint256 indexed claimId);
    event ClaimApproved(uint256 indexed claimId);
    event ClaimCancelled(uint256 indexed claimId);
    event TrustScoringUpdated(address indexed newTrustScoring);
    event AgentRegistryUpdated(address indexed newAgentRegistry);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientDeposit();
    error InsufficientAllowance();
    error AgentNotActive();
    error AgentNotScored();
    error AgentScoreExpired();
    error ClaimNotPending();
    error TimeLockNotExpired();
    error NotClaimDepositor();
    error NotAuthorizedCanceller();
    error EscrowRequiresApproval();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    /**
     * @param _usdc          Address of the USDC token contract.
     * @param _trustScoring  Address of the deployed TrustScoring contract.
     * @param _agentRegistry Address of the deployed AgentRegistry contract.
     * @param initialOwner   Account that owns this contract.
     */
    constructor(
        address _usdc,
        address _trustScoring,
        address _agentRegistry,
        address initialOwner
    ) Ownable(initialOwner) {
        if (_usdc == address(0)) revert ZeroAddress();
        if (_trustScoring == address(0)) revert ZeroAddress();
        if (_agentRegistry == address(0)) revert ZeroAddress();

        usdc = IERC20(_usdc);
        trustScoring = ITrustScoring(_trustScoring);
        agentRegistry = IAgentRegistry(_agentRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Updates the TrustScoring contract reference.
     * @param _trustScoring New TrustScoring address.
     */
    function setTrustScoring(address _trustScoring) external onlyOwner {
        if (_trustScoring == address(0)) revert ZeroAddress();
        trustScoring = ITrustScoring(_trustScoring);
        emit TrustScoringUpdated(_trustScoring);
    }

    /**
     * @notice Updates the AgentRegistry contract reference.
     * @param _agentRegistry New AgentRegistry address.
     */
    function setAgentRegistry(address _agentRegistry) external onlyOwner {
        if (_agentRegistry == address(0)) revert ZeroAddress();
        agentRegistry = IAgentRegistry(_agentRegistry);
        emit AgentRegistryUpdated(_agentRegistry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Depositor Functions
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Deposits USDC into the gate. Caller must have approved this
     *         contract to spend `amount` of USDC beforehand.
     * @param amount Amount of USDC to deposit (in USDC decimals).
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        deposits[msg.sender] += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraws unused USDC from the depositor's balance.
     *         Only funds not locked in pending claims can be withdrawn.
     * @param amount Amount of USDC to withdraw.
     */
    function withdraw(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (deposits[msg.sender] < amount) revert InsufficientDeposit();

        deposits[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount);
    }

    /**
     * @notice Sets the spending allowance for an agent. The agent can claim
     *         up to this amount from the depositor's balance.
     * @dev    Setting to 0 effectively revokes the agent's access.
     *         Allowance is a cap — it does not lock funds. Funds are locked
     *         only when a claim is created.
     * @param agent  Address of the agent.
     * @param amount Maximum USDC the agent can claim.
     */
    function setAllowance(address agent, uint256 amount) external {
        if (agent == address(0)) revert ZeroAddress();

        allowances[msg.sender][agent] = amount;

        emit AllowanceSet(msg.sender, agent, amount);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Agent Functions
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Agent claims USDC from a depositor's allowance. The trust tier
     *         of the calling agent determines the payment path:
     *
     *         - HIGH:   USDC transferred instantly to the agent.
     *         - MEDIUM: Claim created with a 24-hour time lock.
     *         - LOW:    Claim created in escrow; depositor must approve.
     *
     * @param depositor Address of the depositor to claim from.
     * @param amount    Amount of USDC to claim.
     * @return claimId  The ID of the created claim (0 for instant HIGH-tier transfers).
     */
    function claim(
        address depositor,
        uint256 amount
    ) external nonReentrant returns (uint256 claimId) {
        if (amount == 0) revert ZeroAmount();

        // Validate agent status
        if (!agentRegistry.isActiveAgent(_getAgentOwner(msg.sender), msg.sender)) {
            revert AgentNotActive();
        }

        // Validate trust score
        if (!trustScoring.hasScore(msg.sender)) revert AgentNotScored();
        if (trustScoring.isScoreExpired(msg.sender)) revert AgentScoreExpired();

        // Validate allowance and deposit
        uint256 currentAllowance = allowances[depositor][msg.sender];
        if (currentAllowance < amount) revert InsufficientAllowance();
        if (deposits[depositor] < amount) revert InsufficientDeposit();

        // Deduct allowance and lock deposit
        allowances[depositor][msg.sender] = currentAllowance - amount;
        deposits[depositor] -= amount;

        uint8 tier = trustScoring.getTrustTierPlaintext(msg.sender);

        if (tier == TIER_HIGH) {
            // Instant transfer — no claim record needed
            usdc.safeTransfer(msg.sender, amount);

            claimId = ++claimCounter;
            claims[claimId] = Claim({
                depositor: depositor,
                agent: msg.sender,
                amount: amount,
                tier: tier,
                status: ClaimStatus.Released,
                releaseTime: 0,
                createdAt: block.timestamp
            });

            emit ClaimCreated(claimId, depositor, msg.sender, amount, tier);
            emit ClaimReleased(claimId);
        } else {
            claimId = ++claimCounter;

            uint256 releaseTime = tier == TIER_MEDIUM
                ? block.timestamp + DELAY_PERIOD
                : 0; // LOW tier: no auto-release, requires approval

            claims[claimId] = Claim({
                depositor: depositor,
                agent: msg.sender,
                amount: amount,
                tier: tier,
                status: ClaimStatus.Pending,
                releaseTime: releaseTime,
                createdAt: block.timestamp
            });

            emit ClaimCreated(claimId, depositor, msg.sender, amount, tier);
        }
    }

    /**
     * @notice Releases a time-locked MEDIUM-tier claim after the delay period.
     *         Anyone can call this — the funds go to the claim's agent.
     * @param claimId ID of the claim to release.
     */
    function releaseClaim(uint256 claimId) external nonReentrant {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Pending) revert ClaimNotPending();
        if (c.tier == TIER_LOW) revert EscrowRequiresApproval();
        if (block.timestamp < c.releaseTime) revert TimeLockNotExpired();

        c.status = ClaimStatus.Released;
        usdc.safeTransfer(c.agent, c.amount);

        emit ClaimReleased(claimId);
    }

    /**
     * @notice Approves an escrowed LOW-tier claim. Only the original depositor
     *         can approve. Transfers USDC to the agent immediately.
     * @param claimId ID of the claim to approve.
     */
    function approveClaim(uint256 claimId) external nonReentrant {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Pending) revert ClaimNotPending();
        if (c.depositor != msg.sender) revert NotClaimDepositor();

        c.status = ClaimStatus.Released;
        usdc.safeTransfer(c.agent, c.amount);

        emit ClaimApproved(claimId);
    }

    /**
     * @notice Cancels a pending claim and refunds the locked USDC to the
     *         depositor's balance. Can be called by the depositor or the
     *         contract owner.
     * @param claimId ID of the claim to cancel.
     */
    function cancelClaim(uint256 claimId) external nonReentrant {
        Claim storage c = claims[claimId];
        if (c.status != ClaimStatus.Pending) revert ClaimNotPending();
        if (c.depositor != msg.sender && msg.sender != owner()) {
            revert NotAuthorizedCanceller();
        }

        c.status = ClaimStatus.Cancelled;
        deposits[c.depositor] += c.amount;

        emit ClaimCancelled(claimId);
    }

    // ──────────────────────────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the maximum amount an agent can currently claim from
     *         a given depositor, bounded by both allowance and deposit balance.
     * @param depositor Address of the depositor.
     * @param agent     Address of the agent.
     * @return claimable Minimum of remaining allowance and depositor balance.
     */
    function getClaimableAmount(
        address depositor,
        address agent
    ) external view returns (uint256 claimable) {
        uint256 allowed = allowances[depositor][agent];
        uint256 balance = deposits[depositor];
        claimable = allowed < balance ? allowed : balance;
    }

    /**
     * @notice Returns the full details of a claim.
     * @param claimId ID of the claim.
     */
    function getClaim(uint256 claimId)
        external
        view
        returns (
            address depositor,
            address agent,
            uint256 amount,
            uint8 tier,
            ClaimStatus status,
            uint256 releaseTime,
            uint256 createdAt
        )
    {
        Claim storage c = claims[claimId];
        return (c.depositor, c.agent, c.amount, c.tier, c.status, c.releaseTime, c.createdAt);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal Helpers
    // ──────────────────────────────────────────────────────────────────

    /**
     * @dev Retrieves the agent's owner from the registry. Uses a low-level
     *      approach: iterates the agent's owner lookup. Since AgentRegistry
     *      exposes isActiveAgent(owner, agent), the agent needs to know its
     *      own owner. We check if msg.sender is active under any registered
     *      owner by querying the registry's getAgent view.
     *
     *      This is a helper to bridge the isActiveAgent(owner, agent) API
     *      when the agent itself is calling. The AgentRegistry stores the
     *      owner in the Agent struct, accessible via getAgent().
     */
    function _getAgentOwner(address agent) internal view returns (address owner) {
        // AgentRegistry.getAgent returns (owner, status, registeredAt, metadataURI)
        (owner, , , ) = IAgentRegistryExtended(address(agentRegistry)).getAgent(agent);
    }
}

/**
 * @dev Extended interface to access AgentRegistry.getAgent from TrustGate.
 *      Kept minimal — only the owner field is used.
 */
interface IAgentRegistryExtended is IAgentRegistry {
    function getAgent(address agent)
        external
        view
        returns (
            address owner,
            uint8 status,
            uint256 registeredAt,
            string memory metadataURI
        );
}
