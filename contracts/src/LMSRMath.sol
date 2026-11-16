// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {FixedPointMathLib as FPM} from "solady/utils/FixedPointMathLib.sol";

/// @notice LMSR pricing for a binary market. Mirrors src/lib/lmsr.ts on the frontend.
/// Everything is 18-decimal fixed point.
library LMSRMath {
    int256 constant WAD = 1e18;
    uint256 constant LN2 = 693147180559945309;

    error ZeroLiquidity();
    error NotEnoughShares();

    // C(y, n) = b * ln(e^(y/b) + e^(n/b))
    function cost(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        int256 y = _div(qYes, b);
        int256 n = _div(qNo, b);
        (int256 hi, int256 lo) = y > n ? (y, n) : (n, y);
        // log-sum-exp trick so expWad doesn't overflow
        int256 lse = hi + FPM.lnWad(WAD + FPM.expWad(lo - hi));
        return uint256(FPM.sMulWad(int256(b), lse));
    }

    function priceYes(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        int256 d = _div(qNo, b) - _div(qYes, b);
        if (d >= 135e18) return 0;
        return uint256(FPM.sDivWad(WAD, WAD + FPM.expWad(d)));
    }

    // solve C(q + x) = C(q) + amount for x
    function sharesForAmount(bool yes, uint256 amount, uint256 qYes, uint256 qNo, uint256 b)
        internal
        pure
        returns (uint256)
    {
        if (amount == 0) return 0;
        (uint256 qSide, uint256 qOther) = yes ? (qYes, qNo) : (qNo, qYes);

        int256 t = _div(cost(qYes, qNo, b) + amount, b);
        int256 inner = WAD - FPM.expWad(_div(qOther, b) - t);
        if (inner <= 0) return 0;

        int256 x = FPM.sMulWad(int256(b), t + FPM.lnWad(inner)) - int256(qSide);
        return x > 0 ? uint256(x) : 0;
    }

    function proceedsForShares(bool yes, uint256 shares, uint256 qYes, uint256 qNo, uint256 b)
        internal
        pure
        returns (uint256)
    {
        if (shares > (yes ? qYes : qNo)) revert NotEnoughShares();
        uint256 c0 = cost(qYes, qNo, b);
        uint256 c1 = yes ? cost(qYes - shares, qNo, b) : cost(qYes, qNo - shares, b);
        return c0 > c1 ? c0 - c1 : 0;
    }

    // max loss for the market maker = b * ln 2
    function subsidy(uint256 b) internal pure returns (uint256) {
        return FPM.mulWad(b, LN2);
    }

    function _div(uint256 q, uint256 b) private pure returns (int256) {
        if (b == 0) revert ZeroLiquidity();
        return int256(FPM.divWad(q, b));
    }
}
