import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Interface, JsonRpcProvider } from 'ethers';
import { OnchainProtocol, tokenUnits } from '../src/lib/protocol/onchain';
import { MARKET_ABI, COLLATERAL_ABI } from '../src/lib/protocol/contracts';
import { CREATOR, MARKET, TRADER, RpcFixture, startRpc } from './support/rpc';
import type { Quote } from '../src/lib/protocol/types';
import { marketChain } from '../src/lib/protocol/config';
const limits = (q: Quote) => ({ minOutput: (BigInt(q.rawOutput!) * BigInt(99) / BigInt(100)).toString(), deadline: Math.floor(Date.now() / 1000) + 120 });

test('UI ABIs match the existing Solidity artifacts', () => {
  for (const [name, abi] of [['Market', MARKET_ABI], ['MockUSDC', COLLATERAL_ABI]] as const) {
    const compiled = new Interface(JSON.parse(readFileSync(`contracts/out/${name}.sol/${name}.json`, 'utf8')).abi);
    const ui = new Interface(abi);
    ui.forEachFunction(fn => {
      const actual = compiled.getFunction(fn.format('sighash'))!;
      assert.ok(actual); assert.deepEqual(fn.outputs.map(o => o.type), actual.outputs.map(o => o.type));
    });
    ui.forEachEvent(event => assert.equal(compiled.getEvent(event.format('sighash'))!.topicHash, event.topicHash));
  }
});

test('adapter funds, approves, buys, sells, resolves, redeems and withdraws through the contract ABI', async t => {
  const fixture = new RpcFixture(), rpc = await startRpc(fixture);
  const provider = new JsonRpcProvider(rpc.url, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  t.after(async () => { provider.destroy(); await rpc.close(); });
  const p = new OnchainProtocol({ rpcUrl: rpc.url, marketAddress: MARKET, startBlock: 100 }, provider);
  await p.refresh();
  assert.equal(p.getState().error, undefined);
  const signer = await provider.getSigner(CREATOR);
  p.setWallet(signer, CREATOR, 11155111); await p.refresh(); await p.refresh();
  assert.equal(p.getState().events[MARKET].funded, false);
  await p.fund(CREATOR);
  assert.deepEqual(fixture.writes.slice(0, 2).map(w => w.method), ['approve', 'fund']);
  assert.equal(fixture.writes[0].args[1], BigInt(69314719));
  assert.equal(p.getState().events[MARKET].funded, true);
  const quote = await p.quoteBuy(MARKET, 'yes', 'yes', 10);
  const expectedLimits = limits(quote);
  const trade = await p.buy(CREATOR, MARKET, 'yes', 'yes', 10, expectedLimits);
  assert.equal(trade.shares, quote.shares);
  assert.equal(fixture.writes.at(-1)!.args[2], BigInt(expectedLimits.minOutput));
  assert.equal(p.getState().trades.length, 1);
  await p.refresh(); assert.equal(p.getState().trades.length, 1, 'refresh must not duplicate trades');
  const sale = await p.quoteSell(MARKET, 'yes', 'yes', 1);
  await p.sell(CREATOR, MARKET, 'yes', 'yes', 1, limits(sale));
  assert.equal(p.getState().positions[CREATOR][0].shares, quote.shares - 1);
  fixture.close = Math.floor(Date.now() / 1000) - 1;
  await p.refresh(); assert.equal(p.getState().events[MARKET].status, 'closed');
  await p.resolve(CREATOR, true);
  assert.equal(p.getState().events[MARKET].outcomes[0].result, 'yes');
  await p.redeem(CREATOR, 'yes');
  assert.equal(p.getState().positions[CREATOR].length, 0);
  await p.withdrawSurplus(CREATOR);
  assert.equal(p.getState().events[MARKET].surplus, 0);
  assert.ok(Math.abs(p.getState().balances[CREATOR] - 1000) < .000001);
});

test('wrong network, expired quotes and account changes are handled without unwanted writes', async t => {
  const fixture = new RpcFixture(), rpc = await startRpc(fixture);
  const provider = new JsonRpcProvider(rpc.url, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  t.after(async () => { provider.destroy(); await rpc.close(); });
  const p = new OnchainProtocol({ rpcUrl: rpc.url, marketAddress: MARKET, startBlock: 100 }, provider);
  await p.refresh();
  p.setWallet(await provider.getSigner(CREATOR), CREATOR, 84532); await p.refresh(); await p.refresh();
  await assert.rejects(p.fund(CREATOR), /Ethereum Sepolia/); assert.equal(fixture.writes.length, 0);
  await assert.rejects(p.buy(CREATOR, MARKET, 'yes', 'yes', 10, { minOutput: '1', deadline: 1 }), /fresh quote/);
  p.setWallet(undefined, TRADER, 11155111);
  assert.equal(p.getState().balances[CREATOR], undefined);
  await p.refresh(); await p.refresh();
  assert.equal(p.getState().balances[TRADER], 1000);
  fixture.failReads = true;
  await p.refresh(); assert.ok(p.getState().error); assert.equal(p.getState().loading, false);
});

test('invalid on-chain configuration never substitutes demo markets', async () => {
  const p = new OnchainProtocol({ rpcUrl: 'http://127.0.0.1:1', marketAddress: '', startBlock: NaN });
  await p.refresh(); assert.match(p.getState().error!, /Market contract address/); assert.deepEqual(p.getState().events, {});
  assert.equal(tokenUnits(.100001), BigInt(100001)); assert.throws(() => tokenUnits(NaN));
});

test('Ethereum Sepolia is required for contract reads', async t => {
  assert.equal(marketChain.id, 11155111);
  const fixture = new RpcFixture();
  fixture.chainId = 84532; // Base Sepolia must be rejected, even though it is also a testnet.
  const rpc = await startRpc(fixture);
  const provider = new JsonRpcProvider(rpc.url, undefined, { cacheTimeout: -1, batchStallTime: 0 });
  t.after(async () => { provider.destroy(); await rpc.close(); });
  const p = new OnchainProtocol({ rpcUrl: rpc.url, marketAddress: MARKET, startBlock: 100 }, provider);
  await p.refresh();
  assert.match(p.getState().error!, /RPC must connect to Ethereum Sepolia/);
  assert.deepEqual(p.getState().events, {});
  assert.equal(fixture.writes.length, 0);
});
