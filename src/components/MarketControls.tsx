"use client";
import { marketChain } from "@/lib/protocol/config";
import { useState } from 'react';
import { protocol, useAccount, useBalance, useNow, usePositions, useProtocolState } from '@/lib/protocol';
import { OnchainProtocol, transactionError } from '@/lib/protocol/onchain';
import type { MarketEvent } from '@/lib/types';
import { usd } from '@/lib/format';

export function MarketControls({ ev }: { ev: MarketEvent }) {
  const { address, chainId } = useAccount();
  const balance = useBalance(address);
  const positions = usePositions(address).filter(p => p.eventId === ev.id);
  const { error: readError, loading } = useProtocolState();
  const now = useNow();
  const [result, setResult] = useState('yes');
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const chain = protocol instanceof OnchainProtocol ? protocol : undefined;
  if (!chain || !ev.contractAddress) return null;
  const creator = address === ev.creator;
  const closed = ev.status !== 'open' || now >= ev.closesAt;
  const disabled = !!pending || !!readError || !!loading || chainId !== marketChain.id;
  const button = 'rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white disabled:opacity-50';
  async function act(label: string, action: () => Promise<void>) {
    setPending(label); setError(''); setConfirmed(false);
    try { await action(); setConfirmed(true); }
    catch (e) { setError(transactionError(e)); }
    finally { setPending(''); }
  }
  return <section className="mt-8 rounded-xl border border-line p-4">
    <h2 className="text-lg font-bold">Market settlement</h2>
    <p className="mt-2 text-sm text-muted">The creator sets the final YES or NO result after closing. Winning shares pay 1 USDC each.</p>
    {!address && <p className="mt-3 text-sm">Connect your wallet to manage the market or redeem shares.</p>}
    {address && chainId !== marketChain.id && <p className="mt-3 text-sm text-down">Switch your wallet to Ethereum Sepolia.</p>}
    {!ev.funded && <div className="mt-3 text-sm">
      <p>{closed ? 'This market closed without funding.' : `Awaiting the creator’s ${ev.subsidy?.toFixed(6)} USDC liquidity deposit.`}</p>
      {creator && !closed && <button className={`${button} mt-3`} disabled={disabled || balance < (ev.subsidy ?? 0)} onClick={() => act('Approving and funding…', () => chain!.fund(address!))}>Fund market · {ev.subsidy?.toFixed(6)} USDC</button>}
      {creator && balance < (ev.subsidy ?? 0) && <p className="mt-2 text-xs text-muted">Get test USDC from your portfolio first.</p>}
    </div>}
    {creator && ev.funded && closed && ev.status !== 'resolved' && <div className="mt-4 space-y-3">
      <label className="text-sm">Final result<select className="ml-3 rounded border border-line p-2" value={result} onChange={e => setResult(e.target.value)} disabled={disabled}><option value="yes">YES</option><option value="no">NO</option></select></label>
      <p className="text-xs text-muted">This decision cannot be changed.</p>
      <button className={button} disabled={disabled} onClick={() => act('Resolving…', () => chain!.resolve(address!, result === 'yes'))}>Resolve {result.toUpperCase()}</button>
    </div>}
    {ev.status === 'resolved' && <div className="mt-4 space-y-3">
      <p className="font-semibold">Resolved {ev.outcomes[0].result?.toUpperCase()}</p>
      <div className="flex flex-wrap gap-2">{address && positions.map(p => <button key={p.side} className={button} disabled={disabled} onClick={() => act('Redeeming…', () => chain!.redeem(address, p.side))}>{ev.outcomes[0].result === p.side ? `Redeem ${usd(p.shares)}` : 'Clear losing shares'} · {p.side.toUpperCase()}</button>)}</div>
      {creator && <button className={button} disabled={disabled || !(ev.surplus && ev.surplus > 0)} onClick={() => act('Withdrawing…', () => chain!.withdrawSurplus(address!))}>Withdraw surplus · {usd(ev.surplus ?? 0)}</button>}
    </div>}
    {pending && <p role="status" className="mt-3 text-sm">{pending} Check your wallet for confirmation.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-down">{error}</p>}
    {confirmed && <p role="status" className="mt-3 text-sm text-yes">Transaction confirmed.</p>}
  </section>;
}
