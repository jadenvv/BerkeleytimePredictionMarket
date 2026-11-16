// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC usdc;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        // Start at a realistic timestamp so "never used" (0) is distinguishable.
        vm.warp(1_763_000_000);
        usdc = new MockUSDC();
    }

    function test_Metadata() public view {
        assertEq(usdc.name(), "Mock USD Coin");
        assertEq(usdc.symbol(), "USDC");
        assertEq(usdc.decimals(), 6);
        assertEq(usdc.totalSupply(), 0);
    }

    function test_FaucetMintsToCaller() public {
        vm.expectEmit(true, false, false, true);
        emit MockUSDC.FaucetUsed(alice, 1_000e6);

        vm.prank(alice);
        usdc.faucet();

        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(usdc.lastFaucetAt(alice), block.timestamp);
    }

    function test_FaucetCooldownBlocksRepeat() public {
        vm.startPrank(alice);
        usdc.faucet();

        uint256 availableAt = block.timestamp + 1 days;
        vm.warp(block.timestamp + 1 days - 1);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.FaucetCooldown.selector, availableAt));
        usdc.faucet();

        vm.warp(availableAt);
        usdc.faucet();
        vm.stopPrank();

        assertEq(usdc.balanceOf(alice), 2_000e6);
    }

    function test_CooldownIsPerAddress() public {
        vm.prank(alice);
        usdc.faucet();
        vm.prank(bob);
        usdc.faucet();

        assertEq(usdc.balanceOf(alice), 1_000e6);
        assertEq(usdc.balanceOf(bob), 1_000e6);
    }

    function test_TransfersWork() public {
        vm.prank(alice);
        usdc.faucet();

        vm.prank(alice);
        assertTrue(usdc.transfer(bob, 250e6));

        assertEq(usdc.balanceOf(alice), 750e6);
        assertEq(usdc.balanceOf(bob), 250e6);
    }
}
