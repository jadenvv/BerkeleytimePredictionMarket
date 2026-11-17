// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LMSRMath} from "./LMSRMath.sol";

// Ideas based on https://medium.com/gnosis-pm/radical-markets-for-elephants-a742916812db

contract Market is ReentrancyGuard {
    using SafeERC20 for IERC20;
    // 
    uint256 public constant B = 100e18;
    uint256 public constant SUBSIDY = 69_314_719; // ceil(100 * ln(2) * 1e6)
    // increased precision for LMSR
    uint256 private constant SCALE = 1e12;
    IERC20 public immutable collateral;
    address public immutable creator;
    uint64 public immutable closesAt;
    string public question;
    bool public funded;
    bool public resolved;
    bool public result;
    // quantity yes and no so we dont need to recompute continuously
    // saves compute
    uint256 public qYes;
    uint256 public qNo;
    mapping(address => mapping(bool => uint256)) public shares; // Six-decimal shares.

    // events for trackign
    event Traded(address indexed account, bool yes, bool buy, uint256 quantity, uint256 amount);
    event Resolved(bool yes);
    event Redeemed(address indexed account, bool yes, uint256 quantity, uint256 amount);

    constructor(IERC20 token, uint64 close, string memory question_) {
        require(address(token) != address(0) && close > block.timestamp, "Invalid configuration");
        require(IERC20Metadata(address(token)).decimals() == 6, "Expected six-decimal USDC");
        require(bytes(question_).length > 0 && bytes(question_).length <= 200, "Invalid question");
        collateral = token;
        creator = msg.sender;
        closesAt = close;
        question = question_;
    }
    function fund() external nonReentrant {
        require(msg.sender == creator && !funded && block.timestamp < closesAt, "Unavailable");
        funded = true;
        collateral.safeTransferFrom(msg.sender, address(this), SUBSIDY);
    }
    // calculate price for buying shares, rounding in the pool's favor
    function quoteBuy(bool yes, uint256 amount) public view returns (uint256 quantity) {
        require(amount >= 1e6 && amount <= 1_000_000e6, "Invalid amount");
        quantity = LMSRMath.sharesForAmount(yes, amount * SCALE, qYes * SCALE, qNo * SCALE, B) / SCALE;
        require(quantity > 1, "Trade too small");
        --quantity; // Round in the pool's favor, including fixed-point approximation.
        uint256 y = qYes + (yes ? quantity : 0);
        uint256 n = qNo + (yes ? 0 : quantity);
        require(y <= 1e15 && n <= 1e15, "Inventory limit");
        require(LMSRMath.cost(y * SCALE, n * SCALE, B) - LMSRMath.cost(qYes * SCALE, qNo * SCALE, B) <= amount * SCALE, "Rounding");
    }
    // calculate proceeds for selling shares, rounding in the pool's favor
    function quoteSell(bool yes, uint256 quantity) public view returns (uint256) {
        require(quantity > 0 && quantity <= (yes ? qYes : qNo), "Invalid shares");
        return LMSRMath.proceedsForShares(yes, quantity * SCALE, qYes * SCALE, qNo * SCALE, B) / SCALE;
    }
    function buy(bool yes, uint256 amount, uint256 minShares, uint256 deadline) external nonReentrant {
        _open(deadline);
        uint256 quantity = quoteBuy(yes, amount);
        require(quantity >= minShares, "Price moved");
        if (yes) qYes += quantity; else qNo += quantity;
        shares[msg.sender][yes] += quantity;
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        emit Traded(msg.sender, yes, true, quantity, amount);
    }
    function sell(bool yes, uint256 quantity, uint256 minAmount, uint256 deadline) external nonReentrant {
        _open(deadline);
        require(shares[msg.sender][yes] >= quantity, "Insufficient shares");
        uint256 amount = quoteSell(yes, quantity);
        require(amount > 0 && amount >= minAmount, "Price moved");
        if (yes) qYes -= quantity; else qNo -= quantity;
        shares[msg.sender][yes] -= quantity;
        collateral.safeTransfer(msg.sender, amount);
        emit Traded(msg.sender, yes, false, quantity, amount);
    }
    function resolve(bool yes) external {
        require(msg.sender == creator && funded && !resolved && block.timestamp >= closesAt, "Unavailable");
        resolved = true;
        result = yes;
        emit Resolved(yes);
    }
    // you can redeem your shares after resolved
    function redeem(bool yes) external nonReentrant {
        uint256 quantity = shares[msg.sender][yes];
        require(resolved && quantity > 0, "Unavailable");
        uint256 amount = result == yes ? quantity : 0;
        delete shares[msg.sender][yes];
        if (yes) qYes -= quantity; else qNo -= quantity;
        collateral.safeTransfer(msg.sender, amount);
        emit Redeemed(msg.sender, yes, quantity, amount);
    }
    // the creator can withdraw surplus
    // theoretically the creator can lose money from their funding
    // could be fixed via a fee byt not impl herer
    function withdrawSurplus() external nonReentrant {
        require(msg.sender == creator && resolved, "Unavailable");
        uint256 reserved = result ? qYes : qNo;
        collateral.safeTransfer(creator, collateral.balanceOf(address(this)) - reserved);
    }
    // we assert that the market is open
    function _open(uint256 deadline) private view {
        require(funded && !resolved && block.timestamp < closesAt && block.timestamp <= deadline, "Unavailable");
    }
}
