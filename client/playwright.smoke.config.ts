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
  // Cap each test so a hung interaction fails fast instead of running until the
  // job timeout (a deployed app + create/share flow should finish well under this).
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // 'html' starts a blocking report server on CI (default open: 'on-failure'),
  // which hangs the runner indefinitely on a failed smoke test. Use the streaming
  // 'line' reporter in CI; keep 'html' for local debugging.
  reporter: process.env.CI ? 'line' : 'html',

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
