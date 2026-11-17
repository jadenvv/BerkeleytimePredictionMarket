import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3100', timezoneId: 'UTC', trace: 'retain-on-failure', actionTimeout: 10_000 },
  webServer: [
    { command: 'node --import tsx tests/support/server.ts', url: 'http://127.0.0.1:3101/health' },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3100',
      url: 'http://127.0.0.1:3100', timeout: 120_000,
      env: {
        PLAYWRIGHT_TEST: '1',
        NEXT_PUBLIC_MARKET_ADDRESS: '0x1111111111111111111111111111111111111111',
        NEXT_PUBLIC_MARKET_START_BLOCK: '100',
        NEXT_PUBLIC_RPC_URL: 'http://127.0.0.1:3101',
        NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: '',
      },
    },
  ],
});
