import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { chainConfig, marketChain } from "./protocol/config";

/**
 * WalletConnect (mobile wallets / QR codes) needs a free project ID from
 * https://cloud.reown.com. Without one, only browser-extension wallets
 * and Coinbase Wallet are offered.
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
  ],
  {
    appName: "Berkeleytime Markets",
    // connectorsForWallets requires a string; WalletConnect wallets are
    // excluded above when no real ID is configured.
    projectId: projectId || "missing-walletconnect-project-id",
  },
);

export const wagmiConfig = createConfig({
  chains: [marketChain],
  connectors,
  transports: { [marketChain.id]: http(chainConfig.rpcUrl) },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
