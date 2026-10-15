import { defineConfig, devices } from '@playwright/test';

const startServices = process.env.CI_E2E === '1';
const api = process.env.API_URL ?? 'http://127.0.0.1:4000';
const web = process.env.NEXT_PUBLIC_ADMIN_URL ?? 'http://127.0.0.1:3000';
const webPort = new URL(web).port || '3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  webServer: startServices ? [
    {
      command: 'pnpm --filter @maher/api start:prod',
      url: `${api}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `pnpm --filter @maher/web exec next start -p ${webPort}`,
      url: `${web}/en/login`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ] : undefined,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e/playwright-report' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  outputDir: 'e2e/test-results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
