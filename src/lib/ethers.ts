"use client";

import { BrowserProvider, FallbackProvider, JsonRpcProvider, JsonRpcSigner } from "ethers";
import { useMemo } from "react";
import type { Account, Chain, Client, Transport } from "viem";
import { type Config, useClient, useConnectorClient } from "wagmi";

/**
 * ethers.js adapters over wagmi's clients, so ethers code shares the wallet
 * connection RainbowKit manages. The on-chain Protocol implementation will use
 * `useEthersSigner()` to send contract transactions with `new Contract(...)`.
 */

function networkOf(chain: Chain) {
  return {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
}

/** Read-only ethers provider over wagmi's public client. */
export function clientToProvider(client: Client<Transport, Chain>) {
  const { chain, transport } = client;
  const network = networkOf(chain);
  if (transport.type === "fallback") {
    const providers = (transport.transports as ReturnType<Transport>[]).map(
      ({ value }) => new JsonRpcProvider(value?.url, network, { staticNetwork: true }),
    );
    if (providers.length === 1) return providers[0];
    return new FallbackProvider(providers);
  }
  return new JsonRpcProvider(transport.url, network, { staticNetwork: true });
}

/** ethers signer over the connected wallet's client. */
export function clientToSigner(client: Client<Transport, Chain, Account>) {
  const { account, chain, transport } = client;
  const provider = new BrowserProvider(transport, networkOf(chain));
  return new JsonRpcSigner(provider, account.address);
}

export function useEthersProvider({ chainId }: { chainId?: number } = {}) {
  const client = useClient<Config>({ chainId });
  return useMemo(() => (client ? clientToProvider(client) : undefined), [client]);
}

export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: client } = useConnectorClient<Config>({ chainId });
  return useMemo(() => (client ? clientToSigner(client) : undefined), [client]);
}
