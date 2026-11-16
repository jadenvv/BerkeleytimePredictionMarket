"use client";

import { useSyncExternalStore } from "react";
import { useAccount as useWagmiAccount } from "wagmi";
import { MockProtocol } from "./mock";
import type { Address, ProtocolState } from "./types";

export type { Address, Quote, NewMarketInput, Protocol } from "./types";
export { positionValue } from "./mock";

/**
 * The active protocol implementation. Swap for an on-chain implementation
 * once the contracts are deployed.
 */
export const protocol = new MockProtocol();

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
export function useAccount(): { address?: Address; isConnected: boolean } {
  const { address, isConnected } = useWagmiAccount();
  const hydrated = useHydrated();
  if (!hydrated) return { address: undefined, isConnected: false };
  return { address: address as Address | undefined, isConnected };
}

export function useBalance(address?: Address) {
  const s = useProtocolState();
  return address ? (s.balances[address] ?? 0) : 0;
}

export function usePositions(address?: Address) {
  const s = useProtocolState();
  return address ? (s.positions[address] ?? []) : [];
}
