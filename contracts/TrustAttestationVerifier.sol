// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TrustAttestationVerifier
 * @notice On-chain verification of TrustGate EIP-712 trust attestations.
 * @dev TrustGate provides the score signal. Protocols own ladders / policy.
 *      This contract only verifies signature, expiry, subject, and issuer registry.
 *      It does NOT set borrow limits or assert safety.
 *
 * Domain: TrustGateAttestation / version 1
 * Primary type: TrustAttestation
 */
contract TrustAttestationVerifier {
    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256(
            "EIP712Domain(string name,string version,uint256 chainId)"
        );

    bytes32 public constant ATTESTATION_TYPEHASH =
        keccak256(
            "TrustAttestation(string attestationId,address subject,string subjectType,uint256 chainId,uint256 score,string tier,uint256 confidence,string scoringVersion,string environment,uint256 issuedAt,uint256 expiresAt,bytes32 flagsHash,address issuer)"
        );

    bytes32 public constant NAME_HASH = keccak256(bytes("TrustGateAttestation"));
    bytes32 public constant VERSION_HASH = keccak256(bytes("1"));

    address public owner;
    mapping(address => bool) public authorizedIssuers;

    event IssuerUpdated(address indexed issuer, bool authorized);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error Unauthorized();
    error Expired();
    error BadSubject();
    error BadChain();
    error BadIssuer();
    error BadSignature();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address initialIssuer) {
        owner = msg.sender;
        if (initialIssuer != address(0)) {
            authorizedIssuers[initialIssuer] = true;
            emit IssuerUpdated(initialIssuer, true);
        }
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    function setIssuer(address issuer, bool authorized) external onlyOwner {
        authorizedIssuers[issuer] = authorized;
        emit IssuerUpdated(issuer, authorized);
    }

    struct Attestation {
        string attestationId;
        address subject;
        string subjectType;
        uint256 chainId;
        uint256 score;
        string tier;
        uint256 confidence;
        string scoringVersion;
        string environment;
        uint256 issuedAt;
        uint256 expiresAt;
        bytes32 flagsHash;
        address issuer;
    }

    function domainSeparator() public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    EIP712_DOMAIN_TYPEHASH,
                    NAME_HASH,
                    VERSION_HASH,
                    block.chainid
                )
            );
    }

    function hashAttestation(Attestation calldata a) public pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    ATTESTATION_TYPEHASH,
                    keccak256(bytes(a.attestationId)),
                    a.subject,
                    keccak256(bytes(a.subjectType)),
                    a.chainId,
                    a.score,
                    keccak256(bytes(a.tier)),
                    a.confidence,
                    keccak256(bytes(a.scoringVersion)),
                    keccak256(bytes(a.environment)),
                    a.issuedAt,
                    a.expiresAt,
                    a.flagsHash,
                    a.issuer
                )
            );
    }

    /**
     * @notice Verify attestation for expectedSubject. Fail-closed.
     * @return score Confidence is also returned for protocol policy.
     */
    function verify(
        Attestation calldata a,
        bytes calldata signature,
        address expectedSubject
    ) external view returns (uint256 score, uint256 confidence, uint256 expiresAt) {
        if (a.subject != expectedSubject) revert BadSubject();
        if (a.chainId != block.chainid) revert BadChain();
        if (block.timestamp > a.expiresAt) revert Expired();
        if (!authorizedIssuers[a.issuer]) revert BadIssuer();

        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", domainSeparator(), hashAttestation(a))
        );

        address recovered = _recover(digest, signature);
        if (recovered == address(0) || recovered != a.issuer) revert BadSignature();

        return (a.score, a.confidence, a.expiresAt);
    }

    /**
     * @notice Example helper: protocol checks score >= minScore after verify.
     *         Policy thresholds are the CALLER's responsibility — not TrustGate's.
     */
    function verifyMinScore(
        Attestation calldata a,
        bytes calldata signature,
        address expectedSubject,
        uint256 minScore
    ) external view returns (bool ok) {
        (uint256 score, , ) = this.verify(a, signature, expectedSubject);
        return score >= minScore;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
