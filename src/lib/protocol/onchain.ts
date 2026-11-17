import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, parseUnits, type Log, type Signer, type TransactionReceipt, type TransactionResponse } from 'ethers';
import { priceYes } from '../lmsr';
import type { MarketEvent, Position, Side, Trade } from '../types';
import { COLLATERAL_ABI, MARKET_ABI } from './contracts';
import { marketChain } from './config';
import type { Address, Protocol, ProtocolState, Quote, TradeLimits } from './types';

export interface ChainConfig { rpcUrl: string; marketAddress: string; startBlock: number; }
const EMPTY: ProtocolState = { events: {}, balances: {}, positions: {}, trades: [], loading: true };
const lower = (value: string) => value.toLowerCase() as Address;
const numeric = (value: bigint, decimals = 6) => Number(formatUnits(value, decimals));
export function tokenUnits(value: number) {
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000) throw new Error('Invalid amount.');
  return parseUnits(value.toFixed(6), 6);
}
export function transactionError(error: unknown) {
  const e = error as { code?: string; reason?: string; shortMessage?: string; message?: string };
  return e.code === 'ACTION_REJECTED' ? 'Transaction cancelled in your wallet.' : e.reason ?? e.shortMessage ?? e.message ?? String(error);
}

/** One existing Market contract, read from Ethereum Sepolia. This adapter never deploys. */
export class OnchainProtocol implements Protocol {
  private state = EMPTY;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setInterval>;
  private refreshTask?: Promise<void>;
  private signer?: Signer;
  private account?: Address;
  private chainId?: number;
  private generation = 0;
  private market: Contract;
  private collateral?: Contract;
  private provider: JsonRpcProvider;
  readonly id: Address;

