// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IAgentRegistry} from "./IAgentRegistry.sol";

/**
 * @title AgentRegistry
 * @notice Permissionless registry for AI agents. Any address can register an
 *         agent it controls. Trust scores (managed by TrustScoring) handle
 *         quality filtering — low-trust agents receive escrowed payments via
 *         TrustGate rather than being blocked at registration.
 *
 * @dev Agent lifecycle:
 *      None → Active  (registerAgent)
 *      Active → Deactivated  (deactivateAgent — owner, permanent)
 *      Active → Suspended    (suspendAgent — contract owner, reversible)
 *      Suspended → Active    (reactivateAgent — contract owner)
 */
contract AgentRegistry is IAgentRegistry, Ownable2Step {
    // ──────────────────────────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────────────────────────

    enum AgentStatus {
        None,
        Active,
        Suspended,
        Deactivated
    }

    struct Agent {
        address owner;
        AgentStatus status;
        uint256 registeredAt;
        string metadataURI;
    }

    // ──────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────

    /// @dev Agent address → agent record.
    mapping(address => Agent) private _agents;

    /// @dev Whether an address has registered at least one active agent.
    mapping(address => bool) private _isOwner;

    /// @dev Owner address → ordered list of agent addresses they registered.
    mapping(address => address[]) private _ownedAgents;

    /// @notice Total number of agents currently in Active status.
    uint256 public totalActiveAgents;

    // ──────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, address indexed owner, string metadataURI);
    event AgentDeactivated(address indexed agent, address indexed owner);
    event AgentSuspended(address indexed agent);
    event AgentReactivated(address indexed agent);
    event AgentMetadataUpdated(address indexed agent, string metadataURI);

    // ──────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────

    error ZeroAddress();
    error AgentAlreadyRegistered();
    error AgentNotFound();
    error NotAgentOwner();
    error AgentNotActive();
    error AgentNotSuspended();
    error InvalidStatusTransition();

    // ──────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────

    /**
     * @param initialOwner Account that owns this contract (can suspend/reactivate agents).
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    // ──────────────────────────────────────────────────────────────────
    //  Registration
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Registers an AI agent. Permissionless — any address can register
     *         an agent it controls. The caller becomes the agent's owner.
     * @param agent       Address of the agent wallet.
     * @param metadataURI Off-chain pointer to agent metadata (capabilities, model, etc.).
     */
    function registerAgent(address agent, string calldata metadataURI) external {
        if (agent == address(0)) revert ZeroAddress();
        if (_agents[agent].status != AgentStatus.None) revert AgentAlreadyRegistered();

        _agents[agent] = Agent({
            owner: msg.sender,
            status: AgentStatus.Active,
            registeredAt: block.timestamp,
            metadataURI: metadataURI
        });

        _ownedAgents[msg.sender].push(agent);
        _isOwner[msg.sender] = true;
        totalActiveAgents++;

        emit AgentRegistered(agent, msg.sender, metadataURI);
    }

    // ──────────────────────────────────────────────────────────────────
    //  Lifecycle Management
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Permanently deactivates an agent. Only the agent's owner can call this.
     * @param agent Address of the agent to deactivate.
     */
    function deactivateAgent(address agent) external {
        Agent storage a = _agents[agent];
        if (a.status == AgentStatus.None) revert AgentNotFound();
        if (a.owner != msg.sender) revert NotAgentOwner();
        if (a.status == AgentStatus.Deactivated) revert InvalidStatusTransition();

        if (a.status == AgentStatus.Active) {
            totalActiveAgents--;
        }
        a.status = AgentStatus.Deactivated;

        emit AgentDeactivated(agent, msg.sender);
    }

    /**
     * @notice Suspends an active agent. Contract owner only — safety valve for
     *         malicious or compromised agents.
     * @param agent Address of the agent to suspend.
     */
    function suspendAgent(address agent) external onlyOwner {
        Agent storage a = _agents[agent];
        if (a.status != AgentStatus.Active) revert AgentNotActive();

        a.status = AgentStatus.Suspended;
        totalActiveAgents--;

        emit AgentSuspended(agent);
    }

    /**
     * @notice Reactivates a suspended agent. Contract owner only.
     * @param agent Address of the agent to reactivate.
     */
    function reactivateAgent(address agent) external onlyOwner {
        Agent storage a = _agents[agent];
        if (a.status != AgentStatus.Suspended) revert AgentNotSuspended();

        a.status = AgentStatus.Active;
        totalActiveAgents++;

        emit AgentReactivated(agent);
    }

    /**
     * @notice Updates the off-chain metadata pointer for an agent.
     *         Only the agent's owner can update metadata.
     * @param agent       Address of the agent.
     * @param metadataURI New metadata URI.
     */
    function updateMetadata(address agent, string calldata metadataURI) external {
        Agent storage a = _agents[agent];
        if (a.status == AgentStatus.None) revert AgentNotFound();
        if (a.owner != msg.sender) revert NotAgentOwner();

        a.metadataURI = metadataURI;

        emit AgentMetadataUpdated(agent, metadataURI);
    }

    // ──────────────────────────────────────────────────────────────────
    //  IAgentRegistry Implementation
    // ──────────────────────────────────────────────────────────────────

    /// @inheritdoc IAgentRegistry
    function isAgentOwner(address addr) external view override returns (bool) {
        return _isOwner[addr];
    }

    /// @inheritdoc IAgentRegistry
    function isActiveAgent(address owner, address agent) external view override returns (bool) {
        Agent storage a = _agents[agent];
        return a.owner == owner && a.status == AgentStatus.Active;
    }

    // ──────────────────────────────────────────────────────────────────
    //  View Functions
    // ──────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full agent record.
     * @param agent Address of the agent.
     * @return owner        The address that registered this agent.
     * @return status       Current lifecycle status.
     * @return registeredAt Timestamp of registration.
     * @return metadataURI  Off-chain metadata pointer.
     */
    function getAgent(address agent)
        external
        view
        returns (
            address owner,
            AgentStatus status,
            uint256 registeredAt,
            string memory metadataURI
        )
    {
        Agent storage a = _agents[agent];
        return (a.owner, a.status, a.registeredAt, a.metadataURI);
    }

    /**
     * @notice Returns all agent addresses registered by `owner`.
     * @dev    Includes deactivated and suspended agents. Filter by status off-chain.
     * @param owner Address of the agent owner.
     * @return agents Array of agent addresses.
     */
    function getAgentsByOwner(address owner) external view returns (address[] memory) {
        return _ownedAgents[owner];
    }
}
