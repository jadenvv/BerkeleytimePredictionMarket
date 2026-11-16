# Berkeleytime Markets

A decentralized prediction market for UC Berkeley course data, such as grade distributions, enrollment counts and waitlists, with a Kalshi-style trading interface.

## About

Berkeleytime Markets lets students bet on questions about Berkeley courses. Examples: "Will the CS 61A Fall 2026 average GPA be above 3.3?" or "Will Data 8 fill up before Phase 2?" Each question becomes a market where traders buy and sell YES and NO shares. A share pays out $1 in USDC if its side turns out to be correct, so a share's price is the market's estimate of how likely that outcome is. A YES share trading at 72¢ means traders think there is about a 72% chance it happens.

Prices come from a **Logarithmic Market Scoring Rule (LMSR)** automated market maker instead of an order book. That means there is always a counterparty, even in a small market with only a few traders, and each trade moves the price smoothly according to how much was bought or sold. Anyone can create a market. The creator puts up a small liquidity subsidy, which is the market maker's maximum possible loss (`b · ln 2` USDC per outcome).

Markets will settle against public **Berkeleytime** data through an optimistic oracle: someone proposes the result, and it is accepted unless someone disputes it. Shares can then be redeemed for USDC. The project runs on **Base Sepolia** with test USDC, so anyone can try it without risking real money.

The project has two parts: a **Next.js frontend** (RainbowKit, wagmi and ethers.js for wallets, and Recharts for price history) and a set of **Solidity contracts** built with Foundry. The frontend is complete and currently runs against a simulated in-browser protocol. The contracts are being built one part at a time and will replace that simulation.

> **Status:** The frontend is fully usable with simulated on-chain state (`MockProtocol`, saved in `localStorage`). On the contracts side, `MockUSDC` (the test-USDC faucet) and `LMSRMath` (fixed-point pricing) are done and tested. The share token, the market, the factory and resolution are still to come. See [`contracts/README.md`](contracts/README.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Connect wallet**, and pick **Demo wallet** (no browser extension needed) or a browser wallet. Then click **Get 1,000 test USDC** and start trading.

### Contracts

```bash
cd contracts
npm install        # OpenZeppelin + Solady
forge test -vv
```

### Wallets (RainbowKit + ethers.js)

- **RainbowKit** provides the connect modal, themed to match the site. The navbar button is a `ConnectButton.Custom`, so it keeps the Kalshi-style look.
- **ethers.js** uses the same connection through `src/lib/ethers.ts` (`useEthersProvider`, `useEthersSigner`). The wallet menu reads your Base Sepolia ETH balance with it, and the on-chain protocol will use the signer to call the contracts.
- **WalletConnect** (mobile wallets and QR codes) needs a free project ID from https://cloud.reown.com:

  ```bash
  echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-id" > .env.local
  ```

  Without it, the connect modal lists only browser-extension wallets, Coinbase Wallet and the Demo wallet.

## How it works

- **Markets:** An *event* (for example "CS 61A Fall 2026 average GPA?") contains one or more binary YES/NO *outcomes*, the same way Kalshi structures events. An event with a single outcome is shown as a plain Yes/No market.
- **Pricing:** Each outcome has its own LMSR market maker (`src/lib/lmsr.ts`, ported to `contracts/src/LMSRMath.sol`). A share pays $1 USDC if it is correct, so price = probability.
- **Permissionless creation:** Anyone can create a market. The creator pays `b · ln 2` USDC per outcome as a liquidity subsidy.
- **Resolution (planned):** An optimistic oracle that uses Berkeleytime data as its resolution source, followed by `redeem`.

## Layout

```
src/
  lib/
    lmsr.ts             LMSR math (the reference for LMSRMath.sol)
    seed.ts             Seed markets (deterministic, so the server render matches the client)
    types.ts            Market / outcome / position / trade types
    wagmi.ts            Wallet config (RainbowKit wallets + Demo wallet, Base Sepolia)
    ethers.ts           ethers.js provider/signer adapters over wagmi
    protocol/
      types.ts          `Protocol` interface: the boundary between the UI and the contracts
      mock.ts           localStorage-backed implementation
      index.ts          Active protocol instance + React hooks
  components/           Navbar, WalletButton, MarketCard, PriceChart, TradePanel
  app/                  /, /markets/[id], /portfolio, /create
contracts/
  src/                  MockUSDC.sol, LMSRMath.sol
  test/                 Foundry tests
```

## Roadmap

The UI only talks to the `Protocol` interface (`src/lib/protocol/types.ts`). To go fully on-chain, add an ethers.js implementation of that interface using `useEthersSigner()` and swap it in at `src/lib/protocol/index.ts`. Remaining contract work:

- ERC-1155 outcome shares
- An LMSR market contract with `buy` / `sell`
- `MarketFactory`, with a permissionless `createMarket` that collects the LMSR subsidy
- Oracle resolution and `redeem`
- A deploy script, plus an indexer (or event reads) to supply price history and activity
