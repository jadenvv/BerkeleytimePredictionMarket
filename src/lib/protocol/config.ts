import { sepolia } from "viem/chains";

export const marketChain = sepolia;

export const chainConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
  marketAddress: process.env.NEXT_PUBLIC_MARKET_ADDRESS || "",
  startBlock: Number(process.env.NEXT_PUBLIC_MARKET_START_BLOCK || "NaN"),
};
