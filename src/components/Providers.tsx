"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAccount, useAccountEffect, useConnect, useConnectors, WagmiProvider } from "wagmi";
import { demoWasConnected, rememberDemo, wagmiConfig } from "@/lib/wagmi";

/**
 * The mock connector behind "Demo wallet" can't persist its session, so
 * remember it ourselves and restore it once after the page loads.
 */
function DemoSession() {
  const { status } = useAccount();
  const connectors = useConnectors();
  const { connect } = useConnect();
  const tried = useRef(false);

  useAccountEffect({
    onConnect: ({ connector }) => rememberDemo(connector.type === "mock"),
    onDisconnect: () => rememberDemo(false),
  });

  useEffect(() => {
    if (tried.current || status !== "disconnected") return;
    tried.current = true;
    if (!demoWasConnected()) return;
    const demo = connectors.find((c) => c.type === "mock");
    if (demo) connect({ connector: demo });
  }, [status, connectors, connect]);

  return null;
}

const theme = lightTheme({
  accentColor: "#00b171",
  accentColorForeground: "white",
  borderRadius: "large",
  fontStack: "system",
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact" appInfo={{ appName: "Berkeleytime Markets" }}>
          <DemoSession />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
