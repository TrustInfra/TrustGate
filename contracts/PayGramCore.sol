// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {TrustScoring} from "./TrustScoring.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";

/**
 * @title PayGramCore
 * @notice Multi-employer payroll engine that routes encrypted salary payments through
 *         trust-gated tiers. Any address can register as an employer and manage its own
 *         independent roster of employees and payroll runs. The contract reads each
 *         employee's encrypted trust tier from TrustScoring and routes payment
 *         accordingly -- instant, delayed, or escrowed -- all without revealing
 *         salaries or scores to any party.
 *
 * @dev Payment routing logic (fully oblivious via FHE.select):
 *      1. HIGH trust  (score >= 75) -> immediate encrypted transfer
 *      2. MEDIUM trust (score >= 40) -> 24-hour time-locked release
 *      3. LOW trust   (score <  40) -> milestone-gated escrow
 *
 *      Employees without a trust score are treated as LOW trust.
 *      The PayGramCore contract holds tokens pre-funded by the employer.
 *      All payroll disbursements are confidential ERC-7984 transfers from
 *      the contract's own balance to employees.
 */
contract PayGramCore is ZamaEthereumConfig, Ownable2Step {
    // ------------------------------------------------------------------
    //  Constants
    // ------------------------------------------------------------------

    uint256 public constant DELAY_PERIOD   = 24 hours;
    uint256 public constant MAX_BATCH_SIZE = 50;

    // ------------------------------------------------------------------
    //  Enums
    // ------------------------------------------------------------------

    enum PaymentStatus {
        None,       // 0 -- default / uninitialized
        Instant,    // 1 -- immediate transfer (high trust)
        Delayed,    // 2 -- time-locked release (medium trust)
        Escrowed,   // 3 -- milestone-gated (low trust / unscored)
        Released,   // 4 -- funds disbursed
        Completed   // 5 -- finalized or cancelled
    }

    // ------------------------------------------------------------------
    //  Structs
    // ------------------------------------------------------------------

    struct Employee {
        address wallet;
        euint64 encryptedSalary;
        bool    isActive;
        uint256 hireDate;
        uint256 lastPayDate;
        string  role;
    }

    struct PendingPayment {
        uint256       id;
        address       employee;
        address       employer;
        euint64       encryptedAmount;
        PaymentStatus status;
        uint256       createdAt;
        uint256       releaseTime;
        string        milestone;
    }

    // ------------------------------------------------------------------
    //  State
    // ------------------------------------------------------------------

    TrustScoring public trustScoring;
    address      public payToken;

    /// @notice Whether an address has registered as an employer.
    mapping(address => bool) public isEmployer;

    /// @dev Employee list per employer.
    mapping(address => address[]) private _employerEmployees;

    /// @dev Employee data scoped by employer.
    mapping(address => mapping(address => Employee)) private _employerEmployeeData;

    /// @notice Reverse lookup: employee wallet -> employer address.
    mapping(address => address) public employerOf;

    /// @dev Number of payroll runs per employer.
    mapping(address => uint256) public employerPayrollCount;

    mapping(uint256 => PendingPayment) public pendingPayments;
    uint256 public nextPaymentId;

    /// @notice Plaintext salary mirror for frontend reads (set by plaintext helpers).
    mapping(address => mapping(address => uint256)) public plaintextSalaries;

    /// @dev Simple reentrancy lock for payroll execution.
    bool private _payrollLock;

    // ------------------------------------------------------------------
    //  Events
    // ------------------------------------------------------------------

    event EmployerRegistered(address indexed employer);
    event EmployeeAdded(address indexed employer, address indexed employee, string role, uint256 hireDate);
    event EmployeeRemoved(address indexed employer, address indexed employee);
    event EmployeeUpdated(address indexed employer, address indexed employee);
    event SalaryUpdated(address indexed employer, address indexed employee);
    event PayrollExecuted(
        address indexed employer,
        uint256 indexed payrollId,
        uint256 timestamp,
        uint256 employeeCount
    );
    event InstantPayment(address indexed employer, address indexed employee, uint256 timestamp);
    event PaymentDelayed(
        uint256 indexed paymentId,
        address indexed employee,
        uint256 releaseTime
    );
    event PaymentEscrowed(
        uint256 indexed paymentId,
        address indexed employee,
        string milestone
    );
    event PaymentReleased(uint256 indexed paymentId, address indexed employee);
    event PaymentCancelled(uint256 indexed paymentId, address indexed employee);
    event TrustScoringUpdated(address indexed newTrustScoring);
    event PayTokenUpdated(address indexed newPayToken);

    // ------------------------------------------------------------------
    //  Errors
    // ------------------------------------------------------------------

    error NotEmployer();
    error AlreadyEmployer();
    error EmployeeAlreadyExists();
    error EmployeeNotFound();
    error EmployeeNotActive();
    error PaymentNotFound();
    error PaymentNotReleasable();
    error PaymentAlreadyProcessed();
    error NotPaymentEmployer();
    error DelayNotElapsed();
    error PayrollLocked();
    error BatchTooLarge();
    error ZeroAddress();
    error ArrayLengthMismatch();

    // ------------------------------------------------------------------
    //  Modifiers
    // ------------------------------------------------------------------

    modifier onlyEmployer() {
        if (!isEmployer[msg.sender]) revert NotEmployer();
        _;
    }

    modifier noReentrantPayroll() {
        if (_payrollLock) revert PayrollLocked();
        _payrollLock = true;
        _;
        _payrollLock = false;
    }

    // ------------------------------------------------------------------
    //  Constructor
    // ------------------------------------------------------------------

    /**
     * @param initialOwner    Admin (for Ownable2Step).
     * @param employerAddress The initial employer auto-registered at deploy.
     * @param _trustScoring   Deployed TrustScoring contract.
     * @param _payToken       Deployed PayGramToken (ERC-7984) address.
     */
    constructor(
        address initialOwner,
        address employerAddress,
        address _trustScoring,
        address _payToken
    ) Ownable(initialOwner) {
        if (employerAddress == address(0)) revert ZeroAddress();
        if (_trustScoring == address(0)) revert ZeroAddress();
        if (_payToken == address(0)) revert ZeroAddress();

        isEmployer[employerAddress] = true;
        emit EmployerRegistered(employerAddress);

        trustScoring = TrustScoring(_trustScoring);
        payToken     = _payToken;
    }

    // ------------------------------------------------------------------
    //  Employer Registration
    // ------------------------------------------------------------------

    /**
     * @notice Registers the caller as an employer.
     */
    function registerAsEmployer() external {
        if (isEmployer[msg.sender]) revert AlreadyEmployer();
        isEmployer[msg.sender] = true;
        emit EmployerRegistered(msg.sender);
    }

    // ------------------------------------------------------------------
    //  Employee Management
    // ------------------------------------------------------------------

    /**
     * @notice Registers an employee with an FHE-encrypted salary.
     * @param wallet          Employee's receiving address.
     * @param encryptedSalary FHE-encrypted salary amount.
     * @param inputProof      ZKPoK proof for the encrypted value.
     * @param role            Human-readable role label (e.g. "engineer").
     */
    function addEmployee(
        address wallet,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof,
        string calldata role
    ) external onlyEmployer {
        if (wallet == address(0)) revert ZeroAddress();
        if (_employerEmployeeData[msg.sender][wallet].wallet != address(0))
            revert EmployeeAlreadyExists();

        euint64 salary = FHE.fromExternal(encryptedSalary, inputProof);
        _storeEmployee(msg.sender, wallet, salary, role);
    }

    /**
     * @notice Registers an employee with a plaintext salary (testing convenience).
     * @param wallet Employee address.
     * @param salary Plaintext salary amount.
     * @param role   Role label.
     */
    function addEmployeePlaintext(
        address wallet,
        uint64 salary,
        string calldata role
    ) external onlyEmployer {
        if (wallet == address(0)) revert ZeroAddress();
        if (_employerEmployeeData[msg.sender][wallet].wallet != address(0))
            revert EmployeeAlreadyExists();

        euint64 encrypted = FHE.asEuint64(salary);
        _storeEmployee(msg.sender, wallet, encrypted, role);
        plaintextSalaries[msg.sender][wallet] = salary;
    }

    /**
     * @notice Deactivates an employee. Record retained for audit.
     * @param wallet Employee to deactivate.
     */
    function removeEmployee(address wallet) external onlyEmployer {
        Employee storage emp = _employerEmployeeData[msg.sender][wallet];
        if (emp.wallet == address(0)) revert EmployeeNotFound();
        if (!emp.isActive) revert EmployeeNotActive();

        emp.isActive = false;
        emit EmployeeRemoved(msg.sender, wallet);
    }

    /**
     * @notice Updates the encrypted salary for an active employee.
     * @param wallet          Employee address.
     * @param encryptedSalary New FHE-encrypted salary.
     * @param inputProof      ZKPoK proof for the new value.
     */
    function updateSalary(
        address wallet,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        _requireActiveEmployee(msg.sender, wallet);

        euint64 salary = FHE.fromExternal(encryptedSalary, inputProof);
        _setSalaryPermissions(msg.sender, wallet, salary);
        _employerEmployeeData[msg.sender][wallet].encryptedSalary = salary;

        emit SalaryUpdated(msg.sender, wallet);
    }

    /**
     * @notice Updates salary from a plaintext value (testing convenience).
     * @param wallet Employee address.
     * @param salary New plaintext salary.
     */
    function updateSalaryPlaintext(
        address wallet,
        uint64 salary
    ) external onlyEmployer {
        _requireActiveEmployee(msg.sender, wallet);

        euint64 encrypted = FHE.asEuint64(salary);
        _setSalaryPermissions(msg.sender, wallet, encrypted);
        _employerEmployeeData[msg.sender][wallet].encryptedSalary = encrypted;
        plaintextSalaries[msg.sender][wallet] = salary;

        emit SalaryUpdated(msg.sender, wallet);
    }

    /**
     * @notice Updates the role label for an active employee.
     * @param wallet  Employee address.
     * @param newRole New role string.
     */
    function updateEmployeeRole(
        address wallet,
        string calldata newRole
    ) external onlyEmployer {
        _requireActiveEmployee(msg.sender, wallet);
        _employerEmployeeData[msg.sender][wallet].role = newRole;
        emit EmployeeUpdated(msg.sender, wallet);
    }

    // ------------------------------------------------------------------
    //  Payroll Execution
    // ------------------------------------------------------------------

    /**
     * @notice Runs payroll for all active employees of the calling employer.
     * @dev    For each active employee:
     *         - If the employee has a trust score, uses FHE tier evaluation
     *           to route salary through instant / delayed / escrow paths.
     *         - If no trust score exists, defaults to escrow (LOW trust).
     *
     *         FHE.select ensures the routing is fully oblivious -- no tier
     *         information is revealed on-chain.
     *
     *         Instant payments transfer immediately from the contract balance.
     *         Delayed and escrowed payments are held until released.
     */
    function executePayroll() external onlyEmployer noReentrantPayroll {
        uint256 processed = 0;
        address[] storage empList = _employerEmployees[msg.sender];
        uint256 len = empList.length;

        for (uint256 i = 0; i < len && processed < MAX_BATCH_SIZE; i++) {
            Employee storage emp = _employerEmployeeData[msg.sender][empList[i]];
            if (!emp.isActive) continue;

            processed++;

            if (!trustScoring.hasScore(emp.wallet)) {
                // No trust score -> default to escrow (LOW trust)
                _processEscrowPayment(msg.sender, emp);
            } else {
                // Scored -> FHE tier evaluation and oblivious routing
                _processWithTrustTier(msg.sender, emp);
            }

            emp.lastPayDate = block.timestamp;
        }

        employerPayrollCount[msg.sender]++;
        emit PayrollExecuted(
            msg.sender,
            employerPayrollCount[msg.sender],
            block.timestamp,
            processed
        );
    }

    // ------------------------------------------------------------------
    //  Payment Management
    // ------------------------------------------------------------------

    /**
     * @notice Releases a delayed or escrowed payment.
     * @dev    - Delayed: anyone may release once releaseTime has passed.
     *         - Escrowed: only the payment's employer may release (milestone approval).
     *         Executes a confidential ERC-7984 transfer from the contract's
     *         token balance to the employee.
     * @param paymentId Identifier of the payment to release.
     */
    function releasePayment(uint256 paymentId) external {
        PendingPayment storage p = pendingPayments[paymentId];
        if (p.status == PaymentStatus.None) revert PaymentNotFound();

        if (p.status == PaymentStatus.Delayed) {
            if (block.timestamp < p.releaseTime) revert DelayNotElapsed();
        } else if (p.status == PaymentStatus.Escrowed) {
            if (msg.sender != p.employer) revert NotPaymentEmployer();
        } else {
            revert PaymentNotReleasable();
        }

        p.status = PaymentStatus.Released;

        // Execute confidential transfer from contract balance to employee
        FHE.allow(p.encryptedAmount, payToken);
        IERC7984(payToken).confidentialTransfer(p.employee, p.encryptedAmount);

        emit PaymentReleased(paymentId, p.employee);
    }

    /**
     * @notice Cancels a pending payment (delayed or escrowed only).
     * @param paymentId Identifier of the payment to cancel.
     */
    function cancelPayment(uint256 paymentId) external {
        PendingPayment storage p = pendingPayments[paymentId];
        if (p.status == PaymentStatus.None) revert PaymentNotFound();
        if (msg.sender != p.employer) revert NotPaymentEmployer();
        if (
            p.status != PaymentStatus.Delayed &&
            p.status != PaymentStatus.Escrowed
        ) revert PaymentAlreadyProcessed();

        p.status = PaymentStatus.Completed;
        emit PaymentCancelled(paymentId, p.employee);
    }

    // ------------------------------------------------------------------
    //  View Functions
    // ------------------------------------------------------------------

    /**
     * @notice Returns non-encrypted employee information.
     * @param employer Employer address.
     * @param wallet   Employee address.
     */
    function getEmployee(
        address employer,
        address wallet
    )
        external
        view
        returns (
            address empWallet,
            bool    isActive,
            uint256 hireDate,
            uint256 lastPayDate,
            string memory role
        )
    {
        Employee storage emp = _employerEmployeeData[employer][wallet];
        if (emp.wallet == address(0)) revert EmployeeNotFound();
        return (emp.wallet, emp.isActive, emp.hireDate, emp.lastPayDate, emp.role);
    }

    /**
     * @notice Returns the plaintext salary stored by addEmployeePlaintext / updateSalaryPlaintext.
     * @param employer Employer address.
     * @param wallet   Employee address.
     */
    function getPlaintextSalary(
        address employer,
        address wallet
    ) external view returns (uint256) {
        return plaintextSalaries[employer][wallet];
    }

    /**
     * @notice Returns the full employee list for the given employer (active + inactive addresses).
     * @param employer Employer address.
     */
    function getEmployeeList(address employer) external view returns (address[] memory) {
        return _employerEmployees[employer];
    }

    /**
     * @notice Returns the count of registered employees for the given employer.
     * @param employer Employer address.
     */
    function employeeCount(address employer) external view returns (uint256) {
        return _employerEmployees[employer].length;
    }

    /**
     * @notice Returns the count of currently active employees for the given employer.
     * @param employer Employer address.
     */
    function activeEmployeeCount(address employer) external view returns (uint256 count) {
        address[] storage empList = _employerEmployees[employer];
        uint256 len = empList.length;
        for (uint256 i = 0; i < len; i++) {
            if (_employerEmployeeData[employer][empList[i]].isActive) count++;
        }
    }

    /**
     * @notice Returns non-encrypted fields of a pending payment.
     * @param paymentId Payment identifier.
     */
    function getPendingPayment(
        uint256 paymentId
    )
        external
        view
        returns (
            address       employee,
            address       employer,
            PaymentStatus status,
            uint256       createdAt,
            uint256       releaseTime,
            string memory milestone
        )
    {
        PendingPayment storage p = pendingPayments[paymentId];
        if (p.status == PaymentStatus.None) revert PaymentNotFound();
        return (p.employee, p.employer, p.status, p.createdAt, p.releaseTime, p.milestone);
    }

    /**
     * @notice Returns all pending payment IDs for a given employee.
     * @param employee Employee address to query.
     */
    function getPendingPaymentsForEmployee(
        address employee
    ) external view returns (uint256[] memory) {
        uint256 total = nextPaymentId;
        uint256 matchCount = 0;

        for (uint256 i = 0; i < total; i++) {
            if (pendingPayments[i].employee == employee) matchCount++;
        }

        uint256[] memory result = new uint256[](matchCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            if (pendingPayments[i].employee == employee) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /**
     * @notice Returns IDs of payments that are ready to be released.
     * @dev    Delayed payments where releaseTime has passed, plus any
     *         escrowed payments awaiting employer approval.
     */
    function getReleasablePayments()
        external
        view
        returns (uint256[] memory)
    {
        uint256 total = nextPaymentId;
        uint256 matchCount = 0;

        for (uint256 i = 0; i < total; i++) {
            PaymentStatus s = pendingPayments[i].status;
            if (
                (s == PaymentStatus.Delayed &&
                    block.timestamp >= pendingPayments[i].releaseTime) ||
                s == PaymentStatus.Escrowed
            ) {
                matchCount++;
            }
        }

        uint256[] memory result = new uint256[](matchCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < total; i++) {
            PaymentStatus s = pendingPayments[i].status;
            if (
                (s == PaymentStatus.Delayed &&
                    block.timestamp >= pendingPayments[i].releaseTime) ||
                s == PaymentStatus.Escrowed
            ) {
                result[idx++] = i;
            }
        }
        return result;
    }

    /**
     * @notice Returns the contract's encrypted token balance.
     * @dev    Callers must hold an FHE decryption grant to read the plaintext.
     */
    function getContractBalance() external view returns (euint64) {
        return IERC7984(payToken).confidentialBalanceOf(address(this));
    }

    /**
     * @notice Returns true if `wallet` is a registered active employee of `employer`.
     * @param employer Employer address.
     * @param wallet   Employee address.
     */
    function isActiveEmployee(address employer, address wallet) external view returns (bool) {
        return _employerEmployeeData[employer][wallet].isActive;
    }

    // ------------------------------------------------------------------
    //  Admin Functions
    // ------------------------------------------------------------------

    /**
     * @notice Updates the TrustScoring contract reference.
     * @param newTrustScoring Address of the new TrustScoring contract.
     */
    function updateTrustScoring(address newTrustScoring) external onlyOwner {
        if (newTrustScoring == address(0)) revert ZeroAddress();
        trustScoring = TrustScoring(newTrustScoring);
        emit TrustScoringUpdated(newTrustScoring);
    }

    /**
     * @notice Updates the ERC-7984 payment token address.
     * @param newPayToken Address of the new payment token.
     */
    function updatePayToken(address newPayToken) external onlyOwner {
        if (newPayToken == address(0)) revert ZeroAddress();
        payToken = newPayToken;
        emit PayTokenUpdated(newPayToken);
    }

    // ------------------------------------------------------------------
    //  Internal -- Employee Helpers
    // ------------------------------------------------------------------

    /**
     * @dev Stores a new Employee struct, sets FHE permissions, updates list.
     */
    function _storeEmployee(
        address employer,
        address wallet,
        euint64 salary,
        string calldata role
    ) internal {
        _setSalaryPermissions(employer, wallet, salary);

        _employerEmployeeData[employer][wallet] = Employee({
            wallet:          wallet,
            encryptedSalary: salary,
            isActive:        true,
            hireDate:        block.timestamp,
            lastPayDate:     0,
            role:            role
        });
        _employerEmployees[employer].push(wallet);
        employerOf[wallet] = employer;

        emit EmployeeAdded(employer, wallet, role, block.timestamp);
    }

    /**
     * @dev Grants FHE read permission on a salary ciphertext to the
     *      contract itself, the employer, and the employee.
     */
    function _setSalaryPermissions(address employer, address wallet, euint64 salary) internal {
        FHE.allowThis(salary);
        FHE.allow(salary, employer);
        FHE.allow(salary, wallet);
    }

    /**
     * @dev Reverts if `wallet` is not a registered, active employee of `employer`.
     */
    function _requireActiveEmployee(address employer, address wallet) internal view {
        Employee storage emp = _employerEmployeeData[employer][wallet];
        if (emp.wallet == address(0)) revert EmployeeNotFound();
        if (!emp.isActive) revert EmployeeNotActive();
    }

    // ------------------------------------------------------------------
    //  Internal -- Payroll Processing
    // ------------------------------------------------------------------

    /**
     * @dev Routes a scored employee's salary through trust tiers using
     *      FHE.select for fully oblivious branching.
     */
    function _processWithTrustTier(address employer, Employee storage emp) internal {
        ebool isHigh = trustScoring.isHighTrust(emp.wallet);
        ebool isMed  = trustScoring.isMediumTrust(emp.wallet);

        FHE.allowThis(isHigh);
        FHE.allowThis(isMed);

        euint64 zero = FHE.asEuint64(0);

        euint64 instantAmt = FHE.select(isHigh, emp.encryptedSalary, zero);
        euint64 remaining  = FHE.sub(emp.encryptedSalary, instantAmt);
        euint64 delayedAmt = FHE.select(isMed, remaining, zero);
        euint64 escrowAmt  = FHE.sub(remaining, delayedAmt);

        _processInstantPayment(employer, emp.wallet, instantAmt);
        _processDelayedPayment(employer, emp.wallet, delayedAmt);
        _processEscrowPaymentEncrypted(employer, emp.wallet, escrowAmt);
    }

    /**
     * @dev Handles an instant payment (HIGH trust path).
     */
    function _processInstantPayment(
        address employer,
        address employee,
        euint64 amount
    ) internal {
        FHE.allowThis(amount);

        FHE.allow(amount, payToken);
        IERC7984(payToken).confidentialTransfer(employee, amount);

        uint256 id = nextPaymentId++;

        pendingPayments[id] = PendingPayment({
            id:              id,
            employee:        employee,
            employer:        employer,
            encryptedAmount: amount,
            status:          PaymentStatus.Instant,
            createdAt:       block.timestamp,
            releaseTime:     0,
            milestone:       ""
        });

        emit InstantPayment(employer, employee, block.timestamp);
    }

    /**
     * @dev Handles a delayed payment (MEDIUM trust path).
     */
    function _processDelayedPayment(
        address employer,
        address employee,
        euint64 amount
    ) internal {
        uint256 id          = nextPaymentId++;
        uint256 releaseTime = block.timestamp + DELAY_PERIOD;

        FHE.allowThis(amount);

        pendingPayments[id] = PendingPayment({
            id:              id,
            employee:        employee,
            employer:        employer,
            encryptedAmount: amount,
            status:          PaymentStatus.Delayed,
            createdAt:       block.timestamp,
            releaseTime:     releaseTime,
            milestone:       ""
        });

        emit PaymentDelayed(id, employee, releaseTime);
    }

    /**
     * @dev Handles an escrow payment from the FHE routing path.
     */
    function _processEscrowPaymentEncrypted(
        address employer,
        address employee,
        euint64 amount
    ) internal {
        uint256 id = nextPaymentId++;

        FHE.allowThis(amount);

        pendingPayments[id] = PendingPayment({
            id:              id,
            employee:        employee,
            employer:        employer,
            encryptedAmount: amount,
            status:          PaymentStatus.Escrowed,
            createdAt:       block.timestamp,
            releaseTime:     0,
            milestone:       "Pending employer approval"
        });

        emit PaymentEscrowed(id, employee, "Pending employer approval");
    }

    /**
     * @dev Handles an escrow payment for unscored employees.
     */
    function _processEscrowPayment(address employer, Employee storage emp) internal {
        uint256 id = nextPaymentId++;

        pendingPayments[id] = PendingPayment({
            id:              id,
            employee:        emp.wallet,
            employer:        employer,
            encryptedAmount: emp.encryptedSalary,
            status:          PaymentStatus.Escrowed,
            createdAt:       block.timestamp,
            releaseTime:     0,
            milestone:       "Pending employer approval"
        });

        emit PaymentEscrowed(id, emp.wallet, "Pending employer approval");
    }
}
