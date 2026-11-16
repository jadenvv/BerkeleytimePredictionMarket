"use client";

import Link from "next/link";
import { priceYes } from "@/lib/lmsr";
import { compactUsd, pct, cents } from "@/lib/format";
import type { Category, MarketEvent } from "@/lib/types";

const CATEGORY_STYLE: Record<Category, { bg: string; fg: string }> = {
  Grades: { bg: "#e8f7f0", fg: "#00875a" },
  Enrollment: { bg: "#e8f0fe", fg: "#2563eb" },
  Waitlists: { bg: "#fff4e5", fg: "#c2410c" },
  Instructors: { bg: "#f2edfc", fg: "#6d28d9" },
  Campus: { bg: "#fdecf3", fg: "#be185d" },
};

const CATEGORY_GLYPH: Record<Category, string> = {
  Grades: "A+",
  Enrollment: "SEATS",
  Waitlists: "WAIT",
  Instructors: "PROF",
  Campus: "CAL",
};

export function CourseTile({ ev, size = 44 }: { ev: MarketEvent; size?: number }) {
  const style = CATEGORY_STYLE[ev.category];
  const [dept, num] = ev.course ? splitCourse(ev.course) : [CATEGORY_GLYPH[ev.category], ""];
  return (
    <div
      className="grid shrink-0 place-items-center rounded-lg text-center font-bold leading-none"
      style={{ width: size, height: size, background: style.bg, color: style.fg }}
    >
      <div>
        <div style={{ fontSize: size * 0.2 }}>{dept}</div>
        {num && <div style={{ fontSize: size * 0.3 }}>{num}</div>}
      </div>
    </div>
  );
}

function splitCourse(course: string): [string, string] {
  const i = course.lastIndexOf(" ");
  const dept = course.slice(0, i).replace("COMPSCI", "CS");
  return [dept, course.slice(i + 1)];
}

export function totalVolume(ev: MarketEvent) {
  return ev.outcomes.reduce((s, o) => s + o.volume, 0);
}

export function outcomePrice(o: MarketEvent["outcomes"][number]) {
  return priceYes(o.qYes, o.qNo, o.b);
}

function YesNo({ href }: { href: string }) {
  return (
    <div className="flex shrink-0 gap-1.5">
      <Link
        href={`${href}&side=yes`}
        className="rounded-md bg-yes-bg px-2.5 py-1 text-xs font-semibold text-yes hover:bg-yes-bg-hover"
      >
        Yes
      </Link>
      <Link
        href={`${href}&side=no`}
        className="rounded-md bg-no-bg px-2.5 py-1 text-xs font-semibold text-no hover:bg-no-bg-hover"
      >
        No
      </Link>
    </div>
  );
}

export function MarketCard({ ev }: { ev: MarketEvent }) {
  const href = `/markets/${ev.id}`;
  const binary = ev.outcomes.length === 1;
  const sorted = [...ev.outcomes].sort((a, b) => outcomePrice(b) - outcomePrice(a));

  return (
    <div className="flex flex-col rounded-2xl border border-line bg-white p-4 transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
      <Link href={href} className="flex items-start gap-3">
        <CourseTile ev={ev} />
        <h3 className="text-[15px] font-semibold leading-snug line-clamp-2">{ev.title}</h3>
      </Link>

      <div className="mt-4 flex-1">
        {binary ? (
          <BinaryBody ev={ev} />
        ) : (
          <ul className="space-y-2">
            {sorted.slice(0, 3).map((o) => {
              const p = outcomePrice(o);
              return (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm">{o.label}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm font-semibold tabular">{pct(p)}</span>
                    <YesNo href={`${href}?outcome=${o.id}`} />
                  </div>
                </li>
              );
            })}
            {sorted.length > 3 && (
              <li className="text-xs text-muted">+{sorted.length - 3} more</li>
            )}
          </ul>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-muted">
        <span className="tabular">{compactUsd(totalVolume(ev))} vol</span>
        <span>{ev.category}</span>
      </div>
    </div>
  );
}

function BinaryBody({ ev }: { ev: MarketEvent }) {
  const o = ev.outcomes[0];
  const p = outcomePrice(o);
  const href = `/markets/${ev.id}?outcome=${o.id}`;
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular">{pct(p)}</span>
        <span className="text-sm text-muted">chance</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`${href}&side=yes`}
          className="rounded-lg bg-yes-bg py-2.5 text-center text-sm font-semibold text-yes hover:bg-yes-bg-hover tabular"
        >
          Yes {cents(p)}
        </Link>
        <Link
          href={`${href}&side=no`}
          className="rounded-lg bg-no-bg py-2.5 text-center text-sm font-semibold text-no hover:bg-no-bg-hover tabular"
        >
          No {cents(1 - p)}
        </Link>
      </div>
    </div>
  );
}
