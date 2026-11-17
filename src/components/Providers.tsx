"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { useAccount, WagmiProvider } from "wagmi";
import { useEthersSigner } from "@/lib/ethers";
import { protocol } from "@/lib/protocol";
import { wagmiConfig } from "@/lib/wagmi";

function ProtocolSession() {
  const { address, chainId } = useAccount();
  const signer = useEthersSigner();
  useEffect(() => {
    try {
      localStorage.removeItem("btm:state:v1");
      localStorage.removeItem("btm:demo-connected");
    } catch { /* Storage may be unavailable. */ }
  }, []);
  useEffect(() => {
    protocol.setWallet(signer, address, chainId);
  }, [signer, address, chainId]);
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
          <ProtocolSession />
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