  constructor(private config: ChainConfig, provider?: JsonRpcProvider) {
    this.provider = provider ?? new JsonRpcProvider(config.rpcUrl, undefined, { cacheTimeout: -1 });
    this.id = lower(/^0x[\da-f]{40}$/i.test(config.marketAddress) ? config.marketAddress : ZeroAddress);
    this.market = new Contract(this.id, MARKET_ABI, this.provider);
  }
  getState = () => this.state;
  getServerState = () => EMPTY;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.timer) { void this.refresh(); this.timer = setInterval(() => void this.refresh(), 12_000); }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size && this.timer) { clearInterval(this.timer); this.timer = undefined; }
    };
  };
  private commit(state: ProtocolState) { this.state = state; this.listeners.forEach(l => l()); }
  setWallet(signer: Signer | undefined, account: Address | undefined, chainId: number | undefined) {
    this.signer = signer; this.chainId = chainId;
    const next = account ? lower(account) : undefined;
    if (next !== this.account) {
      this.account = next; this.generation++;
      this.commit({ ...this.state, balances: {}, positions: {}, loading: true });
      void this.refresh().then(() => this.refresh());
    }
  }
  async refresh() {
    if (this.refreshTask) return this.refreshTask;
    this.refreshTask = this.readState().catch(e => {
      this.commit({ ...this.state, loading: false, error: transactionError(e) });
    }).finally(() => { this.refreshTask = undefined; });
    return this.refreshTask;
  }
  private async logs(head: number): Promise<Log[]> {
    const topics = ['Traded', 'Redeemed'].map(name => this.market.interface.getEvent(name)!.topicHash);
    const logs: Log[] = [];
    // Replaying canonical logs avoids duplicates and drops logs removed by a reorganization.
    for (let from = this.config.startBlock; from <= head; from += 2000) {
      logs.push(...await this.provider.getLogs({ address: this.id, topics: [topics], fromBlock: from, toBlock: Math.min(head, from + 1999) }));
    }
    return logs.sort((a, b) => a.blockNumber - b.blockNumber || a.index - b.index);
  }
  private async readState() {
    if (this.id === ZeroAddress || !Number.isSafeInteger(this.config.startBlock) || this.config.startBlock < 0) throw new Error('Set a Market contract address and its deployment block on Ethereum Sepolia.');
    if ((await this.provider.getNetwork()).chainId !== BigInt(marketChain.id)) throw new Error('The RPC must connect to Ethereum Sepolia.');
    const head = await this.provider.getBlockNumber();
    if (head < this.config.startBlock) throw new Error('The configured deployment block is ahead of the chain.');
    if (await this.provider.getCode(this.id, head) === '0x') throw new Error('No contract exists at the configured Market address.');
    const generation = this.generation, account = this.account, opts = { blockTag: head };
    const [block, tokenAddress, creator, close, question, funded, resolved, result, qYes, qNo, liquidity, subsidy] = await Promise.all([
      this.provider.getBlock(head), this.market.collateral(opts), this.market.creator(opts), this.market.closesAt(opts), this.market.question(opts), this.market.funded(opts), this.market.resolved(opts), this.market.result(opts), this.market.qYes(opts), this.market.qNo(opts), this.market.B(opts), this.market.SUBSIDY(opts),
    ]);
    if (!block) throw new Error('Latest block unavailable.');
    const token = this.collateral = new Contract(tokenAddress, COLLATERAL_ABI, this.provider);
    const timestamps = new Map<number, number>([[head, block.timestamp * 1000]]);
    const time = async (height: number) => {
      if (!timestamps.has(height)) {
        const block = await this.provider.getBlock(height);
        if (!block) throw new Error('Trade block unavailable.');
        timestamps.set(height, block.timestamp * 1000);
      }
      return timestamps.get(height)!;
    };
    const createdAt = await time(this.config.startBlock);
    const history = [{ t: createdAt, p: .5 }], trades: Trade[] = [];
    const costs = { yes: 0, no: 0 }, quantities = { yes: 0, no: 0 };
    let y = BigInt(0), n = BigInt(0);
    for (const log of await this.logs(head)) {
      const parsed = this.market.interface.parseLog(log)!;
      const a = parsed.args, yes = Boolean(a.yes), side: Side = yes ? 'yes' : 'no';
      const quantity = numeric(a.quantity), amount = numeric(a.amount);
      if (parsed.name === 'Redeemed') {
        if (yes) y -= a.quantity; else n -= a.quantity;
        if (account === lower(a.account)) { costs[side] = 0; quantities[side] = 0; }
        continue;
      }
      const sign = a.buy ? BigInt(1) : BigInt(-1);
      if (yes) y += sign * a.quantity; else n += sign * a.quantity;
      const t = await time(log.blockNumber);
      history.push({ t, p: priceYes(numeric(y), numeric(n), numeric(liquidity, 18)) });
      trades.push({ id: `${log.transactionHash}:${log.index}`, account: lower(a.account), eventId: this.id, outcomeId: 'yes', side, action: a.buy ? 'buy' : 'sell', shares: quantity, amount, price: amount / quantity, t, txHash: log.transactionHash as Address });
      if (account === lower(a.account)) {
        if (a.buy) { quantities[side] += quantity; costs[side] += amount; }
        else { costs[side] *= Math.max(0, quantities[side] - quantity) / (quantities[side] || 1); quantities[side] = Math.max(0, quantities[side] - quantity); }
      }
    }
    if (y !== qYes || n !== qNo) throw new Error('Trade history does not match the contract. Check the deployment block, then refresh.');
    const [cash, balance, heldYes, heldNo] = await Promise.all([
      token.balanceOf(this.id, opts), account ? token.balanceOf(account, opts) : BigInt(0), account ? this.market.shares(account, true, opts) : BigInt(0), account ? this.market.shares(account, false, opts) : BigInt(0),
    ]);
    let canFaucet = false, faucetAvailableAt = 0;
    try {
      canFaucet = await token.FAUCET_AMOUNT(opts) === BigInt(1_000_000000);
      if (account) { const last = await token.lastFaucetAt(account, opts); faucetAvailableAt = last === BigInt(0) ? 0 : Number(last + await token.FAUCET_COOLDOWN(opts)) * 1000; }
    } catch { canFaucet = false; /* A standard USDC token may not have a test faucet. */ }
    const ev: MarketEvent = {
      id: this.id, contractAddress: this.id, title: question, category: 'Campus', creator: lower(creator), createdAt,
      closesAt: Number(close) * 1000, resolvesAt: Number(close) * 1000, status: resolved ? 'resolved' : block.timestamp >= Number(close) ? 'closed' : 'open',
      funded, subsidy: numeric(subsidy), surplus: resolved ? numeric(BigInt(cash) - BigInt(result ? qYes : qNo)) : 0,
      source: 'Market creator', rules: 'The creator decides YES or NO after trading closes. Winning shares pay 1 USDC each. The decision is final.',
      outcomes: [{ id: 'yes', label: 'Yes', qYes: numeric(qYes), qNo: numeric(qNo), b: numeric(liquidity, 18), volume: trades.reduce((s, t) => s + t.amount, 0), history, result: resolved ? result ? 'yes' : 'no' : undefined }],
    };
    const positions: Position[] = ([['yes', heldYes], ['no', heldNo]] as const).filter(([, held]) => held > BigInt(0)).map(([side, held]) => ({ eventId: this.id, outcomeId: 'yes', side, shares: numeric(held), cost: costs[side] }));
    if ((await this.provider.getBlock(head))?.hash !== block.hash) throw new Error('Chain changed during refresh. Please retry.');
    if (generation !== this.generation) return;
    this.commit({ events: { [this.id]: ev }, balances: account ? { [account]: numeric(balance) } : {}, positions: account ? { [account]: positions } : {}, trades: trades.reverse(), loading: false, canFaucet, faucetAvailableAt });
  }
  private checkMarket(id: string) {
    if (lower(id) !== this.id || !this.state.events[this.id]) throw new Error('Market is not loaded.');
  }
  private async wallet(account: Address) {
    const signer = this.signer;
    if (!signer || this.chainId !== marketChain.id || lower(await signer.getAddress()) !== lower(account) || (await signer.provider?.getNetwork())?.chainId !== BigInt(marketChain.id)) throw new Error('Connect a wallet on Ethereum Sepolia.');
    if (signer !== this.signer) throw new Error('Wallet changed. Please try again.');
    return signer;
  }
  private async confirm(tx: TransactionResponse): Promise<TransactionReceipt> {
    let receipt;
    try { receipt = await tx.wait(1); }
    catch (e) {
      const replacement = e as { code?: string; cancelled?: boolean; receipt?: TransactionReceipt };
      if (replacement.code !== 'TRANSACTION_REPLACED' || replacement.cancelled) throw e;
      receipt = replacement.receipt;
    }
    if (!receipt || receipt.status !== 1) throw new Error('Transaction did not succeed.');
    return receipt;
  }
  private async approve(account: Address, amount: bigint) {
    if (!this.collateral) throw new Error('Collateral is not loaded.');
    const token = this.collateral.connect(await this.wallet(account)) as Contract;
    if (await token.allowance(account, this.id) < amount) await this.confirm(await token.approve(this.id, amount));
  }
  private async afterTransaction() { await this.refresh(); await this.refresh(); }
  async quoteBuy(id: string, _outcome: string, side: Side, amount: number): Promise<Quote> {
    this.checkMarket(id);
    const raw = await this.market.quoteBuy(side === 'yes', tokenUnits(amount)) as bigint;
    const [feeRaw, feeBps] = await Promise.all([this.market.calculateFee(tokenUnits(amount)), this.market.fee()]);
    const total = numeric(tokenUnits(amount) + BigInt(feeRaw));
    const shares = numeric(raw), o = this.state.events[this.id].outcomes[0];
    return { shares, amount: total, fee: numeric(feeRaw), feeBps: Number(feeBps), avgPrice: total / shares, payout: shares, newPriceYes: priceYes(o.qYes + (side === 'yes' ? shares : 0), o.qNo + (side === 'no' ? shares : 0), o.b), rawOutput: raw.toString() };
  }
  async quoteSell(id: string, _outcome: string, side: Side, quantity: number): Promise<Quote> {
    this.checkMarket(id);
    const raw = await this.market.quoteSell(side === 'yes', tokenUnits(quantity)) as bigint;
    const [feeRaw, feeBps] = await Promise.all([this.market.calculateFee(raw), this.market.fee()]);
    const net = raw - BigInt(feeRaw);
    const amount = numeric(net), shares = numeric(tokenUnits(quantity)), o = this.state.events[this.id].outcomes[0];
    return { shares, amount, fee: numeric(feeRaw), feeBps: Number(feeBps), avgPrice: amount / shares, payout: 0, newPriceYes: priceYes(o.qYes - (side === 'yes' ? shares : 0), o.qNo - (side === 'no' ? shares : 0), o.b), rawOutput: net.toString() };
  }
  private async trade(account: Address, id: string, side: Side, value: number, limits: TradeLimits | undefined, buy: boolean) {
    this.checkMarket(id);
    if (!limits || limits.deadline <= Date.now() / 1000 || !/^\d+$/.test(limits.minOutput)) throw new Error('Get a fresh quote before trading.');
    if (buy) {
      const amount = tokenUnits(value);
      await this.approve(account, amount + BigInt(await this.market.calculateFee(amount)));
    }
    const contract = this.market.connect(await this.wallet(account)) as Contract;
    const receipt = await this.confirm(await contract[buy ? 'buy' : 'sell'](side === 'yes', tokenUnits(value), BigInt(limits.minOutput), limits.deadline));
    const log = receipt.logs.find(l => lower(l.address) === this.id && l.topics[0] === this.market.interface.getEvent('Traded')!.topicHash)!;
    const a = this.market.interface.parseLog(log)!.args;
    await this.afterTransaction();
    return { id: `${receipt.hash}:${log.index}`, eventId: this.id, outcomeId: 'yes', account: lower(account), side, action: buy ? 'buy' as const : 'sell' as const, shares: numeric(a.quantity), amount: numeric(a.amount), price: numeric(a.amount) / numeric(a.quantity), t: Date.now(), txHash: receipt.hash as Address };
  }
  buy(account: Address, id: string, _outcome: string, side: Side, amount: number, limits?: TradeLimits) { return this.trade(account, id, side, amount, limits, true); }
  sell(account: Address, id: string, _outcome: string, side: Side, shares: number, limits?: TradeLimits) { return this.trade(account, id, side, shares, limits, false); }
  async faucet(account: Address) {
    if (!this.collateral || !this.state.canFaucet) throw new Error('This collateral has no test faucet.');
    const token = this.collateral.connect(await this.wallet(account)) as Contract;
    await this.confirm(await token.faucet()); await this.afterTransaction();
  }
  private async write(account: Address, method: string, args: unknown[] = []) {
    const market = this.market.connect(await this.wallet(account)) as Contract;
    await this.confirm(await market[method](...args)); await this.afterTransaction();
  }
  async fund(account: Address) { await this.approve(account, await this.market.SUBSIDY()); await this.write(account, 'fund'); }
  resolve(account: Address, yes: boolean) { return this.write(account, 'resolve', [yes]); }
  redeem(account: Address, side: Side) { return this.write(account, 'redeem', [side === 'yes']); }
  withdrawSurplus(account: Address) { return this.write(account, 'withdrawSurplus'); }
}
