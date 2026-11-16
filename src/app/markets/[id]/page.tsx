import { Suspense } from "react";
import { MarketView } from "./MarketView";

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-7xl px-4 py-10 text-muted">Loading market…</div>}>
      <MarketView />
    </Suspense>
  );
}
