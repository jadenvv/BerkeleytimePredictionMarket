"use client";

import { useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { protocol, useAccount, useBalance, usePositions } from "@/lib/protocol";
import { priceOf } from "@/lib/lmsr";
import { cents, pct, usd } from "@/lib/format";
import type { MarketEvent, Side } from "@/lib/types";

const QUICK_AMOUNTS = [1, 10, 50, 100];

export function TradePanel({
  ev,
  outcomeId,
  side,
  onSideChange,
}: {
  ev: MarketEvent;
  outcomeId: string;
  side: Side;
  onSideChange: (s: Side) => void;
}) {
  const { address, isConnected } = useAccount();
  const balance = useBalance(address);
  const positions = usePositions(address);
  const { openConnectModal } = useConnectModal();

  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const o = ev.outcomes.find((x) => x.id === outcomeId) ?? ev.outcomes[0];
  const binary = ev.outcomes.length === 1;
  const yesPrice = priceOf("yes", o.qYes, o.qNo, o.b);
  const held =
    positions.find((p) => p.eventId === ev.id && p.outcomeId === o.id && p.side === side)?.shares ?? 0;

  const value = Number(input) || 0;
  const quote =
    value > 0
      ? mode === "buy"
        ? protocol.quoteBuy(ev.id, o.id, side, value)
        : protocol.quoteSell(ev.id, o.id, side, Math.min(value, held))
      : null;
  const closed = ev.status !== "open";

  async function submit() {
    if (!address) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const t =
        mode === "buy"
          ? await protocol.buy(address, ev.id, o.id, side, value)
          : await protocol.sell(address, ev.id, o.id, side, value);
      setNotice(
        `${mode === "buy" ? "Bought" : "Sold"} ${t.shares.toFixed(2)} ${side.toUpperCase()} @ ${cents(t.price)} · tx ${t.txHash.slice(0, 10)}…`,
      );
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }

  async function faucet() {
    if (!address) return;
    setPending(true);
    await protocol.faucet(address);
    setPending(false);
  }

  return (
    <div className="rounded-2xl border border-line p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      {!binary && (
        <div className="mb-3 text-sm">
          <span className="text-muted">Trading </span>
          <span className="font-semibold">{o.label}</span>
        </div>
      )}

      <div className="mb-4 flex border-b border-line text-sm font-semibold">
        {(["buy", "sell"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setInput("");
              setError(null);
            }}
            className={`-mb-px border-b-2 px-1 pb-2 mr-4 capitalize ${
              mode === m ? "border-foreground text-foreground" : "border-transparent text-muted"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["yes", "no"] as const).map((s) => {
          const active = side === s;
          const price = s === "yes" ? yesPrice : 1 - yesPrice;
          const tone =
            s === "yes"
              ? active
                ? "bg-yes text-white"
                : "bg-yes-bg text-yes hover:bg-yes-bg-hover"
              : active
                ? "bg-no text-white"
                : "bg-no-bg text-no hover:bg-no-bg-hover";
          return (
            <button
              key={s}
              onClick={() => onSideChange(s)}
              className={`rounded-lg py-3 text-sm font-semibold tabular transition-colors ${tone}`}
            >
              {s === "yes" ? "Yes" : "No"} {cents(price)}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <label htmlFor="amount" className="font-medium">
            {mode === "buy" ? "Amount" : "Shares"}
          </label>
          {isConnected && (
            <span className="text-xs text-muted tabular">
              {mode === "buy" ? `Cash ${usd(balance)}` : `You hold ${held.toFixed(2)}`}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center rounded-lg border border-line px-3 focus-within:border-foreground">
          {mode === "buy" && <span className="text-xl font-semibold text-muted">$</span>}
          <input
            id="amount"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, ""))}
            placeholder="0"
            className="w-full bg-transparent py-3 pl-1 text-right text-xl font-semibold outline-none tabular"
          />
        </div>
        <div className="mt-2 flex gap-1.5">
          {mode === "buy"
            ? QUICK_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => setInput(String((Number(input) || 0) + a))}
                  className="flex-1 rounded-md bg-subtle py-1.5 text-xs font-semibold hover:bg-line"
                >
                  +${a}
                </button>
              ))
            : [0.25, 0.5, 1].map((f) => (
                <button
                  key={f}
                  onClick={() => setInput(String(Math.floor(held * f * 100) / 100))}
                  className="flex-1 rounded-md bg-subtle py-1.5 text-xs font-semibold hover:bg-line"
                >
                  {f === 1 ? "Max" : `${f * 100}%`}
                </button>
              ))}
        </div>
      </div>

      {quote && quote.shares > 0 && (
        <dl className="mt-5 space-y-2 text-sm tabular">
          <Row label="Avg price" value={cents(quote.avgPrice)} />
          {mode === "buy" ? (
            <>
              <Row label="Shares" value={quote.shares.toFixed(2)} />
              <Row
                label="New chance"
                value={`${pct(yesPrice)} → ${pct(quote.newPriceYes)}`}
              />
              <div className="flex items-center justify-between border-t border-line pt-3">
                <dt className="font-medium">Payout if {side === "yes" ? "Yes" : "No"}</dt>
                <dd className="text-lg font-bold text-yes">{usd(quote.payout)}</dd>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between border-t border-line pt-3">
              <dt className="font-medium">You&apos;ll receive</dt>
              <dd className="text-lg font-bold">{usd(quote.amount)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="mt-5">
        {!isConnected ? (
          <button
            onClick={() => openConnectModal?.()}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Connect wallet to trade
          </button>
        ) : mode === "buy" && balance < 1 ? (
          <button
            onClick={faucet}
            disabled={pending}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Minting…" : "Get 1,000 test USDC"}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending || closed || value <= 0}
            className={`w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50 ${
              side === "yes" ? "bg-yes hover:brightness-95" : "bg-no hover:brightness-95"
            }`}
          >
            {closed
              ? "Market closed"
              : pending
                ? "Confirming…"
                : `${mode === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-down">{error}</p>}
        {notice && <p className="mt-2 text-xs text-yes">{notice}</p>}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Each share pays $1 if correct. Prices set by an on-chain LMSR market maker.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
