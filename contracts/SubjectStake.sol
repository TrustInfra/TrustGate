// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title SubjectStake
 * @notice Lock USDC for or against an identity, or a claim about that identity.
 *         Linear in/out. 7-day unbond. Optional public reason per side.
 *
 * @dev Subject id = keccak256(abi.encodePacked(kind, ":", canonical)).
 *      Claims are subjects with kind "claim" and parentId set. Amounts are
 *      6-decimal USDC via the ERC-20 interface.
 */
contract SubjectStake is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant UNBOND_PERIOD = 7 days;
    uint256 public constant MIN_STAKE = 1e6;
    uint256 public constant MAX_KIND_LEN = 32;
    uint256 public constant MAX_CANONICAL_LEN = 256;
    uint256 public constant MAX_STATEMENT_LEN = 160;
    uint256 public constant MAX_REASON_LEN = 280;
    uint256 public constant MAX_PENDING_UNBONDS = 20;
    uint256 public constant MAX_CLAIMS_PER_PARENT = 64;

    enum Side {
        Support,
        Challenge
    }

    struct Subject {
        string kind;
        string canonical;
        bool exists;
        uint256 supportTotal;
        uint256 challengeTotal;
        uint256 stakerCount;
        uint256 supportStakers;
        uint256 challengeStakers;
        bytes32 parentId;
        string statement;
    }

    struct Position {
        uint256 support;
        uint256 challenge;
        string supportReason;
        string challengeReason;
    }

    struct Unbond {
        uint256 amount;
        Side side;
        uint256 availableAt;
        bool claimed;
    }

    IERC20 public immutable usdc;

    mapping(bytes32 => Subject) public subjects;
    mapping(bytes32 => mapping(address => Position)) public positions;
    mapping(bytes32 => mapping(address => Unbond[])) private _unbonds;
    mapping(bytes32 => bytes32[]) private _childClaims;
    mapping(bytes32 => address[]) private _stakers;
    mapping(bytes32 => mapping(address => bool)) private _listed;

    event SubjectCreated(bytes32 indexed subjectId, string kind, string canonical);
    event ClaimCreated(
        bytes32 indexed parentId,
        bytes32 indexed claimId,
        string statement
    );
    event Staked(
        bytes32 indexed subjectId,
        address indexed staker,
        Side side,
        uint256 amount,
        string reason
    );
    event UnbondRequested(
        bytes32 indexed subjectId,
        address indexed staker,
        Side side,
        uint256 amount,
        uint256 availableAt,
        uint256 index
    );
    event Withdrawn(
        bytes32 indexed subjectId,
        address indexed staker,
        uint256 index,
        uint256 amount
    );

    error ZeroAddress();
    error BelowMinimum();
    error InvalidKind();
    error InvalidCanonical();
    error InvalidStatement();
    error InvalidReason();
    error UnknownSubject();
    error InsufficientPosition();
    error UnbondQueueFull();
    error AlreadyClaimed();
    error StillLocked();
    error ZeroAmount();
    error TooManyClaims();

    constructor(address usdc_, address initialOwner) Ownable(initialOwner) {
        if (usdc_ == address(0) || initialOwner == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
    }

    function subjectIdOf(
        string memory kind,
        string memory canonical
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(kind, ":", canonical));
    }

    function claimIdOf(
        bytes32 parentId,
        string memory statement
    ) public pure returns (bytes32) {
        return subjectIdOf("claim", _claimCanonical(parentId, statement));
    }

    function pendingUnbondCount(
        bytes32 subjectId,
        address staker
    ) external view returns (uint256) {
        return _unbonds[subjectId][staker].length;
    }

    function getUnbond(
        bytes32 subjectId,
        address staker,
        uint256 index
    ) external view returns (Unbond memory) {
        return _unbonds[subjectId][staker][index];
    }

    function childClaimCount(bytes32 parentId) external view returns (uint256) {
        return _childClaims[parentId].length;
    }

    function childClaimAt(
        bytes32 parentId,
        uint256 index
    ) external view returns (bytes32) {
        return _childClaims[parentId][index];
    }

    function listedStakerCount(bytes32 subjectId) external view returns (uint256) {
        return _stakers[subjectId].length;
    }

    function listedStakerAt(
        bytes32 subjectId,
        uint256 index
    ) external view returns (address) {
        return _stakers[subjectId][index];
    }

    function stake(
        string calldata kind,
        string calldata canonical,
        Side side,
        uint256 amount,
        string calldata reason
    ) external nonReentrant {
        _validateIdentity(kind, canonical);
        _validateReason(reason);
        bytes32 id = subjectIdOf(kind, canonical);
        Subject storage s = subjects[id];
        if (!s.exists) {
            s.kind = kind;
            s.canonical = canonical;
            s.exists = true;
            emit SubjectCreated(id, kind, canonical);
        }
        _credit(id, s, side, amount, reason);
    }

    function stakeClaim(
        string calldata parentKind,
        string calldata parentCanonical,
        string calldata statement,
        Side side,
        uint256 amount,
        string calldata reason
    ) external nonReentrant {
        _validateIdentity(parentKind, parentCanonical);
        _validateStatement(statement);
        _validateReason(reason);

        bytes32 parentId = subjectIdOf(parentKind, parentCanonical);
        Subject storage parent = subjects[parentId];
        if (!parent.exists) {
            parent.kind = parentKind;
            parent.canonical = parentCanonical;
            parent.exists = true;
            emit SubjectCreated(parentId, parentKind, parentCanonical);
        }

        string memory canonical = _claimCanonical(parentId, statement);
        bytes32 id = subjectIdOf("claim", canonical);
        Subject storage s = subjects[id];
        if (!s.exists) {
            if (_childClaims[parentId].length >= MAX_CLAIMS_PER_PARENT) {
                revert TooManyClaims();
            }
            s.kind = "claim";
            s.canonical = canonical;
            s.exists = true;
            s.parentId = parentId;
            s.statement = statement;
            _childClaims[parentId].push(id);
            emit SubjectCreated(id, "claim", canonical);
            emit ClaimCreated(parentId, id, statement);
        }

        _credit(id, s, side, amount, reason);
    }

    function requestUnbond(
        bytes32 subjectId,
        Side side,
        uint256 amount
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Subject storage s = subjects[subjectId];
        if (!s.exists) revert UnknownSubject();

        if (amount < MIN_STAKE) revert BelowMinimum();

        Position storage p = positions[subjectId][msg.sender];
        Unbond[] storage q = _unbonds[subjectId][msg.sender];

        if (side == Side.Support) {
            if (p.support < amount) revert InsufficientPosition();
            p.support -= amount;
            s.supportTotal -= amount;
            if (p.support == 0 && s.supportStakers > 0) s.supportStakers -= 1;
        } else {
            if (p.challenge < amount) revert InsufficientPosition();
            p.challenge -= amount;
            s.challengeTotal -= amount;
            if (p.challenge == 0 && s.challengeStakers > 0) s.challengeStakers -= 1;
        }

        if (p.support == 0 && p.challenge == 0 && s.stakerCount > 0) {
            s.stakerCount -= 1;
        }

        uint256 availableAt = block.timestamp + UNBOND_PERIOD;
        uint256 index = type(uint256).max;
        for (uint256 i = 0; i < q.length; i++) {
            if (q[i].claimed) {
                index = i;
                break;
            }
        }
        if (index == type(uint256).max) {
            if (q.length >= MAX_PENDING_UNBONDS) revert UnbondQueueFull();
            q.push(
                Unbond({
                    amount: amount,
                    side: side,
                    availableAt: availableAt,
                    claimed: false
                })
            );
            index = q.length - 1;
        } else {
            q[index] = Unbond({
                amount: amount,
                side: side,
                availableAt: availableAt,
                claimed: false
            });
        }
        emit UnbondRequested(
            subjectId,
            msg.sender,
            side,
            amount,
            availableAt,
            index
        );
    }

    function withdraw(bytes32 subjectId, uint256 index) external nonReentrant {
        Unbond storage u = _unbonds[subjectId][msg.sender][index];
        if (u.claimed) revert AlreadyClaimed();
        if (block.timestamp < u.availableAt) revert StillLocked();
        u.claimed = true;
        usdc.safeTransfer(msg.sender, u.amount);
        emit Withdrawn(subjectId, msg.sender, index, u.amount);
    }

    function _credit(
        bytes32 id,
        Subject storage s,
        Side side,
        uint256 amount,
        string calldata reason
    ) internal {
        if (amount < MIN_STAKE) revert BelowMinimum();

        Position storage p = positions[id][msg.sender];
        bool wasEmpty = p.support == 0 && p.challenge == 0;
        bool newSupport = p.support == 0;
        bool newChallenge = p.challenge == 0;

        if (side == Side.Support) {
            p.support += amount;
            s.supportTotal += amount;
            if (bytes(reason).length > 0) p.supportReason = reason;
            if (newSupport) s.supportStakers += 1;
        } else {
            p.challenge += amount;
            s.challengeTotal += amount;
            if (bytes(reason).length > 0) p.challengeReason = reason;
            if (newChallenge) s.challengeStakers += 1;
        }

        if (wasEmpty) {
            s.stakerCount += 1;
            if (!_listed[id][msg.sender]) {
                _listed[id][msg.sender] = true;
                _stakers[id].push(msg.sender);
            }
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(id, msg.sender, side, amount, reason);
    }

    function _validateIdentity(
        string calldata kind,
        string calldata canonical
    ) internal pure {
        uint256 kindLen = bytes(kind).length;
        uint256 canonLen = bytes(canonical).length;
        if (kindLen == 0 || kindLen > MAX_KIND_LEN) revert InvalidKind();
        if (canonLen == 0 || canonLen > MAX_CANONICAL_LEN) revert InvalidCanonical();
    }

    function _validateStatement(string calldata statement) internal pure {
        uint256 n = bytes(statement).length;
        if (n == 0 || n > MAX_STATEMENT_LEN) revert InvalidStatement();
    }

    function _validateReason(string calldata reason) internal pure {
        if (bytes(reason).length > MAX_REASON_LEN) revert InvalidReason();
    }

    function _claimCanonical(
        bytes32 parentId,
        string memory statement
    ) internal pure returns (string memory) {
        return
            string.concat(
                "c:",
                Strings.toHexString(uint256(parentId), 32),
                ":",
                Strings.toHexString(uint256(keccak256(bytes(statement))), 32)
            );
    }
}
