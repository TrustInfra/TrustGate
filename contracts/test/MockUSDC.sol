// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice Minimal ERC-20 mock with 6 decimals for local testing.
 *         Anyone can mint — not for production use.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address. Public for testing convenience.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
