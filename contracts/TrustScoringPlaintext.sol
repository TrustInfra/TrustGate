// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";
import {ITrustScoring} from "./ITrustScoring.sol";

/**
 * @title TrustScoringPlaintext
 * @notice Plaintext trust scoring for chains without the Zama FHE coprocessor
 *         (e.g. Arc testnet). Functionally equivalent to TrustScoring but stores
 *         scores as plain uint64 instead of euint64.
 *
 * @dev Implements ITrustScoring so TrustGate can consume it identically.
 *      Trust tiers follow the same thresholds:
 *        - HIGH   (score >= 75): tier 2
 *        - MEDIUM (score >= 40): tier 1
 *        - LOW    (score <  40): tier 0
 */
contract TrustScoringPlaintext is ITrustScoring, Ownable2Step {
    // ──────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────

    uint64  public constant HIGH_TRUST_THRESHOLD  = 75;
    uint64  public constant MEDIUM_TRUST_THRESHOLD = 40;
    uint64  public constant MAX_SCORE              = 100;
    uint256 public constant SCORE_EXPIRY           = 90 days;

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    /// @dev Plaintext trust score per address.
    mapping(address => uint64) private _trustScores;

    /// @dev Whether a trust score has been recorded for an address.
    mapping(address => bool) private _hasScore;

    /// @dev Addresses authorized to submit trust scores.
    mapping(address => bool) public authorizedOracles;

    /// @dev Timestamp of the most recent score update per address.
    mapping(address => uint256) public lastScoreUpdate;

    /// @dev Total number of addresses with active (non-revoked) trust scores.
    uint256 public totalScoredAddresses;

    /// @dev Plaintext tier cache: 0 = LOW, 1 = MEDIUM, 2 = HIGH.
    mapping(address => uint8) private _tierCache;

    /// @notice AgentRegistry contract reference for owner-scoped score setting.
    address public agentRegistry;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event TrustScoreUpdated(address indexed account, uint64 score, uint8 tier, uint256 timestamp);
    event OracleAuthorized(address indexed oracle, bool authorized);
    event TrustScoreRevoked(address indexed account);
    event AgentRegistryUpdated(address indexed newRegistry);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error UnauthorizedOracle();
    error AccountNotScored();
    error ScoreExpired();
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

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ──────────────────────────────────────────────────────────────────
    //  Oracle Management
    // ──────────────────────────────────────────────────────────────────

    function setOracle(address oracle, bool authorized) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        authorizedOracles[oracle] = authorized;
        emit OracleAuthorized(oracle, authorized);
    }

    function setAgentRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        agentRegistry = _registry;
        emit AgentRegistryUpdated(_registry);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Management
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Sets a trust score from a plaintext value.
     * @param account Address whose score to set.
     * @param score   Plaintext score value (0-100). Clamped if above MAX_SCORE.
     */
    function setTrustScore(address account, uint64 score) external onlyScorer(account) {
        if (account == address(0)) revert ZeroAddress();

        uint64 clamped = score > MAX_SCORE ? uint64(MAX_SCORE) : score;
        uint8 tier = _computeTier(clamped);

        bool isNewScore = !_hasScore[account];

        _trustScores[account] = clamped;
        _hasScore[account] = true;
        _tierCache[account] = tier;
        lastScoreUpdate[account] = block.timestamp;

        if (isNewScore) {
            totalScoredAddresses++;
        }

        emit TrustScoreUpdated(account, clamped, tier, block.timestamp);
    }

    /**
     * @notice Sets multiple trust scores in a single transaction.
     * @param accounts Array of addresses to score.
     * @param scores   Array of plaintext scores.
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

            if (isOracle) {
                // Oracle -- always authorized
            } else if (isOwner && IAgentRegistry(agentRegistry).isActiveAgent(msg.sender, accounts[i])) {
                // Agent owner scoring own active agent
            } else {
                revert NotAuthorizedScorer();
            }

            uint64 clamped = scores[i] > MAX_SCORE ? uint64(MAX_SCORE) : scores[i];
            uint8 tier = _computeTier(clamped);

            bool isNewScore = !_hasScore[accounts[i]];

            _trustScores[accounts[i]] = clamped;
            _hasScore[accounts[i]] = true;
            _tierCache[accounts[i]] = tier;
            lastScoreUpdate[accounts[i]] = block.timestamp;

            if (isNewScore) {
                totalScoredAddresses++;
            }

            emit TrustScoreUpdated(accounts[i], clamped, tier, block.timestamp);
        }
    }

    // ──────────────────────────────────────────────────────────────────
    //  Score Revocation
    // ──────────────────────────────────────────────────────────────────

    function revokeScore(address account) external onlyOracle scored(account) {
        _trustScores[account] = 0;
        _hasScore[account] = false;
        _tierCache[account] = 0;
        lastScoreUpdate[account] = 0;
        totalScoredAddresses--;

        emit TrustScoreRevoked(account);
    }

    // ──────────────────────────────────────────────────────────────────
    //  ITrustScoring Implementation
    // ──────────────────────────────────────────────────────────────────

    /// @inheritdoc ITrustScoring
    function hasScore(address account) external view override returns (bool) {
        return _hasScore[account];
    }

    /// @inheritdoc ITrustScoring
    function isScoreExpired(address account) external view override returns (bool) {
        if (!_hasScore[account]) return true;
        return _isExpired(account);
    }

    /// @inheritdoc ITrustScoring
    function getTrustTierPlaintext(address account) external view override scored(account) returns (uint8) {
        return _tierCache[account];
    }

    // ──────────────────────────────────────────────────────────────────
    //  Additional View Functions
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the plaintext trust score for `account`.
     * @param account Address whose score to retrieve.
     */
    function getTrustScore(address account) external view scored(account) returns (uint64) {
        return _trustScores[account];
    }

    /**
     * @notice Returns whether the score is HIGH tier (>= 75).
     */
    function isHighTrust(address account) external view scored(account) notExpired(account) returns (bool) {
        return _trustScores[account] >= HIGH_TRUST_THRESHOLD;
    }

    /**
     * @notice Returns whether the score is MEDIUM tier (>= 40).
     */
    function isMediumTrust(address account) external view scored(account) notExpired(account) returns (bool) {
        return _trustScores[account] >= MEDIUM_TRUST_THRESHOLD;
    }

    /**
     * @notice Returns whether the score is LOW tier (< 40).
     */
    function isLowTrust(address account) external view scored(account) notExpired(account) returns (bool) {
        return _trustScores[account] < MEDIUM_TRUST_THRESHOLD;
    }

    // ──────────────────────────────────────────────────────────────────
    //  Internal Helpers
    // ──────────────────────────────────────────────────────────────────

    function _isExpired(address account) internal view returns (bool) {
        return block.timestamp > lastScoreUpdate[account] + SCORE_EXPIRY;
    }

    function _computeTier(uint64 score) internal pure returns (uint8) {
        if (score >= HIGH_TRUST_THRESHOLD) return 2;
        if (score >= MEDIUM_TRUST_THRESHOLD) return 1;
        return 0;
    }
}
