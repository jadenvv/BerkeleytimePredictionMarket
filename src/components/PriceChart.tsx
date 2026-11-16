"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Outcome } from "@/lib/types";

export const SERIES_COLORS = ["#00b171", "#2563eb", "#7c4ddb", "#f59e0b", "#e5484d", "#0891b2"];

const RANGES = [
  { key: "1D", ms: 24 * 3600e3 },
  { key: "1W", ms: 7 * 24 * 3600e3 },
  { key: "1M", ms: 30 * 24 * 3600e3 },
  { key: "ALL", ms: Infinity },
] as const;

type Row = { t: number } & Record<string, number>;

function buildRows(outcomes: Outcome[], from: number): Row[] {
  const times = new Set<number>();
  outcomes.forEach((o) => o.history.forEach((h) => h.t >= from && times.add(h.t)));
  const sorted = [...times].sort((a, b) => a - b);

  const cursors = outcomes.map(() => 0);
  const last: number[] = outcomes.map((o) => {
    // value just before the window so lines start at the left edge
    const before = o.history.filter((h) => h.t < from).at(-1);
    return before ? before.p : o.history[0]?.p ?? 0.5;
  });

  const rows: Row[] = [];
  if (Number.isFinite(from) && from > 0) {
    rows.push({ t: from, ...Object.fromEntries(outcomes.map((o, i) => [o.id, last[i] * 100])) } as Row);
  }
  for (const t of sorted) {
    const row = { t } as Row;
    outcomes.forEach((o, i) => {
      const h = o.history;
      while (cursors[i] < h.length && h[cursors[i]].t <= t) {
        last[i] = h[cursors[i]].p;
        cursors[i]++;
      }
      row[o.id] = Math.round(last[i] * 1000) / 10;
    });
    rows.push(row);
  }
  return rows;
}

export function PriceChart({ outcomes, height = 300 }: { outcomes: Outcome[]; height?: number }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("ALL");
  const latest = useMemo(
    () => Math.max(...outcomes.flatMap((o) => o.history.map((h) => h.t))),
    [outcomes],
  );
  const span = RANGES.find((r) => r.key === range)!.ms;
  const from = Number.isFinite(span) ? latest - span : 0;
  const rows = useMemo(() => buildRows(outcomes, from), [outcomes, from]);
  const shortRange = span <= 24 * 3600e3;

  return (
    <div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#eef0f2" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(t) =>
                new Date(t).toLocaleString("en-US", shortRange ? { hour: "numeric" } : { month: "short", day: "numeric" })
              }
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              orientation="right"
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickFormatter={(v) => `${v}%`}
              tick={{ fontSize: 11, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              labelFormatter={(t) =>
                new Date(Number(t)).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })
              }
              formatter={(v, name) => [
                `${Number(v).toFixed(1)}%`,
                outcomes.find((o) => o.id === name)?.label ?? String(name),
              ]}
              contentStyle={{ borderRadius: 10, border: "1px solid #e7e8ea", fontSize: 12 }}
            />
            {outcomes.map((o, i) => (
              <Line
                key={o.id}
                dataKey={o.id}
                type="stepAfter"
                stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              range === r.key ? "bg-foreground text-white" : "text-muted hover:bg-subtle"
            }`}
          >
            {r.key}
          </button>
        ))}
      </div>
    </div>
  );
}
