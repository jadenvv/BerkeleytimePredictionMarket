"use client";
import { protocol, useProtocolState } from '@/lib/protocol';
export function ProtocolStatus() {
  const { loading, error } = useProtocolState();
  return <div className="border-b border-line bg-subtle px-4 py-2 text-center text-xs" role="status">
    Ethereum Sepolia · on-chain test USDC · creator-resolved market.
    {loading && <span className="ml-2">Loading market…</span>}
    {error && <p className="mt-1 text-down">{error} <button className="underline" onClick={() => void protocol.refresh()}>Retry</button></p>}
  </div>;
}
