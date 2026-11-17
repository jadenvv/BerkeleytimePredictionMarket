"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { formatEther } from "ethers";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useDisconnect } from "wagmi";
import { useEthersProvider } from "@/lib/ethers";
import { useAccount, useBalance, useProtocolState } from "@/lib/protocol";
import { shortAddress, usd } from "@/lib/format";

/** Native gas-token balance on the active chain, read through ethers.js. */
function useGasBalance(address?: string) {
  const provider = useEthersProvider();
  const [balance, setBalance] = useState<string | null>(null);
  useEffect(() => {
    if (!provider || !address) return;
    let cancelled = false;
    provider
      .getBalance(address)
      .then((wei) => !cancelled && setBalance(Number(formatEther(wei)).toFixed(4)))
      .catch(() => !cancelled && setBalance(null));
    return () => {
      cancelled = true;
    };
  }, [provider, address]);
  return address ? balance : null;
}

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openConnectModal, openChainModal, openAccountModal }) => {
        if (!mounted || !account || !chain) {
          return (
            <button
              onClick={openConnectModal}
              aria-hidden={!mounted}
              className={`rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark ${
                mounted ? "" : "pointer-events-none opacity-0"
              }`}
            >
              Connect wallet
            </button>
          );
        }
        if (chain.unsupported) {
          return (
            <button
              onClick={openChainModal}
              className="rounded-full bg-down px-4 py-2 text-sm font-semibold text-white"
            >
              Wrong network
            </button>
          );
        }
        return <Connected chainName={chain.name ?? "Ethereum Sepolia"} openAccountModal={openAccountModal} />;
      }}
    </ConnectButton.Custom>
  );
}

function Connected({
  chainName,
  openAccountModal,
}: {
  chainName: string;
  openAccountModal: () => void;
}) {
  const { address } = useAccount();
  const cash = useBalance(address);
  const { loading, error } = useProtocolState();
  const gas = useGasBalance(address);
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!address) return null;

  return (
    <div ref={ref} className="relative flex items-center gap-3">
      <Link href="/portfolio" className="hidden sm:block text-right leading-tight">
        <div className="text-[11px] text-muted">Cash</div>
        <div className="text-sm font-semibold tabular">{loading || error ? "—" : usd(cash)}</div>
      </Link>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-subtle"
      >
        <span
          className="h-5 w-5 rounded-full"
          style={{ background: `linear-gradient(135deg, #${address.slice(2, 8)}, #${address.slice(-6)})` }}
        />
        {shortAddress(address)}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-60 rounded-xl border border-line bg-white p-1 shadow-lg">
          <div className="px-3 py-2 text-xs text-muted">
            <div>{chainName}</div>
            <div className="mt-0.5 tabular text-foreground">
              Gas: {gas === null ? "—" : `${gas} ETH`}
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link
            href="/portfolio"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm hover:bg-subtle"
          >
            Portfolio
          </Link>
          <button
            onClick={() => {
              openAccountModal();
              setOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-subtle"
          >
            Wallet details
          </button>
          <button
            onClick={() => {
              disconnect();
              setOpen(false);
            }}
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-subtle"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
