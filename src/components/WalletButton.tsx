"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useConnect, useConnectors, useDisconnect } from "wagmi";
import { useAccount, useBalance } from "@/lib/protocol";
import { shortAddress, usd } from "@/lib/format";
import { rememberDemo } from "@/lib/wagmi";

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const balance = useBalance(address);
  const connectors = useConnectors();
  const { mutate: connect, isPending, error } = useConnect();
  const { mutate: disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (isConnected && address) {
    return (
      <div ref={ref} className="relative flex items-center gap-3">
        <Link href="/portfolio" className="hidden sm:block text-right leading-tight">
          <div className="text-[11px] text-muted">Cash</div>
          <div className="text-sm font-semibold tabular">{usd(balance)}</div>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-subtle"
        >
          <span
            className="h-5 w-5 rounded-full"
            style={{ background: `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(-6)})` }}
          />
          {shortAddress(address)}
        </button>
        {open && (
          <div className="absolute right-0 top-11 w-48 rounded-xl border border-line bg-white p-1 shadow-lg">
            <Link
              href="/portfolio"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2 text-sm hover:bg-subtle"
            >
              Portfolio
            </Link>
            <button
              onClick={() => {
                disconnect();
                rememberDemo(false);
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-subtle"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
      >
        {isPending ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className="absolute right-0 top-12 w-64 rounded-xl border border-line bg-white p-2 shadow-lg">
          <div className="px-2 pb-2 pt-1 text-xs font-medium text-muted">Choose a wallet</div>
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect(
                  { connector: c },
                  {
                    onSuccess: () => {
                      rememberDemo(c.type === "mock");
                      setOpen(false);
                    },
                  },
                );
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm hover:bg-subtle"
            >
              <span className="font-medium">
                {c.type === "mock" ? "Demo wallet" : c.name === "Injected" ? "Browser wallet" : c.name}
              </span>
              <span className="text-xs text-muted">
                {c.type === "mock" ? "no extension" : "MetaMask, Rabby…"}
              </span>
            </button>
          ))}
          {error && <p className="px-3 pt-1 text-xs text-down">{error.message.split("\n")[0]}</p>}
        </div>
      )}
    </div>
  );
}
