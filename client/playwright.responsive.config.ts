import { defineConfig, devices } from '@playwright/test';

// Cross-viewport responsive suite. Unlike the mocked desktop suite
// (playwright.config.ts) this runs against a LIVE Aspire stack — the real API +
// Cosmos + the in-browser GLPK solver — so there is NO webServer block and NO
// route mocking. Point it at the running client with RESPONSIVE_URL (Aspire
// assigns dynamic ports), e.g.
//   RESPONSIVE_URL=http://localhost:43933 npm run test:responsive
const baseURL = process.env.RESPONSIVE_URL ?? 'http://localhost:43933';

export default defineConfig({
  testDir: './tests',
  // Only the responsive specs — the mocked e2e/smoke/a11y suites run separately.
  testMatch: ['**/responsive.spec.ts', '**/responsive-a11y.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers: enough to move through seven viewports without hammering the
  // single dev machine that is also hosting the live stack + solver.
  workers: 2,
  // The real solver/graph build (GLPK wasm in a worker) is much slower than the
  // mocked suite, so mirror the smoke config's generous budgets.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'line' : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },

  // One project per target viewport. Phones/tablets carry isMobile + hasTouch so
  // the app's useMediaQuery / touch-pan branches fire the way a real device would.
  projects: [
    {
      name: 'desktop-fhd',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
    {
      name: 'laptop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 768 } },
    },
    {
      name: 'tablet-portrait',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1024, height: 768 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'mobile-portrait',
      // Pixel 5 carries the right UA/DPR/touch profile; pin the exact 390×844
      // portrait box the task specifies.
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
    {
      name: 'mobile-landscape',
      use: { ...devices['Pixel 5'], viewport: { width: 844, height: 390 } },
    },
    {
      name: 'small-phone',
      use: { ...devices['Pixel 5'], viewport: { width: 360, height: 640 } },
    },
  ],
});
