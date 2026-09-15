import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  webServer: {
    command: 'GATE_SERVER_PORT=4322 node scripts/gate-server.mjs dist',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:4322',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /cross-browser\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      testIgnore: /cross-browser\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } },
    },
    {
      name: 'webkit',
      testMatch: /cross-browser\.spec\.ts/,
      timeout: 90_000,
      use: { ...devices['Desktop Safari'], navigationTimeout: 60_000 },
    },
    {
      name: 'firefox',
      testMatch: /cross-browser\.spec\.ts/,
      timeout: 90_000,
      use: { ...devices['Desktop Firefox'], navigationTimeout: 60_000 },
    },
  ],
});
