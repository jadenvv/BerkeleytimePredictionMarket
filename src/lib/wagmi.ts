import { createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected, mock } from "wagmi/connectors";

/** Shared demo account so the app is usable without a browser wallet. */
export const DEMO_ACCOUNT = "0xB3Ae1e7A1De5b3D0C4f1a2b7E6c9d8F0a1B2c3D4" as const;

const DEMO_FLAG = "btm:demo-connected";

/** The mock connector keeps its connection in memory, so persist it ourselves. */
export function rememberDemo(connected: boolean) {
  try {
    if (connected) window.localStorage.setItem(DEMO_FLAG, "1");
    else window.localStorage.removeItem(DEMO_FLAG);
  } catch {}
}

export function demoWasConnected() {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(DEMO_FLAG) === "1";
  } catch {
    return false;
  }
}

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    injected(),
    mock({ accounts: [DEMO_ACCOUNT], features: { reconnect: true } }),
  ],
  transports: { [baseSepolia.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
