import { connectorsForWallets, type Wallet } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, createConnector, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { mock } from "wagmi/connectors";

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

const DEMO_ICON =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#00b171"/><text x="14" y="19" font-family="Arial" font-size="15" font-weight="900" fill="#fff" text-anchor="middle">b</text></svg>',
  );

/** RainbowKit wallet entry backed by wagmi's mock connector (no extension needed). */
const demoWallet = (): Wallet => ({
  id: "demo",
  name: "Demo wallet",
  iconUrl: DEMO_ICON,
  iconBackground: "#00b171",
  installed: true,
  createConnector: (walletDetails) =>
    createConnector((config) => {
      const base = mock({ accounts: [DEMO_ACCOUNT], features: { reconnect: true } })(config);
      return {
        ...base,
        ...walletDetails,
        // The mock connector forwards eth_accounts to the chain's RPC (it's
        // designed for a local test node); public RPCs reject that, so
        // answer it here. getAccounts still throws while disconnected.
        async getProvider(params) {
          const provider = await base.getProvider(params);
          return {
            ...provider,
            request: ((args: { method: string }) =>
              args.method === "eth_accounts"
                ? Promise.resolve([DEMO_ACCOUNT])
                : provider.request(args as never)) as typeof provider.request,
          };
        },
      };
    }),
});

/**
 * WalletConnect (mobile wallets / QR codes) needs a free project ID from
 * https://cloud.reown.com. Without one, only browser-extension wallets,
 * Coinbase Wallet and the demo wallet are offered.
 */
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";
export const hasWalletConnect = projectId.length > 0;

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: hasWalletConnect
        ? [metaMaskWallet, rabbyWallet, coinbaseWallet, rainbowWallet, walletConnectWallet]
        : [injectedWallet, rabbyWallet, coinbaseWallet],
    },
    { groupName: "Testing", wallets: [demoWallet] },
  ],
  {
    appName: "Berkeleytime Markets",
    // connectorsForWallets requires a string; WalletConnect wallets are
    // excluded above when no real ID is configured.
    projectId: projectId || "missing-walletconnect-project-id",
  },
);

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors,
  transports: { [baseSepolia.id]: http() },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
