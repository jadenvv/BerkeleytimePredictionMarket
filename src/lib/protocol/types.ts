import type { MarketEvent, Position, Side, Trade } from "../types";

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
  /** Exact six-decimal output for an on-chain minimum-output limit. */
  rawOutput?: string;
}

export interface TradeLimits {
  minOutput: string;
  deadline: number;
}

export interface ProtocolState {
  events: Record<string, MarketEvent>;
  balances: Record<Address, number>;
  positions: Record<Address, Position[]>;
  trades: Trade[];
  loading?: boolean;
  error?: string;
  canFaucet?: boolean;
  faucetAvailableAt?: number;
}

/**
 * UI operations for the configured Market contract.
 */
export interface Protocol {
  getState(): ProtocolState;
  getServerState(): ProtocolState;
  subscribe(listener: () => void): () => void;

  quoteBuy(eventId: string, outcomeId: string, side: Side, amount: number): Promise<Quote>;
  quoteSell(eventId: string, outcomeId: string, side: Side, shares: number): Promise<Quote>;

  buy(account: Address, eventId: string, outcomeId: string, side: Side, amount: number, limits?: TradeLimits): Promise<Trade>;
  sell(account: Address, eventId: string, outcomeId: string, side: Side, shares: number, limits?: TradeLimits): Promise<Trade>;

  /** Testnet-only: mint mock USDC. */
  faucet(account: Address): Promise<void>;
}
