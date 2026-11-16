"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CourseTile, MarketCard, outcomePrice, totalVolume } from "@/components/MarketCard";
import { PriceChart, SERIES_COLORS } from "@/components/PriceChart";
import { useProtocolState } from "@/lib/protocol";
import { compactUsd, date, pct } from "@/lib/format";
import { CATEGORIES, type Category, type MarketEvent } from "@/lib/types";

type Tab = "Trending" | "New" | "Closing soon" | Category;
const TABS: Tab[] = ["Trending", "New", "Closing soon", ...CATEGORIES];

export function Home() {
  const { events } = useProtocolState();
  const q = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const [tab, setTab] = useState<Tab>("Trending");

  const all = useMemo(() => Object.values(events).filter((e) => e.status === "open"), [events]);

  const list = useMemo(() => {
    let l = all;
    if (q) {
      l = l.filter((e) =>
        [e.title, e.course ?? "", e.category, ...e.outcomes.map((o) => o.label)]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if ((CATEGORIES as string[]).includes(tab)) l = l.filter((e) => e.category === tab);
    const sorted = [...l];
    if (tab === "New") sorted.sort((a, b) => b.createdAt - a.createdAt);
    else if (tab === "Closing soon") sorted.sort((a, b) => a.closesAt - b.closesAt);
    else sorted.sort((a, b) => totalVolume(b) - totalVolume(a));
    return sorted;
  }, [all, q, tab]);

  const featured = !q && tab === "Trending" ? list[0] : undefined;
  const rest = featured ? list.slice(1) : list;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <div className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 py-3">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              tab === t ? "bg-foreground text-white" : "text-muted hover:bg-subtle hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {q && (
        <p className="mt-6 text-sm text-muted">
          {list.length} result{list.length === 1 ? "" : "s"} for “{q}” ·{" "}
          <Link href="/" className="text-brand hover:underline">
            clear
          </Link>
        </p>
      )}

      {featured && <Featured ev={featured} />}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rest.map((ev) => (
          <MarketCard key={ev.id} ev={ev} />
        ))}
      </div>

      {list.length === 0 && (
        <div className="mt-16 text-center text-muted">
          <p>No markets here yet.</p>
          <Link href="/create" className="mt-2 inline-block font-semibold text-brand hover:underline">
            Create one →
          </Link>
        </div>
      )}
    </div>
  );
}

function Featured({ ev }: { ev: MarketEvent }) {
  const sorted = [...ev.outcomes].sort((a, b) => outcomePrice(b) - outcomePrice(a));
  const colorOf = (id: string) =>
    SERIES_COLORS[ev.outcomes.findIndex((o) => o.id === id) % SERIES_COLORS.length];

  return (
    <section className="mt-6 grid gap-6 rounded-2xl border border-line p-5 lg:grid-cols-[1fr_1.4fr]">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <span>{ev.category}</span>
          {ev.course && (
            <>
              <span>·</span>
              <span>{ev.course}</span>
            </>
          )}
        </div>
        <Link href={`/markets/${ev.id}`} className="mt-3 flex items-start gap-3 hover:underline">
          <CourseTile ev={ev} size={52} />
          <h2 className="text-2xl font-bold leading-tight">{ev.title}</h2>
        </Link>
        <ul className="mt-6 space-y-3">
          {sorted.slice(0, 4).map((o) => {
            const p = outcomePrice(o);
            return (
              <li key={o.id} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(o.id) }} />
                <span className="flex-1 text-sm">{ev.outcomes.length === 1 ? "Yes" : o.label}</span>
                <span className="w-12 text-right text-lg font-bold tabular">{pct(p)}</span>
                <Link
                  href={`/markets/${ev.id}?outcome=${o.id}&side=yes`}
                  className="rounded-md bg-yes-bg px-3 py-1.5 text-xs font-semibold text-yes hover:bg-yes-bg-hover"
                >
                  Yes
                </Link>
                <Link
                  href={`/markets/${ev.id}?outcome=${o.id}&side=no`}
                  className="rounded-md bg-no-bg px-3 py-1.5 text-xs font-semibold text-no hover:bg-no-bg-hover"
                >
                  No
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex gap-4 pt-6 text-xs text-muted tabular">
          <span>{compactUsd(totalVolume(ev))} vol</span>
          <span>Closes {date(ev.closesAt)}</span>
        </div>
      </div>
      <PriceChart outcomes={ev.outcomes} height={280} />
    </section>
  );
}
