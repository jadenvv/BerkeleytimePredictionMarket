"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useAccount as useWagmiAccount } from "wagmi";
import { OnchainProtocol } from "./onchain";
import { chainConfig } from "./config";
import type { Address, ProtocolState } from "./types";

export type { Address, Quote, Protocol } from "./types";
export { positionValue } from "./positions";

/** All market data comes from the configured Ethereum Sepolia contract. */
export const protocol = new OnchainProtocol(chainConfig);

export function useNow() {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  return now;
}

export function useProtocolState(): ProtocolState {
  return useSyncExternalStore(protocol.subscribe, protocol.getState, protocol.getServerState);
}

export function useMarket(id: string) {
  return useProtocolState().events[id];
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/**
 * Wallet connection, reported as disconnected until hydration completes so
 * the client's first render matches the server HTML.
 */
export function useAccount(): { address?: Address; isConnected: boolean; chainId?: number } {
  const { address, isConnected, chainId } = useWagmiAccount();
  const hydrated = useHydrated();
  if (!hydrated) return { address: undefined, isConnected: false };
  return { address: address?.toLowerCase() as Address | undefined, isConnected, chainId };
}

export function useBalance(address?: Address) {
  const s = useProtocolState();
  return address ? (s.balances[address] ?? 0) : 0;
}

export function usePositions(address?: Address) {
  const s = useProtocolState();
  return address ? (s.positions[address] ?? []) : [];
}
