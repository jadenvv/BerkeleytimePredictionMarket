import {
  priceYes,
  proceedsForShares,
  sharesForAmount,
  subsidyFor,
  initialQuantities,
} from "../lmsr";
import { seedEvents } from "../seed";
import type { MarketEvent, Outcome, Position, Side, Trade } from "../types";
import type { Address, NewMarketInput, Protocol, ProtocolState, Quote } from "./types";

const STORAGE_KEY = "btm:state:v1";
const FAUCET_AMOUNT = 1_000;
const MIN_TRADE = 1;
/** Simulated block confirmation delay so pending UI states are exercised. */
const TX_DELAY_MS = 700;

function initialState(): ProtocolState {
  return {
    events: Object.fromEntries(seedEvents().map((e) => [e.id, e])),
    balances: {},
    positions: {},
    trades: [],
  };
}

const SERVER_STATE = initialState();

function load(): ProtocolState {
  if (typeof window === "undefined") return SERVER_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as ProtocolState;
  } catch {
    // corrupted or unavailable storage: fall back to seed
  }
  return SERVER_STATE;
}

function randomHex(bytes: number): `0x${string}` {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return `0x${Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export class MockProtocol implements Protocol {
  private state: ProtocolState = load();
  private listeners = new Set<() => void>();

  getState = () => this.state;
  getServerState = () => SERVER_STATE;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        this.state = load();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      this.listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  };

  private commit(next: ProtocolState) {
    this.state = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage full / blocked: state still lives in memory for this tab
    }
    this.listeners.forEach((l) => l());
  }

  /** Dev helper: wipe local chain state back to the seed markets. */
  reset() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.state = initialState();
    this.listeners.forEach((l) => l());
  }

  private outcome(eventId: string, outcomeId: string): [MarketEvent, Outcome] {
    const ev = this.state.events[eventId];
    if (!ev) throw new Error(`Unknown market ${eventId}`);
    const o = ev.outcomes.find((x) => x.id === outcomeId);
    if (!o) throw new Error(`Unknown outcome ${outcomeId}`);
    return [ev, o];
  }

  quoteBuy(eventId: string, outcomeId: string, side: Side, amount: number): Quote {
    const [, o] = this.outcome(eventId, outcomeId);
    const shares = sharesForAmount(side, amount, o.qYes, o.qNo, o.b);
    const qYes = side === "yes" ? o.qYes + shares : o.qYes;
    const qNo = side === "no" ? o.qNo + shares : o.qNo;
    return {
      shares,
      amount,
      avgPrice: shares > 0 ? amount / shares : 0,
      newPriceYes: priceYes(qYes, qNo, o.b),
      payout: shares,
    };
  }

  quoteSell(eventId: string, outcomeId: string, side: Side, shares: number): Quote {
    const [, o] = this.outcome(eventId, outcomeId);
    const amount = proceedsForShares(side, shares, o.qYes, o.qNo, o.b);
    const qYes = side === "yes" ? o.qYes - shares : o.qYes;
    const qNo = side === "no" ? o.qNo - shares : o.qNo;
    return {
      shares,
      amount,
      avgPrice: shares > 0 ? amount / shares : 0,
      newPriceYes: priceYes(qYes, qNo, o.b),
      payout: 0,
    };
  }

  private applyTrade(
    account: Address,
    eventId: string,
    outcomeId: string,
    side: Side,
    action: "buy" | "sell",
    shares: number,
    amount: number,
  ): Trade {
    const s = this.state;
    const ev = s.events[eventId];
    const now = Date.now();

    const outcomes = ev.outcomes.map((o) => {
      if (o.id !== outcomeId) return o;
      const sign = action === "buy" ? 1 : -1;
      const qYes = side === "yes" ? o.qYes + sign * shares : o.qYes;
      const qNo = side === "no" ? o.qNo + sign * shares : o.qNo;
      return {
        ...o,
        qYes,
        qNo,
        volume: o.volume + amount,
        history: [...o.history, { t: now, p: priceYes(qYes, qNo, o.b) }],
      };
    });

    const positions = [...(s.positions[account] ?? [])];
    const idx = positions.findIndex(
      (p) => p.eventId === eventId && p.outcomeId === outcomeId && p.side === side,
    );
    if (action === "buy") {
      if (idx >= 0) {
        const p = positions[idx];
        positions[idx] = { ...p, shares: p.shares + shares, cost: p.cost + amount };
      } else {
        positions.push({ eventId, outcomeId, side, shares, cost: amount });
      }
    } else {
      const p = positions[idx];
      const remaining = p.shares - shares;
      if (remaining < 1e-6) positions.splice(idx, 1);
      else positions[idx] = { ...p, shares: remaining, cost: p.cost * (remaining / p.shares) };
    }

    const balance = s.balances[account] ?? 0;
    const trade: Trade = {
      id: randomHex(8),
      account,
      eventId,
      outcomeId,
      side,
      action,
      shares,
      amount,
      price: amount / shares,
      t: now,
      txHash: randomHex(32),
    };

    this.commit({
      events: { ...s.events, [eventId]: { ...ev, outcomes } },
      balances: {
        ...s.balances,
        [account]: action === "buy" ? balance - amount : balance + amount,
      },
      positions: { ...s.positions, [account]: positions },
      trades: [trade, ...s.trades].slice(0, 500),
    });
    return trade;
  }

  private assertOpen(eventId: string) {
    const ev = this.state.events[eventId];
    if (!ev || ev.status !== "open" || Date.now() > ev.closesAt) {
      throw new Error("This market is closed for trading.");
    }
  }

  async buy(account: Address, eventId: string, outcomeId: string, side: Side, amount: number) {
    await wait(TX_DELAY_MS);
    this.assertOpen(eventId);
    if (amount < MIN_TRADE) throw new Error(`Minimum trade is $${MIN_TRADE}.`);
    const balance = this.state.balances[account] ?? 0;
    if (amount > balance + 1e-9) throw new Error("Insufficient USDC balance.");
    const { shares } = this.quoteBuy(eventId, outcomeId, side, amount);
    return this.applyTrade(account, eventId, outcomeId, side, "buy", shares, amount);
  }

  async sell(account: Address, eventId: string, outcomeId: string, side: Side, shares: number) {
    await wait(TX_DELAY_MS);
    this.assertOpen(eventId);
    const held =
      this.state.positions[account]?.find(
        (p) => p.eventId === eventId && p.outcomeId === outcomeId && p.side === side,
      )?.shares ?? 0;
    if (shares <= 0) throw new Error("Enter a number of shares to sell.");
    if (shares > held + 1e-9) throw new Error("You don't hold that many shares.");
    const { amount } = this.quoteSell(eventId, outcomeId, side, shares);
    return this.applyTrade(account, eventId, outcomeId, side, "sell", shares, amount);
  }

  async createMarket(account: Address, input: NewMarketInput) {
    await wait(TX_DELAY_MS);
    const labels = input.outcomes.map((l) => l.trim()).filter(Boolean);
    if (!input.title.trim()) throw new Error("Give your market a title.");
    if (labels.length === 0) throw new Error("Add at least one outcome.");
    if (input.closesAt <= Date.now()) throw new Error("Close date must be in the future.");

    const subsidy = subsidyFor(input.liquidity) * labels.length;
    const balance = this.state.balances[account] ?? 0;
    if (subsidy > balance + 1e-9) {
      throw new Error(`Creating this market requires a $${subsidy.toFixed(2)} liquidity subsidy.`);
    }

    const now = Date.now();
    let id = slugify(input.title) || "market";
    while (this.state.events[id]) id = `${id}-${randomHex(2).slice(2)}`;

    const multi = labels.length > 1;
    const p0 = multi ? 1 / labels.length : input.initialProbability;
    const ev: MarketEvent = {
      id,
      title: input.title.trim(),
      category: input.category,
      course: input.course?.trim() || undefined,
      closesAt: input.closesAt,
      resolvesAt: input.closesAt + 14 * 24 * 60 * 60 * 1000,
      rules: input.rules.trim(),
      source: "Berkeleytime",
      creator: account,
      createdAt: now,
      status: "open",
      outcomes: labels.map((label, i) => ({
        id: multi ? `o${i}` : "yes",
        label: multi ? label : "Yes",
        ...initialQuantities(p0, input.liquidity),
        b: input.liquidity,
        volume: 0,
        history: [{ t: now, p: p0 }],
      })),
    };

    const s = this.state;
    this.commit({
      ...s,
      events: { ...s.events, [id]: ev },
      balances: { ...s.balances, [account]: balance - subsidy },
    });
    return ev;
  }

  async faucet(account: Address) {
    await wait(TX_DELAY_MS);
    const s = this.state;
    this.commit({
      ...s,
      balances: { ...s.balances, [account]: (s.balances[account] ?? 0) + FAUCET_AMOUNT },
    });
  }
}

export function positionValue(ev: MarketEvent | undefined, p: Position) {
  const o = ev?.outcomes.find((x) => x.id === p.outcomeId);
  if (!o) return 0;
  return proceedsForShares(p.side, p.shares, o.qYes, o.qNo, o.b);
}
