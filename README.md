# Berkeleytime Markets

A decentralized prediction market for Berkeley course data (grade distributions, enrollment, waitlists, and similar) with a Kalshi-style interface.

> **Status:** frontend only. The Solidity contracts haven't been written yet. All "on-chain" state is simulated in the browser by `MockProtocol` and saved in `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000, click **Connect wallet**, and pick **Demo wallet** (no browser extension needed) or a browser wallet. Then use **Get 1,000 test USDC** and start trading.

### Wallets (RainbowKit + ethers.js)

- **RainbowKit** provides the connect modal (themed to match the site). The navbar button is a `ConnectButton.Custom`, so it keeps the Kalshi-style look.
- **ethers.js** is wired to the same connection through `src/lib/ethers.ts` (`useEthersProvider`, `useEthersSigner`). The wallet menu reads your Base Sepolia ETH balance with it, and the on-chain protocol will use the signer to call the contracts.
- **WalletConnect** (mobile wallets and QR codes) needs a free project ID from https://cloud.reown.com:

  ```bash
  echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-id" > .env.local
  ```

  Without it, only browser-extension wallets, Coinbase Wallet and the Demo wallet are listed.

## How it works

- **Markets:** an *event* (for example "CS 61A Fall 2026 average GPA?") contains one or more binary YES/NO *outcomes*, the same way Kalshi structures events. An event with one outcome is shown as a plain Yes/No market.
- **Pricing:** each outcome has its own LMSR automated market maker (`src/lib/lmsr.ts`). A share pays $1 USDC if it's correct. Price = probability.
- **Permissionless creation:** anyone can create a market. The creator pays the market maker's worst-case loss, `b · ln 2` USDC per outcome, as a liquidity subsidy.
- **Resolution (planned):** an optimistic oracle that uses Berkeleytime data as its resolution source.

## Layout

```
src/
  lib/
    lmsr.ts             LMSR math (reference for the contracts)
    seed.ts             Seed markets (deterministic, so SSR matches the client)
    types.ts            Market / outcome / position / trade types
    wagmi.ts            Wallet config (RainbowKit wallets + Demo wallet, Base Sepolia)
    ethers.ts           ethers.js provider/signer adapters over wagmi
    protocol/
      types.ts          `Protocol` interface: the seam for the contracts
      mock.ts           localStorage-backed implementation
      index.ts          Active protocol instance + React hooks
  components/           Navbar, WalletButton, MarketCard, PriceChart, TradePanel
  app/                  /, /markets/[id], /portfolio, /create
```

## Next step: contracts

Add an on-chain implementation of `Protocol` (`src/lib/protocol/types.ts`) using ethers.js contracts with `useEthersSigner()`, then swap it in at `src/lib/protocol/index.ts`. The UI only talks to that interface. The contracts will need:

- `MarketFactory`: permissionless `createMarket` that pulls the LMSR subsidy
- An LMSR market with `buy` / `sell` (fixed-point version of `lmsr.ts`) and ERC-1155 outcome shares
- Oracle integration for resolution, plus `redeem`
- An indexer (or event reads) to supply price history and activity
