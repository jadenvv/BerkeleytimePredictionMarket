"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useConnect, useConnection, useConnectors, WagmiProvider } from "wagmi";
import { demoWasConnected, wagmiConfig } from "@/lib/wagmi";

/** Restores a demo-wallet session after hydration (the mock connector can't persist itself). */
function DemoReconnect() {
  const { status } = useConnection();
  const connectors = useConnectors();
  const { mutate: connect } = useConnect();
  useEffect(() => {
    if (status !== "disconnected" || !demoWasConnected()) return;
    const demo = connectors.find((c) => c.type === "mock");
    if (demo) connect({ connector: demo });
    // only on first settle after mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status === "disconnected"]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DemoReconnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
