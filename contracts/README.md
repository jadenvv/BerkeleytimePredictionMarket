# Berkeleytime Markets: contracts

Solidity contracts for the prediction market, built with [Foundry](https://book.getfoundry.sh/).

```bash
cd contracts
npm install        # OpenZeppelin + Solady (forge-std is vendored in lib/)
forge test -vv
```

## Build plan

The contracts are built one part at a time.

| # | Part | Files | Status |
|---|------|-------|--------|
| 1 | Setup + test collateral | `MockUSDC.sol` | Done |
| 2 | LMSR pricing math (fixed-point) | `LMSRMath.sol` | Done |
| 3 | Outcome shares (ERC-1155) | `OutcomeToken.sol` | Not started |
| 4 | Market: buy / sell | `Market.sol` | Not started |
| 5 | Factory: permissionless market creation | `MarketFactory.sol` | Not started |
| 6 | Resolution (optimistic oracle) + redeem | `Market.sol`, oracle adapter | Not started |
| 7 | Deploy script + frontend wiring (ethers.js) | `script/`, `src/lib/protocol/` | Not started |

## Contracts

### `MockUSDC`
Testnet stand-in for USDC, the money every market uses. It has 6 decimals like real USDC. `faucet()` mints 1,000 USDC to the caller, at most once per day per address. On mainnet the markets would use real USDC instead.

### `LMSRMath`
Pricing library, ported from the frontend's `src/lib/lmsr.ts`: cost function, YES price, shares for a given spend, sale proceeds, and the creator subsidy (`b * ln 2`). Uses Solady's `expWad`/`lnWad`. Tests check it against the TypeScript version's numbers.
