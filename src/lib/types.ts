export type Category =
  | "Grades"
  | "Enrollment"
  | "Waitlists"
  | "Instructors"
  | "Campus";

export const CATEGORIES: Category[] = [
  "Grades",
  "Enrollment",
  "Waitlists",
  "Instructors",
  "Campus",
];

export type Side = "yes" | "no";

export type MarketStatus = "open" | "closed" | "resolved";

export interface PricePoint {
  /** Unix ms */
  t: number;
  /** Probability of YES, 0..1 */
  p: number;
}

/**
 * A single binary YES/NO contract. Each outcome runs its own LMSR market maker
 * (qYes / qNo are outstanding share quantities, b is the liquidity parameter).
 */
export interface Outcome {
  id: string;
  label: string;
  qYes: number;
  qNo: number;
  b: number;
  volume: number;
  history: PricePoint[];
  /** Set once the market resolves. */
  result?: Side;
}

/**
 * An event groups one or more binary outcomes, like a Kalshi event.
 * A single-outcome event renders as a plain Yes/No market.
 */
export interface MarketEvent {
  id: string;
  title: string;
  subtitle?: string;
  category: Category;
  /** Course tag shown on the card, e.g. "COMPSCI 61A". */
  course?: string;
  closesAt: number;
  resolvesAt: number;
  rules: string;
  source: string;
  creator: `0x${string}`;
  createdAt: number;
  status: MarketStatus;
  outcomes: Outcome[];
  /** Present when this event comes from the configured Market contract. */
  contractAddress?: `0x${string}`;
  funded?: boolean;
  subsidy?: number;
  surplus?: number;
}

export interface Position {
  eventId: string;
  outcomeId: string;
  side: Side;
  shares: number;
  /** Total USDC paid for the shares still held. */
  cost: number;
}

export interface Trade {
  id: string;
  account: `0x${string}`;
  eventId: string;
  outcomeId: string;
  side: Side;
  action: "buy" | "sell";
  shares: number;
  /** USDC paid (buy) or received (sell). */
  amount: number;
  /** Average price per share in USDC. */
  price: number;
  t: number;
  txHash: `0x${string}`;
}
