// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {LMSRMath} from "../src/LMSRMath.sol";

contract LMSRMathTest is Test {
    uint256 constant B = 400e18;
    // qYes that opens a b=400 market at 62% (from the frontend's initialQuantities)
    uint256 constant Q_YES_62 = 195.819290127482e18;

    // expected values come from src/lib/lmsr.ts
    uint256 constant TOL = 1e9; // 1e-9 relative

    function test_EvenMarketIsFiftyFifty() public pure {
        assertEq(LMSRMath.priceYes(0, 0, B), 0.5e18);
        assertEq(LMSRMath.priceYes(123e18, 123e18, B), 0.5e18);
    }

    function test_EmptyMarketCostEqualsSubsidy() public pure {
        assertApproxEqRel(LMSRMath.cost(0, 0, B), LMSRMath.subsidy(B), TOL);
        assertApproxEqRel(LMSRMath.subsidy(B), 277.258872223978e18, TOL);
    }

    function test_MatchesFrontendPrice() public pure {
        assertApproxEqRel(LMSRMath.priceYes(Q_YES_62, 0, B), 0.62e18, TOL);
    }

    function test_MatchesFrontendBuyYes() public pure {
        uint256 shares = LMSRMath.sharesForAmount(true, 50e18, Q_YES_62, 0, B);
        assertApproxEqRel(shares, 77.817151662643e18, TOL);
        assertApproxEqRel(LMSRMath.priceYes(Q_YES_62 + shares, 0, B), 0.664651177018e18, TOL);
    }

    function test_MatchesFrontendBuyNo() public pure {
        uint256 shares = LMSRMath.sharesForAmount(false, 50e18, Q_YES_62, 0, B);
        assertApproxEqRel(shares, 120.157573113571e18, TOL);
    }

    function test_BuyThenSellRoundTrips() public pure {
        uint256 shares = LMSRMath.sharesForAmount(true, 50e18, Q_YES_62, 0, B);
        uint256 back = LMSRMath.proceedsForShares(true, shares, Q_YES_62 + shares, 0, B);
        assertApproxEqRel(back, 50e18, TOL);
    }

    function test_ExtremeQuantitiesDontRevert() public pure {
        assertEq(LMSRMath.priceYes(0, 100_000e18, B), 0);
        assertApproxEqAbs(LMSRMath.priceYes(100_000e18, 0, B), 1e18, 1);
    }

    function test_RevertsOnZeroLiquidity() public {
        vm.expectRevert(LMSRMath.ZeroLiquidity.selector);
        this.price(1e18, 0, 0);
    }

    function test_RevertsWhenSellingTooMuch() public {
        vm.expectRevert(LMSRMath.NotEnoughShares.selector);
        this.sell(10e18, 5e18, 0);
    }

    function testFuzz_PriceStaysInRange(uint256 qYes, uint256 qNo) public pure {
        qYes = bound(qYes, 0, 1_000_000e18);
        qNo = bound(qNo, 0, 1_000_000e18);
        uint256 p = LMSRMath.priceYes(qYes, qNo, B);
        assertLe(p, 1e18);
    }

    function testFuzz_BuyingMovesPriceUp(uint256 amount) public pure {
        amount = bound(amount, 1e18, 10_000e18);
        uint256 shares = LMSRMath.sharesForAmount(true, amount, 0, 0, B);
        assertGt(LMSRMath.priceYes(shares, 0, B), 0.5e18);
        // price < $1 per share, so you always get more shares than dollars spent
        assertGt(shares, amount);
    }

    function sell(uint256 shares, uint256 qYes, uint256 qNo) external pure returns (uint256) {
        return LMSRMath.proceedsForShares(true, shares, qYes, qNo, B);
    }

    // external wrapper so expectRevert can catch the library revert
    function price(uint256 qYes, uint256 qNo, uint256 b) external pure returns (uint256) {
        return LMSRMath.priceYes(qYes, qNo, b);
    }
}
