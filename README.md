# Berkeleytime Markets

A decentralized prediction market for UC Berkeley course data, such as grade distributions, enrollment counts and waitlists, with a Kalshi-style trading interface.

## About

Berkeleytime Markets lets students bet on questions about Berkeley courses. Examples: "Will the CS 61A Fall 2026 average GPA be above 3.3?" or "Will Data 8 fill up before Phase 2?" Each question becomes a market where traders buy and sell YES and NO shares. A share pays out $1 in USDC if its side turns out to be correct, so a share's price is the market's estimate of how likely that outcome is. A YES share trading at 72¢ means traders think there is about a 72% chance it happens.

Prices come from a **Logarithmic Market Scoring Rule (LMSR)** automated market maker instead of an order book. That means there is always a counterparty, even in a small market with only a few traders, and each trade moves the price smoothly according to how much was bought or sold. Anyone can create a market. The creator puts up a small liquidity subsidy, which is the market maker's maximum possible loss (`b · ln 2` USDC per outcome).

The current contract lets the **market creator choose the final YES or NO result** after trading closes. Winning shares can then be redeemed for USDC. There is no oracle or dispute process: traders must trust the creator. The frontend targets **Ethereum Sepolia** and six-decimal test USDC.

The project has two parts: a **Next.js frontend** (RainbowKit, wagmi and ethers.js for wallets, and Recharts for price history) and **Solidity contracts** built with Foundry. The frontend connects to one configured, existing `Market` contract on Ethereum Sepolia (chain ID **11155111**).

> **Status:** `Market.sol` supports funding, buying, selling, creator resolution, redemption and surplus withdrawal. These actions are connected to the UI. Balances, positions, price history and activity come from the configured contract. There are no seeded markets, simulated balances or demo wallets. No deployment is included in UI setup.

## Run it

```bash
npm install
npm run dev
```

Configure an existing contract as described below, then open http://localhost:3000 and connect an Ethereum Sepolia wallet. Until a contract is configured, the app shows a configuration message and no markets.

### Connect an existing contract

Copy `.env.example` to `.env.local`, then set:

```dotenv
NEXT_PUBLIC_MARKET_ADDRESS=0x...existing_Market_address
NEXT_PUBLIC_MARKET_START_BLOCK=12345678
NEXT_PUBLIC_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

Use the contract's actual deployment block so the UI can reconstruct complete trade history. Restart the dev server (or rebuild for production) after changing these public settings. Use an RPC endpoint that permits browser requests and historical log reads. Never put private keys in `NEXT_PUBLIC_*` variables.

Public Sepolia deployment addresses, deployment blocks and creation transactions are recorded in [`deployments/sepolia.json`](deployments/sepolia.json).

Connect a browser wallet on Ethereum Sepolia with test ETH for gas. The UI discovers the collateral address from the contract. If it is `MockUSDC`, the portfolio offers its daily test-USDC faucet. The creator first funds the market with **69.314719 USDC**; the UI requests a token approval when needed and waits for each transaction receipt. Traders can buy or sell with a minimum output of 99% of the displayed contract quote and a two-minute deadline.

After closing, the creator can resolve YES or NO from the market page. Holders can redeem winning shares or clear losing shares, and the creator can withdraw surplus without taking collateral reserved for winners. The current contract has no factory, so market creation is not available in the UI. This setup neither deploys a contract nor changes an existing one automatically.

The app always uses Ethereum Sepolia. Missing configuration or RPC failures are displayed without substituting sample data. The old `NEXT_PUBLIC_PROTOCOL` selector is no longer used, and any saved demo state is cleared from this app’s browser storage.

### Checks

```bash
npm run lint
npm run build
npm test                 # ABI compatibility and adapter lifecycle against a fake RPC
npx playwright install chromium  # once, if needed
npm run test:e2e         # browser lifecycle against the same fake RPC
forge test --root contracts
```

The UI tests do not deploy contracts or submit public-network transactions. They validate wallet requests, receipts and screen updates against a deterministic JSON-RPC fixture; Foundry separately tests the Solidity behavior. A real wallet/contract smoke test still requires an existing deployment and its configuration.

### Contracts

```bash
cd contracts
npm install        # OpenZeppelin + Solady
forge test -vv
```

### Wallets (RainbowKit + ethers.js)

- **RainbowKit** provides the connect modal, themed to match the site. The navbar button is a `ConnectButton.Custom`, so it keeps the Kalshi-style look.
- **ethers.js** uses the same connection through `src/lib/ethers.ts` (`useEthersProvider`, `useEthersSigner`). The wallet menu reads your Ethereum Sepolia ETH balance with it, and the on-chain protocol uses the signer for contract transactions.
- **WalletConnect** (mobile wallets and QR codes) needs a free project ID from https://cloud.reown.com:

  ```bash
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-id
  ```

  Add that setting to `.env.local`. Without it, the connect modal lists browser-extension wallets and Coinbase Wallet.

## How it works

- **Markets:** The UI displays one binary YES/NO market at the configured address.
- **Pricing:** Each outcome has its own LMSR market maker (`src/lib/lmsr.ts`, ported to `contracts/src/LMSRMath.sol`). A share pays $1 USDC if it is correct, so price = probability.
- **Funding:** The creator deposits the contract's fixed `SUBSIDY` before trading opens. Creating additional contracts is separate from this UI.
- **Resolution:** The creator calls `resolve` after closing. Holders call `redeem`, and the creator can call `withdrawSurplus` after resolution.

## Layout

```
src/
  lib/
    lmsr.ts             LMSR math (the reference for LMSRMath.sol)
    types.ts            Market / outcome / position / trade types
    wagmi.ts            Wallet config (RainbowKit wallets, Ethereum Sepolia)
    ethers.ts           ethers.js provider/signer adapters over wagmi
    protocol/
      types.ts          `Protocol` interface: the boundary between the UI and the contracts
      positions.ts      Position valuation from contract quantities and results
      onchain.ts        Existing Market contract, receipts and event history
      contracts.ts      Market and collateral ABIs
      config.ts         Public contract/RPC configuration
      index.ts          Active protocol instance + React hooks
  components/           Navbar, WalletButton, MarketCard, PriceChart, TradePanel
  app/                  /, /markets/[id], /portfolio, /create
contracts/
  src/                  Market.sol, MockUSDC.sol, LMSRMath.sol
  test/                 Foundry tests
```

## Roadmap

The current scope is one creator-resolved binary contract, with shares held in the contract's internal balances. Multi-market discovery/creation and independent resolution would require additional contract design. The UI currently replays paginated contract events on refresh; a larger deployment may need an indexer or persistent log cache.
