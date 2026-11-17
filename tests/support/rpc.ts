// A deterministic JSON-RPC fixture, not an EVM or deployed contract.
import { createServer } from 'node:http';
import { Interface, ZeroAddress, toQuantity } from 'ethers';
import { MARKET_ABI, COLLATERAL_ABI } from '../../src/lib/protocol/contracts';
import { sharesForAmount, proceedsForShares } from '../../src/lib/lmsr';
export const MARKET = '0x1111111111111111111111111111111111111111';
export const CREATOR = '0x2222222222222222222222222222222222222222';
export const TRADER = '0x3333333333333333333333333333333333333333';
export const TOKEN = '0x4444444444444444444444444444444444444444';
const marketABI = new Interface(MARKET_ABI), tokenABI = new Interface(COLLATERAL_ABI);
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}`;
const hex = (n: bigint | number) => toQuantity(n);
type RpcRequest = { id?: number; method: string; params?: unknown[] };
type WireLog = { address: string; topics: string[]; data: string; blockHash: string; blockNumber: string; transactionHash: string; transactionIndex: string; logIndex: string; removed: boolean };

export class RpcFixture {
  head = 100;
  chainId = 11155111;
  contractExists = true;
  close = Math.floor(Date.now() / 1000) + 3600;
  funded = false;
  resolved = false;
  result = false;
  y = BigInt(0);
  n = BigInt(0);
  cash = BigInt(0);
  balances = new Map([[CREATOR, BigInt(1000e6)], [TRADER, BigInt(1000e6)]]);
  holdings = new Map<string, bigint>();
  allowances = new Map<string, bigint>();
  lastFaucet = new Map<string, bigint>();
  logs: WireLog[] = [];
  writes: { method: string; args: readonly unknown[]; from: string }[] = [];
  transactions = new Map<string, Record<string, unknown>>();
  receipts = new Map<string, Record<string, unknown>>();
  failReads = false;
  block(height: number) {
    return { hash: hash(height), parentHash: hash(height - 1), number: hex(height), timestamp: hex(Math.floor(Date.now() / 1000)), nonce: '0x0000000000000000', difficulty: '0x0', gasLimit: '0x1c9c380', gasUsed: '0x0', miner: ZeroAddress, extraData: '0x', transactions: [], baseFeePerGas: '0x1' };
  }
  private holding(account: string, yes: boolean) { return this.holdings.get(`${account}:${yes}`) ?? BigInt(0); }
  private emit(name: string, args: unknown[], txHash: string) {
    const e = marketABI.encodeEventLog(marketABI.getEvent(name)!, args);
    this.logs.push({ address: MARKET, topics: e.topics, data: e.data, blockHash: hash(this.head), blockNumber: hex(this.head), transactionHash: txHash, transactionIndex: '0x0', logIndex: '0x0', removed: false });
  }
  private read(to: string, data: string) {
    const abi = to === TOKEN ? tokenABI : marketABI;
    const call = abi.parseTransaction({ data })!;
    const a = call.args;
    let value: unknown;
    if (to === TOKEN) {
      switch (call.name) {
        case 'balanceOf': value = a[0].toLowerCase() === MARKET ? this.cash : this.balances.get(a[0].toLowerCase()) ?? BigInt(0); break;
        case 'allowance': value = this.allowances.get(a[0].toLowerCase()) ?? BigInt(0); break;
        case 'FAUCET_AMOUNT': value = BigInt(1000e6); break;
        case 'FAUCET_COOLDOWN': value = BigInt(86400); break;
        case 'lastFaucetAt': value = this.lastFaucet.get(a[0].toLowerCase()) ?? BigInt(0); break;
        default: throw new Error(`Unexpected token read ${call.name}`);
      }
    } else {
      const getters: Record<string, unknown> = { collateral: TOKEN, creator: CREATOR, closesAt: this.close, question: 'Will the course GPA exceed 3.3?', funded: this.funded, resolved: this.resolved, result: this.result, qYes: this.y, qNo: this.n, B: BigInt(100) * BigInt(10) ** BigInt(18), SUBSIDY: BigInt(69314719) };
      if (call.name === 'shares') value = this.holding(a[0].toLowerCase(), a[1]);
      else if (call.name === 'quoteBuy') value = BigInt(Math.floor(sharesForAmount(a[0] ? 'yes' : 'no', Number(a[1]) / 1e6, Number(this.y) / 1e6, Number(this.n) / 1e6, 100) * 1e6) - 1);
      else if (call.name === 'quoteSell') value = BigInt(Math.floor(proceedsForShares(a[0] ? 'yes' : 'no', Number(a[1]) / 1e6, Number(this.y) / 1e6, Number(this.n) / 1e6, 100) * 1e6));
      else value = getters[call.name];
    }
    return abi.encodeFunctionResult(call.fragment, [value]);
  }
  private send(tx: { to: string; from: string; data: string }) {
    const to = tx.to.toLowerCase(), from = tx.from.toLowerCase();
    const abi = to === TOKEN ? tokenABI : marketABI;
    const call = abi.parseTransaction({ data: tx.data })!, a = call.args;
    this.writes.push({ method: call.name, args: [...a], from });
    const txHash = hash(++this.head + 10000);
    const balance = this.balances.get(from) ?? BigInt(0);
    switch (call.name) {
      case 'approve': this.allowances.set(from, a[1]); break;
      case 'fund': this.funded = true; this.cash += BigInt(69314719); this.balances.set(from, balance - BigInt(69314719)); break;
      case 'buy': {
        const q = marketABI.decodeFunctionResult('quoteBuy', this.read(MARKET, marketABI.encodeFunctionData('quoteBuy', [a[0], a[1]])))[0] as bigint;
        if (q < a[2]) throw new Error('Price moved');
        if (a[0]) this.y += q; else this.n += q;
        this.cash += a[1]; this.balances.set(from, balance - a[1]);
        this.holdings.set(`${from}:${a[0]}`, this.holding(from, a[0]) + q);
        this.emit('Traded', [from, a[0], true, q, a[1]], txHash); break;
      }
      case 'sell': {
        const amount = marketABI.decodeFunctionResult('quoteSell', this.read(MARKET, marketABI.encodeFunctionData('quoteSell', [a[0], a[1]])))[0] as bigint;
        if (amount < a[2]) throw new Error('Price moved');
        if (a[0]) this.y -= a[1]; else this.n -= a[1];
        this.cash -= amount; this.balances.set(from, balance + amount);
        this.holdings.set(`${from}:${a[0]}`, this.holding(from, a[0]) - a[1]);
        this.emit('Traded', [from, a[0], false, a[1], amount], txHash); break;
      }
      case 'resolve': this.resolved = true; this.result = a[0]; this.emit('Resolved', [a[0]], txHash); break;
      case 'redeem': {
        const q = this.holding(from, a[0]), amount = this.result === a[0] ? q : BigInt(0);
        this.holdings.set(`${from}:${a[0]}`, BigInt(0));
        if (a[0]) this.y -= q; else this.n -= q;
        this.cash -= amount; this.balances.set(from, balance + amount);
        this.emit('Redeemed', [from, a[0], q, amount], txHash); break;
      }
      case 'withdrawSurplus': {
        const amount = this.cash - (this.result ? this.y : this.n);
        this.cash -= amount; this.balances.set(from, balance + amount); break;
      }
      case 'faucet': this.balances.set(from, balance + BigInt(1000e6)); this.lastFaucet.set(from, BigInt(Math.floor(Date.now() / 1000))); break;
      default: throw new Error(`Unexpected write ${call.name}`);
    }
    this.transactions.set(txHash, { hash: txHash, from, to, nonce: '0x0', value: '0x0', input: tx.data, gas: '0x2dc6c0', gasPrice: '0x1', blockHash: hash(this.head), blockNumber: hex(this.head), transactionIndex: '0x0', chainId: '0xaa36a7', v: '0x1b', r: hash(1), s: hash(1), type: '0x0' });
    this.receipts.set(txHash, { transactionHash: txHash, blockHash: hash(this.head), blockNumber: hex(this.head), transactionIndex: '0x0', from, to, contractAddress: null, gasUsed: '0x186a0', cumulativeGasUsed: '0x186a0', effectiveGasPrice: '0x1', logsBloom: `0x${'0'.repeat(512)}`, status: '0x1', type: '0x0', logs: this.logs.filter(l => l.transactionHash === txHash) });
    return txHash;
  }
  handle(request: RpcRequest): unknown {
    const p = request.params ?? [];
    try {
      if (this.failReads && ['eth_call', 'eth_getLogs'].includes(request.method)) throw new Error('Fixture RPC unavailable');
      let result: unknown;
      switch (request.method) {
        case 'eth_chainId': result = hex(this.chainId); break;
        case 'eth_accounts': case 'eth_requestAccounts': result = [CREATOR]; break;
        case 'wallet_requestPermissions': result = [{ parentCapability: 'eth_accounts' }]; break;
        case 'eth_getBalance': result = '0xde0b6b3a7640000'; break;
        case 'eth_blockNumber': result = hex(this.head); break;
        case 'eth_getCode': result = this.contractExists ? '0x6000' : '0x'; break;
        case 'eth_getBlockByNumber': result = this.block(p[0] === 'latest' ? this.head : Number(p[0])); break;
        case 'eth_call': { const tx = p[0] as { to: string; data: string }; result = this.read(tx.to.toLowerCase(), tx.data); break; }
        case 'eth_getLogs': {
          const filter = p[0] as { fromBlock: string; toBlock: string; topics: (string | string[])[] };
          const topics = [filter.topics[0]].flat();
          result = this.logs.filter(l => Number(l.blockNumber) >= Number(filter.fromBlock) && Number(l.blockNumber) <= Number(filter.toBlock) && topics.includes(l.topics[0])); break;
        }
        case 'eth_sendTransaction': result = this.send(p[0] as { to: string; from: string; data: string }); break;
        case 'eth_getTransactionByHash': result = this.transactions.get(String(p[0])) ?? null; break;
        case 'eth_getTransactionReceipt': result = this.receipts.get(String(p[0])) ?? null; break;
        case 'eth_estimateGas': result = '0x2dc6c0'; break;
        case 'eth_getTransactionCount': result = '0x0'; break;
        case 'eth_gasPrice': case 'eth_maxPriorityFeePerGas': result = '0x1'; break;
        default: throw new Error(`Unsupported RPC ${request.method}`);
      }
      return { jsonrpc: '2.0', id: request.id, result };
    } catch (e) { return { jsonrpc: '2.0', id: request.id, error: { code: -32000, message: e instanceof Error ? e.message : String(e) } }; }
  }
}
export async function startRpc(fixture: RpcFixture, port = 0) {
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*'); res.setHeader('Access-Control-Allow-Headers', 'content-type');
    if (req.method === 'OPTIONS') { res.end(); return; }
    if (req.url === '/health') { res.end('ok'); return; }
    let body = ''; for await (const chunk of req) body += chunk;
    if (req.url === '/missing') { fixture.contractExists = false; res.end('{}'); return; }
    if (req.url === '/close') { fixture.close = Math.floor(Date.now() / 1000) - 1; res.end('{}'); return; }
    if (req.url === '/reset') { Object.assign(fixture, new RpcFixture()); res.end('{}'); return; }
    const json = JSON.parse(body);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(Array.isArray(json) ? json.map(r => fixture.handle(r)) : fixture.handle(json)));
  });
  await new Promise<void>(resolve => server.listen(port, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return { url: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }) };
}
