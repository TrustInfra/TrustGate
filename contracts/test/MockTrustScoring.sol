// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ITrustScoring} from "../ITrustScoring.sol";

/**
 * @title MockTrustScoring
 * @notice Non-FHE mock of TrustScoring for testing TrustGate on vanilla Hardhat.
 *         Stores plaintext scores and tiers without any coprocessor dependency.
 */
contract MockTrustScoring is ITrustScoring {
    mapping(address => bool) private _hasScore;
    mapping(address => uint8) private _tier;
    mapping(address => uint256) private _lastUpdate;
    uint256 public constant SCORE_EXPIRY = 90 days;

    function setScore(address account, uint8 tier) external {
        _hasScore[account] = true;
        _tier[account] = tier;
        _lastUpdate[account] = block.timestamp;
    }

    function clearScore(address account) external {
        _hasScore[account] = false;
        _tier[account] = 0;
        _lastUpdate[account] = 0;
    }

    function hasScore(address account) external view override returns (bool) {
        return _hasScore[account];
    }

    function isScoreExpired(address account) external view override returns (bool) {
        if (!_hasScore[account]) return true;
        return block.timestamp > _lastUpdate[account] + SCORE_EXPIRY;
    }

    function getTrustTierPlaintext(address account) external view override returns (uint8) {
        return _tier[account];
    }
}
