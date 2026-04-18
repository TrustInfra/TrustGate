// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title ITrustScoring
 * @notice Minimal interface consumed by TrustGate for trust-tier lookups.
 *         All score data remains encrypted on-chain; only the plaintext
 *         tier cache (set via plaintext setters) is exposed here.
 */
interface ITrustScoring {
    /// @notice Whether a trust score has been recorded for `account`.
    function hasScore(address account) external view returns (bool);

    /// @notice Whether the score for `account` has passed the 90-day expiry window.
    function isScoreExpired(address account) external view returns (bool);

    /// @notice Returns the plaintext trust tier: 2 = HIGH, 1 = MEDIUM, 0 = LOW.
    /// @dev    Only accurate when score was set via a plaintext setter.
    function getTrustTierPlaintext(address account) external view returns (uint8);
}
