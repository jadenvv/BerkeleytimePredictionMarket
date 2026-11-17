import { proceedsForShares } from "../lmsr";
import type { MarketEvent, Position } from "../types";

/** Estimated liquidation value before settlement; claimable payout afterwards. */
export function positionValue(ev: MarketEvent | undefined, p: Position) {
  const o = ev?.outcomes.find(x => x.id === p.outcomeId);
  if (!o) return 0;
  if (ev?.status === "resolved") return o.result === p.side ? p.shares : 0;
  return proceedsForShares(p.side, p.shares, o.qYes, o.qNo, o.b);
}
