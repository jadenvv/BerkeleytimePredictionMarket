import { expect, test } from '@playwright/test';

test('existing market lifecycle through the connected wallet UI', async ({ page, request }) => {
  await request.post('http://127.0.0.1:3101/reset');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  // An injected EIP-1193 wallet backed by canned RPC responses. Nothing is deployed.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'ethereum', { value: {
      isMetaMask: true,
      on() {}, removeListener() {},
      async request({ method, params }: { method: string; params?: unknown[] }) {
        if (method === 'eth_accounts' && !sessionStorage.getItem('fixture-authorized')) return [];
        if (method === 'eth_requestAccounts') sessionStorage.setItem('fixture-authorized', '1');
        const response = await fetch('http://127.0.0.1:3101', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params ?? [] }),
        });
        const data = await response.json();
        if (data.error) throw Object.assign(new Error(data.error.message), { code: data.error.code });
        return data.result;
      },
    } });
  });
  await page.goto('/');
  await expect(page.getByText('Ethereum Sepolia · on-chain test USDC · creator-resolved market.')).toBeVisible();
  await page.getByText('Will the course GPA exceed 3.3?').click();
  await expect(page.getByRole('heading', { name: 'Market settlement' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet to trade' }).click();
  await expect(page.getByRole('button', { name: /Demo wallet/ })).toHaveCount(0);
  await page.getByRole('button', { name: /Browser Wallet|MetaMask/ }).first().click();
  const fund = page.getByRole('button', { name: /Fund market/ });
  await expect(fund).toBeEnabled();
  await fund.click();
  await expect(fund).toHaveCount(0);
  await page.getByLabel('Amount', { exact: true }).fill('10');
  const buy = page.getByRole('button', { name: 'Buy Yes', exact: true });
  await expect(buy).toBeEnabled();
  await buy.click();
  await expect(page.getByText(/Bought .* YES/)).toBeVisible();
  await page.getByRole('button', { name: 'sell', exact: true }).click();
  await page.getByLabel('Shares', { exact: true }).fill('1');
  const sell = page.getByRole('button', { name: 'Sell Yes', exact: true });
  await expect(sell).toBeEnabled();
  await sell.click();
  await expect(page.getByText(/Sold .* YES/)).toBeVisible();
  await request.post('http://127.0.0.1:3101/close');
  await page.reload();
  await page.getByRole('button', { name: 'Resolve YES', exact: true }).click();
  await expect(page.getByText('Resolved YES', { exact: true })).toBeVisible();
  const redeem = page.getByRole('button', { name: /Redeem \$/ });
  await redeem.click();
  await expect(redeem).toHaveCount(0);
  const surplus = page.getByRole('button', { name: /Withdraw surplus/ });
  await surplus.click();
  await expect(surplus).toBeDisabled();
  await page.getByRole('link', { name: 'Portfolio', exact: true }).click();
  await expect(page.getByText('$1,000.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/No open positions/)).toBeVisible();
  expect(errors).toEqual([]);
});

test('unavailable contracts do not restore saved demo markets or balances', async ({ page, request }) => {
  await request.post('http://127.0.0.1:3101/reset');
  await request.post('http://127.0.0.1:3101/missing');
  await page.addInitScript(() => {
    localStorage.setItem('btm:state:v1', JSON.stringify({
      events: { legacy: { id: 'legacy', title: 'Legacy simulated market' } },
      balances: { '0x2222222222222222222222222222222222222222': 9999 },
      positions: {}, trades: [],
    }));
    localStorage.setItem('btm:demo-connected', '1');
  });
  await page.goto('/');
  await expect(page.getByText(/No contract exists at the configured Market address/)).toBeVisible();
  await expect(page.locator('a[href^="/markets/"]')).toHaveCount(0);
  await expect(page.getByText('Legacy simulated market')).toHaveCount(0);
  expect(await page.evaluate(() => [localStorage.getItem('btm:state:v1'), localStorage.getItem('btm:demo-connected')])).toEqual([null, null]);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(page.getByRole('button', { name: /Demo wallet/ })).toHaveCount(0);
});
