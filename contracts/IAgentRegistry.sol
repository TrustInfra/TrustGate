// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/**
 * @title IAgentRegistry
 * @notice Minimal interface consumed by TrustScoring for authorization checks.
 *         Determines whether an address owns agents and whether a specific
 *         agent is active under a given owner.
 */
interface IAgentRegistry {
    /// @notice Returns true if `addr` has registered at least one agent.
    function isAgentOwner(address addr) external view returns (bool);

    /// @notice Returns true if `agent` is active and owned by `owner`.
    function isActiveAgent(address owner, address agent) external view returns (bool);
}
