"use client";
import { marketChain } from "@/lib/protocol/config";

import { useEffect, useState } from "react";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { protocol, useAccount, useBalance, usePositions, useNow, useProtocolState } from "@/lib/protocol";
import { priceOf } from "@/lib/lmsr";
import { cents, pct, usd } from "@/lib/format";
import type { Quote } from "@/lib/protocol/types";
import { transactionError } from "@/lib/protocol/onchain";
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
  const { address, isConnected, chainId } = useAccount();
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
  const yesPrice = o.result ? o.result === "yes" ? 1 : 0 : priceOf("yes", o.qYes, o.qNo, o.b);
  const held =
    positions.find((p) => p.eventId === ev.id && p.outcomeId === o.id && p.side === side)?.shares ?? 0;

  const value = Number(input) || 0;
  const now = useNow();
  const state = useProtocolState();
  const key = `${ev.id}:${o.id}:${side}:${mode}:${value}:${o.qYes}:${o.qNo}`;
  const [quoted, setQuoted] = useState<{ key: string; quote?: Quote; error?: string; deadline: number }>();
  useEffect(() => {
    if (!(value > 0) || !Number.isFinite(value)) return;
    let cancelled = false;
    const update = async () => {
      const deadline = Math.floor(Date.now() / 1000) + 120;
      try {
        const quote = await (mode === "buy"
          ? protocol.quoteBuy(ev.id, o.id, side, value)
          : protocol.quoteSell(ev.id, o.id, side, value));
        if (!cancelled) setQuoted({ key, quote, deadline });
      } catch (error) {
        if (!cancelled) setQuoted({ key, error: transactionError(error), deadline });
      }
    };
    void update();
    const timer = setInterval(update, 15_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [key, ev.id, o.id, side, mode, value]);
  const current = quoted?.key === key && quoted.deadline > now / 1000 ? quoted : undefined;
  const quote = current?.quote;
  const closed = ev.status !== "open" || now >= ev.closesAt;
  const unavailable = !!state.error || !!state.loading || (chainId !== marketChain.id);
  const needsFunding = ev.funded === false;

  async function submit() {
    if (!address || !quote || !current) return;
    setPending(true);
    setError(null);
    setNotice(null);
    try {
      const rawOutput = quote.rawOutput ?? String(Math.floor((mode === "buy" ? quote.shares : quote.amount) * 1e6));
      const limits = { minOutput: (BigInt(rawOutput) * BigInt(99) / BigInt(100)).toString(), deadline: current.deadline };
      const t =
        mode === "buy"
          ? await protocol.buy(address, ev.id, o.id, side, value, limits)
          : await protocol.sell(address, ev.id, o.id, side, value, limits);
      setNotice(
        `${mode === "buy" ? "Bought" : "Sold"} ${t.shares.toFixed(2)} ${side.toUpperCase()} @ ${cents(t.price)} · tx ${t.txHash.slice(0, 10)}…`,
      );
      setInput("");
    } catch (e) {
      setError(transactionError(e));
    } finally {
      setPending(false);
    }
  }

  async function faucet() {
    if (!address) return;
    setPending(true);
    setError(null);
    try { await protocol.faucet(address); }
    catch (e) { setError(transactionError(e)); }
    finally { setPending(false); }
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
            onChange={(e) => setInput(e.target.value.replace(/[^0-9.]/g, "").replace(/(\.\d{6}).*/, "$1"))}
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
                  onClick={() => setInput(f === 1 ? held.toFixed(6) : String(Math.floor(held * f * 1e6) / 1e6))}
                  className="flex-1 rounded-md bg-subtle py-1.5 text-xs font-semibold hover:bg-line"
                >
                  {f === 1 ? "Max" : `${f * 100}%`}
                </button>
              ))}
        </div>
      </div>

      {quote && quote.shares > 0 && (
        <dl className="mt-5 space-y-2 text-sm tabular">
          <Row label={`Fee (${quote.feeBps / 100}%)`} value={usd(quote.fee, quote.fee > 0 && quote.fee < 0.01 ? 6 : 2)} />
          {mode === "buy" && <Row label="Total cost" value={usd(quote.amount)} />}
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
        {isConnected && chainId !== marketChain.id && <p className="mb-2 text-xs text-down">Switch your wallet to Ethereum Sepolia to trade.</p>}
        {!isConnected ? (
          <button
            onClick={() => openConnectModal?.()}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            Connect wallet to trade
          </button>
        ) : !closed && !needsFunding && mode === "buy" && balance < 1 && state.canFaucet !== false ? (
          <button
            onClick={faucet}
            disabled={pending || unavailable || now < (state.faucetAvailableAt ?? 0)}
            className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Minting…" : now < (state.faucetAvailableAt ?? 0) ? "Faucet available after 24 hours" : "Get 1,000 test USDC"}
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={pending || closed || needsFunding || unavailable || !quote || value <= 0 || (mode === "buy" ? (quote?.amount ?? value) > balance : value > held)}
            className={`w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50 ${
              side === "yes" ? "bg-yes hover:brightness-95" : "bg-no hover:brightness-95"
            }`}
          >
            {needsFunding
              ? "Awaiting creator funding"
              : closed ? "Market closed"
              : pending
                ? "Confirming…"
                : `${mode === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`}
          </button>
        )}
        {current?.error && <p className="mt-2 text-xs text-down">{current.error}</p>}
        {value > 0 && !current && !closed && <p className="mt-2 text-xs text-muted">Getting quote…</p>}
        {error && <p className="mt-2 text-xs text-down">{error}</p>}
        {notice && <p className="mt-2 text-xs text-yes">{notice}</p>}
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-muted">
        Each winning share pays 1 USDC.
        {" Contract quotes · 1% price tolerance · two-minute transaction deadline."}
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
