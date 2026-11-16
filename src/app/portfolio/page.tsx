"use client";

import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { CourseTile } from "@/components/MarketCard";
import {
  positionValue,
  protocol,
  useAccount,
  useBalance,
  usePositions,
  useProtocolState,
} from "@/lib/protocol";
import { cents, dateTime, usd } from "@/lib/format";

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const state = useProtocolState();
  const balance = useBalance(address);
  const positions = usePositions(address);
  const [minting, setMinting] = useState(false);
  const { openConnectModal } = useConnectModal();

  if (!isConnected || !address) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">Your portfolio</h1>
        <p className="mt-2 text-muted">Connect a wallet to see your positions and trade history.</p>
        <button
          onClick={() => openConnectModal?.()}
          className="mt-6 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  const rows = positions.map((p) => {
    const ev = state.events[p.eventId];
    const value = positionValue(ev, p);
    return { p, ev, value, pnl: value - p.cost };
  });
  const invested = rows.reduce((s, r) => s + r.value, 0);
  const pnl = rows.reduce((s, r) => s + r.pnl, 0);
  const history = state.trades.filter((t) => t.account === address);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Portfolio</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Portfolio value" value={usd(balance + invested)} />
        <Stat label="Cash (USDC)" value={usd(balance)}>
          <button
            disabled={minting}
            onClick={async () => {
              setMinting(true);
              await protocol.faucet(address);
              setMinting(false);
            }}
            className="mt-3 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {minting ? "Minting…" : "+ 1,000 test USDC"}
          </button>
        </Stat>
        <Stat
          label="Unrealized P&L"
          value={`${pnl >= 0 ? "+" : ""}${usd(pnl)}`}
          tone={pnl > 0 ? "text-yes" : pnl < 0 ? "text-down" : undefined}
        />
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-bold">Positions</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No open positions.{" "}
            <Link href="/" className="font-semibold text-brand hover:underline">
              Browse markets →
            </Link>
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[640px] text-sm tabular">
              <thead className="bg-subtle text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Market</th>
                  <th className="px-4 py-2.5 font-medium">Side</th>
                  <th className="px-4 py-2.5 text-right font-medium">Shares</th>
                  <th className="px-4 py-2.5 text-right font-medium">Avg</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                  <th className="px-4 py-2.5 text-right font-medium">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, ev, value, pnl }) => {
                  const o = ev?.outcomes.find((x) => x.id === p.outcomeId);
                  return (
                    <tr key={`${p.eventId}:${p.outcomeId}:${p.side}`} className="border-t border-line">
                      <td className="px-4 py-3">
                        {ev ? (
                          <Link href={`/markets/${ev.id}?outcome=${p.outcomeId}&side=${p.side}`} className="flex items-center gap-3 hover:underline">
                            <CourseTile ev={ev} size={32} />
                            <span>
                              <span className="font-medium">{ev.title}</span>
                              {ev.outcomes.length > 1 && (
                                <span className="block text-xs text-muted">{o?.label}</span>
                              )}
                            </span>
                          </Link>
                        ) : (
                          p.eventId
                        )}
                      </td>
                      <td className={`px-4 py-3 font-semibold ${p.side === "yes" ? "text-yes" : "text-no"}`}>
                        {p.side === "yes" ? "Yes" : "No"}
                      </td>
                      <td className="px-4 py-3 text-right">{p.shares.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{cents(p.cost / p.shares)}</td>
                      <td className="px-4 py-3 text-right font-medium">{usd(value)}</td>
                      <td className={`px-4 py-3 text-right ${pnl >= 0 ? "text-yes" : "text-down"}`}>
                        {pnl >= 0 ? "+" : ""}
                        {usd(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold">History</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No trades yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm tabular">
            {history.map((t) => {
              const ev = state.events[t.eventId];
              return (
                <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{ev?.title ?? t.eventId}</div>
                    <div className="text-xs text-muted">
                      {t.action === "buy" ? "Bought" : "Sold"} {t.shares.toFixed(2)}{" "}
                      {t.side === "yes" ? "Yes" : "No"} @ {cents(t.price)} ·{" "}
                      <span className="font-mono">{t.txHash.slice(0, 10)}…</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={t.action === "buy" ? "" : "text-yes"}>
                      {t.action === "buy" ? "-" : "+"}
                      {usd(t.amount)}
                    </div>
                    <div className="text-xs text-muted">{dateTime(t.t)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line p-5">
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular ${tone ?? ""}`}>{value}</div>
      {children}
    </div>
  );
}
