/**
 * Binary Logarithmic Market Scoring Rule (LMSR).
 *
 * Every outcome is an independent YES/NO market with cost function
 *   C(qYes, qNo) = b * ln(e^(qYes/b) + e^(qNo/b))
 * A winning share pays out 1 USDC. The market maker's worst-case loss is
 * b * ln(2), which is the subsidy a market creator must post.
 *
 * This file is the source of truth for pricing until the Solidity contracts
 * exist; the contracts should implement the same math (fixed-point).
 */

function logSumExp(a: number, b: number): number {
  const m = Math.max(a, b);
  return m + Math.log(Math.exp(a - m) + Math.exp(b - m));
}

export function cost(qYes: number, qNo: number, b: number): number {
  return b * logSumExp(qYes / b, qNo / b);
}

/** Instantaneous price of YES (0..1). NO price is 1 - this. */
export function priceYes(qYes: number, qNo: number, b: number): number {
  return 1 / (1 + Math.exp((qNo - qYes) / b));
}

export function priceOf(side: "yes" | "no", qYes: number, qNo: number, b: number) {
  const p = priceYes(qYes, qNo, b);
  return side === "yes" ? p : 1 - p;
}

/** Shares received for spending `amount` USDC on `side`. Closed form. */
export function sharesForAmount(
  side: "yes" | "no",
  amount: number,
  qYes: number,
  qNo: number,
  b: number,
): number {
  if (amount <= 0) return 0;
  const [qSide, qOther] = side === "yes" ? [qYes, qNo] : [qNo, qYes];
  // b*ln(e^((qSide+x)/b) + e^(qOther/b)) = C0 + amount
  //   => x = b*ln(e^((C0+amount)/b) - e^(qOther/b)) - qSide
  const target = (cost(qYes, qNo, b) + amount) / b;
  const o = qOther / b;
  // ln(e^target - e^o) computed stably (target > o always holds here)
  const lnDiff = target + Math.log1p(-Math.exp(o - target));
  return b * lnDiff - qSide;
}

/** USDC returned for selling `shares` of `side`. */
export function proceedsForShares(
  side: "yes" | "no",
  shares: number,
  qYes: number,
  qNo: number,
  b: number,
): number {
  if (shares <= 0) return 0;
  const next =
    side === "yes"
      ? cost(qYes - shares, qNo, b)
      : cost(qYes, qNo - shares, b);
  return cost(qYes, qNo, b) - next;
}

/** Initial (qYes, qNo) so that a fresh market opens at probability `p`. */
export function initialQuantities(p: number, b: number) {
  const clamped = Math.min(0.99, Math.max(0.01, p));
  const diff = b * Math.log(clamped / (1 - clamped));
  return diff >= 0 ? { qYes: diff, qNo: 0 } : { qYes: 0, qNo: -diff };
}

/** Max loss of the market maker, i.e. required creator subsidy. */
export function subsidyFor(b: number) {
  return b * Math.LN2;
}
