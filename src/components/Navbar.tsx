"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { WalletButton } from "./WalletButton";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 shrink-0">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-white text-sm font-black">
        b
      </span>
      <span className="text-[17px] font-bold tracking-tight">
        berkeleytime<span className="text-brand"> markets</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4">
        <Logo />
        <form
          className="hidden md:block flex-1 max-w-md"
          onSubmit={(e) => {
            e.preventDefault();
            router.push(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/");
          }}
        >
          <label className="flex items-center gap-2 rounded-full bg-subtle px-4 py-2 text-sm text-muted focus-within:ring-2 focus-within:ring-brand/30">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search courses or markets"
              className="w-full bg-transparent text-foreground placeholder:text-muted outline-none"
            />
          </label>
        </form>
        <nav className="hidden sm:flex items-center gap-1 text-sm font-medium">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-1.5 transition-colors ${
                  active ? "text-foreground" : "text-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
