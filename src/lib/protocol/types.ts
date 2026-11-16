import type { Category, MarketEvent, Position, Side, Trade } from "../types";

export type Address = `0x${string}`;

export interface Quote {
  shares: number;
  /** USDC in (buy) or out (sell). */
  amount: number;
  avgPrice: number;
  /** YES probability after the trade. */
  newPriceYes: number;
  /** Max payout if this side wins (buy only). */
  payout: number;
}

export interface NewMarketInput {
  title: string;
  category: Category;
  course?: string;
  rules: string;
  closesAt: number;
  /** One label for a plain Yes/No market, several for a multi-outcome event. */
  outcomes: string[];
  initialProbability: number;
  /** LMSR liquidity parameter. Creator posts b * ln(2) USDC per outcome. */
  liquidity: number;
}

export interface ProtocolState {
  events: Record<string, MarketEvent>;
  balances: Record<Address, number>;
  positions: Record<Address, Position[]>;
  trades: Trade[];
}

/**
 * Everything the UI needs from "the chain". The current implementation
 * (`mock.ts`) keeps state in localStorage. When the Solidity contracts land,
 * add an on-chain implementation backed by viem/wagmi that satisfies the same
 * interface and swap it in `index.ts`.
 */
export interface Protocol {
  getState(): ProtocolState;
  subscribe(listener: () => void): () => void;

  quoteBuy(eventId: string, outcomeId: string, side: Side, amount: number): Quote;
  quoteSell(eventId: string, outcomeId: string, side: Side, shares: number): Quote;

  buy(account: Address, eventId: string, outcomeId: string, side: Side, amount: number): Promise<Trade>;
  sell(account: Address, eventId: string, outcomeId: string, side: Side, shares: number): Promise<Trade>;
  createMarket(account: Address, input: NewMarketInput): Promise<MarketEvent>;

  /** Testnet-only: mint mock USDC. */
  faucet(account: Address): Promise<void>;
}
