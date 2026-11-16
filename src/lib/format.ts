export function cents(p: number) {
  const c = Math.round(p * 100);
  if (c < 1) return "<1¢";
  if (c > 99) return ">99¢";
  return `${c}¢`;
}

export function pct(p: number) {
  const c = Math.round(p * 100);
  if (c < 1) return "<1%";
  if (c > 99) return ">99%";
  return `${c}%`;
}

export function usd(n: number, digits = 2) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function compactUsd(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString("en-US")}K`;
  return `$${Math.round(n)}`;
}

export function shortAddress(a?: string) {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
}

export function date(ms: number) {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

export function dateTime(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
