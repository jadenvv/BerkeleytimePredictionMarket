"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { protocol, useAccount, useBalance } from "@/lib/protocol";
import { subsidyFor } from "@/lib/lmsr";
import { usd } from "@/lib/format";
import { CATEGORIES, type Category } from "@/lib/types";

const LIQUIDITY = [
  { b: 100, label: "Low" },
  { b: 250, label: "Medium" },
  { b: 500, label: "High" },
];

const input =
  "mt-1.5 w-full rounded-lg border border-line px-3 py-2.5 text-sm outline-none focus:border-foreground";

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const balance = useBalance(address);
  const { openConnectModal } = useConnectModal();

  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [category, setCategory] = useState<Category>("Grades");
  const [kind, setKind] = useState<"binary" | "multi">("binary");
  const [outcomes, setOutcomes] = useState(["", ""]);
  const [prob, setProb] = useState(50);
  const [closes, setCloses] = useState("");
  const [rules, setRules] = useState("");
  const [b, setB] = useState(250);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const labels = kind === "binary" ? ["Yes"] : outcomes.filter((o) => o.trim());
  const subsidy = subsidyFor(b) * Math.max(1, labels.length);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    setPending(true);
    setError(null);
    try {
      const ev = await protocol.createMarket(address, {
        title,
        course,
        category,
        rules,
        closesAt: closes ? new Date(closes).getTime() : 0,
        outcomes: labels,
        initialProbability: prob / 100,
        liquidity: b,
      });
      router.push(`/markets/${ev.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">Create a market</h1>
      <p className="mt-1 text-sm text-muted">
        Anyone can open a market. You fund the automated market maker&apos;s liquidity, which caps your
        maximum loss at the subsidy below.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Field label="Question">
          <input
            className={input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Will CS 162 Spring 2027 average GPA be above 3.3?"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Course (optional)">
            <input
              className={input}
              value={course}
              onChange={(e) => setCourse(e.target.value.toUpperCase())}
              placeholder="COMPSCI 162"
            />
          </Field>
          <Field label="Category">
            <select
              className={input}
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Market type">
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {(["binary", "multi"] as const).map((k) => (
              <button
                type="button"
                key={k}
                onClick={() => setKind(k)}
                className={`rounded-lg border py-2.5 text-sm font-semibold ${
                  kind === k ? "border-foreground bg-foreground text-white" : "border-line hover:bg-subtle"
                }`}
              >
                {k === "binary" ? "Yes / No" : "Multiple outcomes"}
              </button>
            ))}
          </div>
        </Field>

        {kind === "binary" ? (
          <Field label={`Starting chance: ${prob}%`}>
            <input
              type="range"
              min={5}
              max={95}
              value={prob}
              onChange={(e) => setProb(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--brand)]"
            />
          </Field>
        ) : (
          <Field label="Outcomes">
            <div className="space-y-2">
              {outcomes.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    className={input}
                    value={o}
                    onChange={(e) => setOutcomes(outcomes.map((x, j) => (j === i ? e.target.value : x)))}
                    placeholder={`Outcome ${i + 1}`}
                  />
                  {outcomes.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}
                      className="mt-1.5 rounded-lg px-3 text-muted hover:bg-subtle"
                      aria-label="Remove outcome"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {outcomes.length < 8 && (
                <button
                  type="button"
                  onClick={() => setOutcomes([...outcomes, ""])}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  + Add outcome
                </button>
              )}
            </div>
          </Field>
        )}

        <Field label="Trading closes">
          <input
            type="datetime-local"
            className={input}
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
          />
        </Field>

        <Field label="Resolution rules">
          <textarea
            className={`${input} min-h-28`}
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            placeholder="Resolves YES if Berkeleytime reports…"
          />
        </Field>

        <Field label="Liquidity">
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {LIQUIDITY.map((l) => (
              <button
                type="button"
                key={l.b}
                onClick={() => setB(l.b)}
                className={`rounded-lg border py-2.5 text-sm ${
                  b === l.b ? "border-foreground font-semibold" : "border-line hover:bg-subtle"
                }`}
              >
                {l.label}
                <span className="block text-xs text-muted">b = {l.b}</span>
              </button>
            ))}
          </div>
        </Field>

        <div className="rounded-xl bg-subtle p-4 text-sm tabular">
          <div className="flex justify-between">
            <span className="text-muted">Liquidity subsidy</span>
            <span className="font-semibold">{usd(subsidy)}</span>
          </div>
          {isConnected && (
            <div className="mt-1 flex justify-between">
              <span className="text-muted">Your cash</span>
              <span>{usd(balance)}</span>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-down">{error}</p>}

        <button
          type={isConnected ? "submit" : "button"}
          onClick={isConnected ? undefined : () => openConnectModal?.()}
          disabled={pending}
          className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {!isConnected ? "Connect wallet to create" : pending ? "Creating…" : "Create market"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
