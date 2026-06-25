import { defineConfig, devices } from '@playwright/test';

// Base URL for smoke tests. Set SMOKE_URL in the environment, or pass
// --url <url> via the `test:smoke` npm script (which maps it to this var).
// Example: npm run test:smoke -- --url https://preview-abc.azurestaticapps.net
const baseURL = process.env.SMOKE_URL || 'http://localhost:3000';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/smoke.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'html',

  // No webServer block — smoke tests run against an already-deployed URL.
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Give the deployed app extra time to respond.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'smoke-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
