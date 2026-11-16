"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CourseTile, outcomePrice, totalVolume } from "@/components/MarketCard";
import { PriceChart, SERIES_COLORS } from "@/components/PriceChart";
import { TradePanel } from "@/components/TradePanel";
import { positionValue, useAccount, useMarket, usePositions, useProtocolState } from "@/lib/protocol";
import { cents, compactUsd, date, dateTime, pct, shortAddress, usd } from "@/lib/format";
import type { MarketEvent, Side } from "@/lib/types";

export function MarketView() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const ev = useMarket(id);

  const [outcomeId, setOutcomeId] = useState(search.get("outcome") ?? "");
  const [side, setSide] = useState<Side>(search.get("side") === "no" ? "no" : "yes");

  if (!ev) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <p className="text-lg font-semibold">Market not found</p>
        <Link href="/" className="mt-2 inline-block text-brand hover:underline">
          Back to markets
        </Link>
      </div>
    );
  }

  const sorted = [...ev.outcomes].sort((a, b) => outcomePrice(b) - outcomePrice(a));
  const selected = ev.outcomes.find((o) => o.id === outcomeId) ?? sorted[0];
  const binary = ev.outcomes.length === 1;
  const colorOf = (oid: string) =>
    SERIES_COLORS[ev.outcomes.findIndex((o) => o.id === oid) % SERIES_COLORS.length];

  const pick = (oid: string, s: Side) => {
    setOutcomeId(oid);
    setSide(s);
  };

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-6 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <Link href="/" className="hover:text-foreground">
            Markets
          </Link>
          <span>/</span>
          <span>{ev.category}</span>
          {ev.course && (
            <>
              <span>/</span>
              <span>{ev.course}</span>
            </>
          )}
        </div>

        <div className="mt-3 flex items-start gap-4">
          <CourseTile ev={ev} size={60} />
          <div>
            <h1 className="text-2xl font-bold leading-tight sm:text-[28px]">{ev.title}</h1>
            {ev.subtitle && <p className="mt-1 text-sm text-muted">{ev.subtitle}</p>}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
          {binary ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular" style={{ color: colorOf(selected.id) }}>
                {pct(outcomePrice(selected))}
              </span>
              <span className="text-sm text-muted">chance</span>
            </div>
          ) : (
            sorted.slice(0, 4).map((o) => (
              <div key={o.id} className="flex items-center gap-1.5 text-sm">
                <span className="h-2 w-2 rounded-full" style={{ background: colorOf(o.id) }} />
                <span className="text-muted">{o.label}</span>
                <span className="font-semibold tabular">{pct(outcomePrice(o))}</span>
              </div>
            ))
          )}
        </div>

        <div className="mt-4">
          <PriceChart outcomes={ev.outcomes} />
        </div>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-b border-line pb-4 text-xs text-muted tabular">
          <span>{compactUsd(totalVolume(ev))} volume</span>
          <span>Closes {date(ev.closesAt)}</span>
          <span>Resolves ~{date(ev.resolvesAt)}</span>
        </div>

        {!binary && (
          <section className="mt-6">
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line pb-2 text-xs font-medium text-muted">
              <span>Outcome</span>
              <span className="w-16 text-right">Chance</span>
              <span className="w-[188px]" />
            </div>
            <ul>
              {sorted.map((o) => {
                const p = outcomePrice(o);
                const isSel = o.id === selected.id;
                return (
                  <li
                    key={o.id}
                    onClick={() => setOutcomeId(o.id)}
                    className={`grid cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b border-line py-3 ${
                      isSel ? "bg-subtle -mx-3 px-3 rounded-lg border-transparent" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(o.id) }} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{o.label}</div>
                        <div className="text-xs text-muted tabular">{compactUsd(o.volume)} vol</div>
                      </div>
                    </div>
                    <span className="w-16 text-right text-xl font-bold tabular">{pct(p)}</span>
                    <div className="flex w-[188px] gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pick(o.id, "yes");
                        }}
                        className={`flex-1 rounded-lg py-2 text-sm font-semibold tabular ${
                          isSel && side === "yes" ? "bg-yes text-white" : "bg-yes-bg text-yes hover:bg-yes-bg-hover"
                        }`}
                      >
                        Yes {cents(p)}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          pick(o.id, "no");
                        }}
                        className={`flex-1 rounded-lg py-2 text-sm font-semibold tabular ${
                          isSel && side === "no" ? "bg-no text-white" : "bg-no-bg text-no hover:bg-no-bg-hover"
                        }`}
                      >
                        No {cents(1 - p)}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <YourPositions ev={ev} />

        <section className="mt-8">
          <h2 className="text-lg font-bold">Rules</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80">{ev.rules}</p>
          <dl className="mt-4 grid gap-3 rounded-xl bg-subtle p-4 text-sm sm:grid-cols-2">
            <Info label="Resolution source" value={ev.source} />
            <Info label="Oracle" value="Optimistic oracle · 48h dispute window" />
            <Info label="Collateral" value="USDC on Base" />
            <Info label="Created by" value={shortAddress(ev.creator)} mono />
          </dl>
        </section>

        <Activity ev={ev} />
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <TradePanel ev={ev} outcomeId={selected.id} side={side} onSideChange={setSide} />
      </aside>
    </div>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function YourPositions({ ev }: { ev: MarketEvent }) {
  const { address } = useAccount();
  const mine = usePositions(address).filter((p) => p.eventId === ev.id);
  if (mine.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Your position</h2>
      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        {mine.map((p) => {
          const o = ev.outcomes.find((x) => x.id === p.outcomeId);
          const value = positionValue(ev, p);
          const pnl = value - p.cost;
          return (
            <div
              key={`${p.outcomeId}:${p.side}`}
              className="flex items-center justify-between border-b border-line px-4 py-3 text-sm last:border-0 tabular"
            >
              <div>
                <span className={`font-semibold ${p.side === "yes" ? "text-yes" : "text-no"}`}>
                  {p.side === "yes" ? "Yes" : "No"}
                </span>
                {ev.outcomes.length > 1 && <span className="ml-1.5">{o?.label}</span>}
                <div className="text-xs text-muted">
                  {p.shares.toFixed(2)} shares · avg {cents(p.cost / p.shares)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{usd(value)}</div>
                <div className={`text-xs ${pnl >= 0 ? "text-yes" : "text-down"}`}>
                  {pnl >= 0 ? "+" : ""}
                  {usd(pnl)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Activity({ ev }: { ev: MarketEvent }) {
  const { trades } = useProtocolState();
  const mine = trades.filter((t) => t.eventId === ev.id).slice(0, 15);
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">Activity</h2>
      {mine.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No trades yet. Be the first.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {mine.map((t) => {
            const o = ev.outcomes.find((x) => x.id === t.outcomeId);
            return (
              <li key={t.id} className="flex items-center justify-between py-2.5 tabular">
                <span>
                  <span className="font-mono text-xs text-muted">{shortAddress(t.account)}</span>{" "}
                  {t.action === "buy" ? "bought" : "sold"}{" "}
                  <span className={`font-semibold ${t.side === "yes" ? "text-yes" : "text-no"}`}>
                    {t.shares.toFixed(1)} {t.side === "yes" ? "Yes" : "No"}
                  </span>
                  {ev.outcomes.length > 1 && <span className="text-muted"> · {o?.label}</span>} at{" "}
                  {cents(t.price)}
                </span>
                <span className="text-xs text-muted">{dateTime(t.t)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
