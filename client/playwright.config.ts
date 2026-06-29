import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Exclude suites that need their own server/URL and run separately:
  //  - smoke.spec.ts → a deployed URL, via `npm run test:smoke`.
  //  - responsive*.spec.ts → the live Aspire stack (real API), via
  //    `npm run test:responsive` / playwright.responsive.config.ts. They define
  //    their own viewport projects and would fail against this mocked dev server.
  testIgnore: ['**/smoke.spec.ts', '**/responsive*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  webServer: {
    command: 'npm start',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
