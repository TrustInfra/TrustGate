// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";

/**
 * @title TrustScoring
 * @notice Manages encrypted EigenTrust reputation scores for payroll participants.
 *         Scores remain fully confidential on-chain. Tier classification (HIGH / MEDIUM / LOW)
 *         happens entirely within FHE, so neither the contract owner nor external observers
 *         can read the underlying numeric value without an explicit decryption grant.
 *
 * @dev Trust tiers drive payment routing in PayGramCore:
 *      - HIGH   (score >= 75): instant encrypted transfer
 *      - MEDIUM (score >= 40): 24-hour delayed release
 *      - LOW    (score <  40): milestone-gated escrow
 *
 *      All FHE comparison and select operations modify state (coprocessor interaction),
 *      so tier-check functions are intentionally non-view.
 */
contract TrustScoring is ZamaEthereumConfig, Ownable2Step {
    // ──────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────

    uint64  public constant HIGH_TRUST_THRESHOLD   = 75;
    uint64  public constant MEDIUM_TRUST_THRESHOLD  = 40;
    uint64  public constant MAX_SCORE               = 100;
    uint256 public constant SCORE_EXPIRY             = 90 days;

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    /// @dev Encrypted trust score per address.
    mapping(address => euint64) private _trustScores;

    /// @dev Whether a trust score has been recorded for an address.
    mapping(address => bool) private _hasScore;

    /// @dev Addresses authorized to submit trust scores.
    mapping(address => bool) public authorizedOracles;

    /// @dev Timestamp of the most recent score update per address.
    mapping(address => uint256) public lastScoreUpdate;

    /// @dev Total number of addresses with active (non-revoked) trust scores.
    uint256 public totalScoredAddresses;

    /// @dev Plaintext tier cache: 0 = LOW, 1 = MEDIUM, 2 = HIGH.
    ///      Only populated by plaintext setters (setTrustScorePlaintext, batchSetScores).
    mapping(address => uint8) private _tierCache;

    /// @notice AgentRegistry contract reference for owner-scoped score setting.
    address public agentRegistry;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event TrustScoreUpdated(address indexed account, uint256 timestamp);
    event OracleAuthorized(address indexed oracle, bool authorized);
    event TrustScoreRevoked(address indexed account);
    event ScoreAccessGranted(address indexed account, address indexed allowedAddress);
    event AgentRegistryUpdated(address indexed newRegistry);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error UnauthorizedOracle();
    error AccountNotScored();
    error ScoreExpired();
    error InvalidScoreRange();
    error BatchLengthMismatch();
    error ZeroAddress();
    error NotAuthorizedScorer();

    // ──────────────────────────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────────────────────────

    modifier onlyOracle() {
        if (!authorizedOracles[msg.sender]) revert UnauthorizedOracle();
        _;
    }

    /// @dev Allows oracles or agent owners scoring their own active agents.
    modifier onlyScorer(address account) {
        if (authorizedOracles[msg.sender]) {
            // Oracle -- always authorized
        } else if (
            agentRegistry != address(0) &&
            IAgentRegistry(agentRegistry).isAgentOwner(msg.sender) &&
            IAgentRegistry(agentRegistry).isActiveAgent(msg.sender, account)
        ) {
            // Agent owner scoring their own active agent
        } else {
            revert NotAuthorizedScorer();
        }
        _;
    }

    modifier scored(address account) {
        if (!_hasScore[account]) revert AccountNotScored();
        _;
    }

    modifier notExpired(address account) {
        if (_isExpired(account)) revert ScoreExpired();
        _;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    /**
     * @param initialOwner Account that owns this contract and can manage oracle access.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ──────────────────────────────────────────────────────────────────
    //  Oracle Management
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Grants or revokes oracle authorization.
     * @param oracle     Address of the oracle to modify.
     * @param authorized Whether the oracle should be authorized.
     */
    function setOracle(address oracle, bool authorized) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorized(oracle, authorized);
    }

    /**
     * @notice Sets the AgentRegistry contract address for owner-scoped scoring.
     * @param _registry Address of the deployed AgentRegistry contract.
     */
    function setAgentRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        agentRegistry = _registry;
        emit AgentRegistryUpdated(_registry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Management — Encrypted Input
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Sets or updates an encrypted trust score for `account`.
     * @dev    The encrypted value is validated through its zero-knowledge proof,
     *         then clamped to [0, 100] via FHE.select.
     * @param account        Address whose trust score is being set.
     * @param encryptedScore FHE-encrypted score (expected 0-100).
     * @param inputProof     ZKPoK proof binding the ciphertext to the caller.
     */
    function setTrustScore(
        address account,
        externalEuint64 encryptedScore,
        bytes calldata inputProof
    ) external onlyOracle {
        if (account == address(0)) revert ZeroAddress();

        euint64 score = FHE.fromExternal(encryptedScore, inputProof);

        // Clamp to MAX_SCORE: if score > 100, replace with 0 as a sentinel
        // (oracles should always submit valid ranges; clamping is a safety net)
        ebool isValid = FHE.le(score, FHE.asEuint64(MAX_SCORE));
        score = FHE.select(isValid, score, FHE.asEuint64(0));

        _setScore(account, score);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Management — Plaintext Convenience
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Sets a trust score from a plaintext value. Primarily for testing
     *         and trusted oracle use where the score is known in the clear.
     * @dev    Clamps `score` to MAX_SCORE before encryption.
     * @param account Address whose score to set.
     * @param score   Plaintext score value (0-100).
     */
    function setTrustScorePlaintext(address account, uint64 score) external onlyScorer(account) {
        if (account == address(0)) revert ZeroAddress();

        uint64 clamped = score > MAX_SCORE ? uint64(MAX_SCORE) : score;
        euint64 encrypted = FHE.asEuint64(clamped);

        _setScore(account, encrypted);
        _tierCache[account] = _computeTier(clamped);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Management — Batch
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Sets multiple trust scores in a single transaction.
     * @dev    Uses plaintext values for gas efficiency in batch operations.
     * @param accounts Array of addresses to score.
     * @param scores   Array of plaintext scores (each clamped to MAX_SCORE).
     */
    function batchSetScores(
        address[] calldata accounts,
        uint64[] calldata scores
    ) external {
        if (accounts.length != scores.length) revert BatchLengthMismatch();

        bool isOracle = authorizedOracles[msg.sender];
        bool isOwner = !isOracle &&
            agentRegistry != address(0) &&
            IAgentRegistry(agentRegistry).isAgentOwner(msg.sender);

        for (uint256 i = 0; i < accounts.length; i++) {
            if (accounts[i] == address(0)) revert ZeroAddress();

            // Authorization check per account
            if (isOracle) {
                // Oracle -- always authorized
            } else if (isOwner && IAgentRegistry(agentRegistry).isActiveAgent(msg.sender, accounts[i])) {
                // Agent owner scoring own active agent
            } else {
                revert NotAuthorizedScorer();
            }

            uint64 clamped = scores[i] > MAX_SCORE ? uint64(MAX_SCORE) : scores[i];
            euint64 encrypted = FHE.asEuint64(clamped);
            _setScore(accounts[i], encrypted);
            _tierCache[accounts[i]] = _computeTier(clamped);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Tier Evaluation
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Returns an encrypted boolean: true if `account` has HIGH trust (score >= 75).
     * @dev    Non-view because FHE.ge and FHE.asEuint64 interact with the coprocessor.
     * @param account Address to evaluate.
     * @return result  Encrypted boolean — true when score >= HIGH_TRUST_THRESHOLD.
     */
    function isHighTrust(
        address account
    ) external scored(account) notExpired(account) returns (ebool result) {
        result = FHE.ge(_trustScores[account], FHE.asEuint64(HIGH_TRUST_THRESHOLD));
        FHE.allowTransient(result, msg.sender);
    }

    /**
     * @notice Returns an encrypted boolean: true if `account` has MEDIUM trust (score >= 40).
     * @param account Address to evaluate.
     * @return result  Encrypted boolean — true when score >= MEDIUM_TRUST_THRESHOLD.
     */
    function isMediumTrust(
        address account
    ) external scored(account) notExpired(account) returns (ebool result) {
        result = FHE.ge(_trustScores[account], FHE.asEuint64(MEDIUM_TRUST_THRESHOLD));
        FHE.allowTransient(result, msg.sender);
    }

    /**
     * @notice Returns an encrypted boolean: true if `account` has LOW trust (score < 40).
     * @param account Address to evaluate.
     * @return result  Encrypted boolean — true when score < MEDIUM_TRUST_THRESHOLD.
     */
    function isLowTrust(
        address account
    ) external scored(account) notExpired(account) returns (ebool result) {
        result = FHE.lt(_trustScores[account], FHE.asEuint64(MEDIUM_TRUST_THRESHOLD));
        FHE.allowTransient(result, msg.sender);
    }

    /**
     * @notice Returns an encrypted tier number: 2 = HIGH, 1 = MEDIUM, 0 = LOW.
     * @dev    Uses chained FHE.select to compute the tier without decrypting.
     *         Grants the contract and the owner read access to the result.
     * @param account Address to evaluate.
     * @return tier    Encrypted tier value.
     */
    function getTrustTier(
        address account
    ) external scored(account) notExpired(account) returns (euint64 tier) {
        euint64 score = _trustScores[account];

        ebool isHigh = FHE.ge(score, FHE.asEuint64(HIGH_TRUST_THRESHOLD));
        ebool isMed  = FHE.ge(score, FHE.asEuint64(MEDIUM_TRUST_THRESHOLD));

        tier = FHE.select(
            isHigh,
            FHE.asEuint64(2),
            FHE.select(isMed, FHE.asEuint64(1), FHE.asEuint64(0))
        );

        FHE.allowThis(tier);
        FHE.allow(tier, owner());
        FHE.allowTransient(tier, msg.sender);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Accessors
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the encrypted trust score handle for `account`.
     * @dev    The caller must hold a decryption grant to read the plaintext off-chain.
     * @param account Address whose score to retrieve.
     * @return score   Encrypted score handle.
     */
    function getTrustScore(
        address account
    ) external view scored(account) returns (euint64 score) {
        score = _trustScores[account];
    }

    /**
     * @notice Whether a trust score has been recorded for `account`.
     */
    function hasScore(address account) external view returns (bool) {
        return _hasScore[account];
    }

    /**
     * @notice Whether the score for `account` has passed the 90-day expiry window.
     */
    function isScoreExpired(address account) external view returns (bool) {
        if (!_hasScore[account]) return true;
        return _isExpired(account);
    }

    /**
     * @notice Returns the plaintext trust tier for `account`: 2 = HIGH, 1 = MEDIUM, 0 = LOW.
     * @dev    Only accurate when the score was set via a plaintext setter
     *         (setTrustScorePlaintext or batchSetScores). Scores set via
     *         encrypted input will return 0 (uncached).
     */
    function getTrustTierPlaintext(
        address account
    ) external view scored(account) returns (uint8) {
        return _tierCache[account];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Access Grants
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Grants `allowedAddress` permission to decrypt the trust score of `account`.
     * @dev    Only the contract owner may issue grants. The grant is valid for the
     *         current ciphertext — a score update produces a new ciphertext requiring
     *         a fresh grant.
     * @param account         Address whose score to share.
     * @param allowedAddress  Address that should receive decryption access.
     */
    function allowScoreAccess(
        address account,
        address allowedAddress
    ) external onlyOwner scored(account) {
        if (allowedAddress == address(0)) revert ZeroAddress();

        FHE.allow(_trustScores[account], allowedAddress);
        emit ScoreAccessGranted(account, allowedAddress);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Revocation
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Revokes the trust score for `account`, clearing all associated state.
     * @dev    The encrypted ciphertext handle becomes inaccessible after deletion.
     *         totalScoredAddresses is decremented.
     * @param account Address whose score to revoke.
     */
    function revokeScore(address account) external onlyOracle scored(account) {
        _trustScores[account] = euint64.wrap(0);
        _hasScore[account] = false;
        _tierCache[account] = 0;
        lastScoreUpdate[account] = 0;
        totalScoredAddresses--;

        emit TrustScoreRevoked(account);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal Helpers
    // ──────────────────────────────────────────────────────────────────

    /**
     * @dev Shared score-storage logic used by all public setters.
     *      Handles FHE permission grants, timestamp tracking, and counter management.
     */
    function _setScore(address account, euint64 score) internal {
        FHE.allowThis(score);
        FHE.allow(score, owner());

        bool isNewScore = !_hasScore[account];

        _trustScores[account] = score;
        _hasScore[account] = true;
        lastScoreUpdate[account] = block.timestamp;

        if (isNewScore) {
            totalScoredAddresses++;
        }

        emit TrustScoreUpdated(account, block.timestamp);
    }

    /**
     * @dev Returns true if the score for `account` was last updated more than
     *      SCORE_EXPIRY seconds ago.
     */
    function _isExpired(address account) internal view returns (bool) {
        return block.timestamp > lastScoreUpdate[account] + SCORE_EXPIRY;
    }

    /**
     * @dev Computes the plaintext tier from a plaintext score.
     */
    function _computeTier(uint64 score) internal pure returns (uint8) {
        if (score >= HIGH_TRUST_THRESHOLD) return 2;
        if (score >= MEDIUM_TRUST_THRESHOLD) return 1;
        return 0;
    }
}
