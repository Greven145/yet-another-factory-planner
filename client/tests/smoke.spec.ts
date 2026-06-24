/**
 * Smoke tests for the deployed Yet Another Factory Planner app.
 *
 * These tests run against an already-deployed URL (no local dev server).
 * They exercise the live API — no route mocking — so both the client and the
 * backend /share-factory + /initialize endpoints must be reachable.
 *
 * URL configuration
 * -----------------
 * Set SMOKE_URL in the environment, or use the npm script which maps --url:
 *
 *   npm run test:smoke -- --url https://preview-abc.azurestaticapps.net
 *   SMOKE_URL=https://preview-abc.azurestaticapps.net npm run test:smoke
 *
 * The baseURL is wired in playwright.smoke.config.ts.
 *
 * Separation from a11y suite
 * --------------------------
 * This file is picked up ONLY by playwright.smoke.config.ts (testMatch:
 * "smoke.spec.ts"). The default playwright.config.ts picks up the a11y and
 * main e2e suites (which mock the API and spin up a local dev server).
 * There is no axe import here.
 */

import { test, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Open the Control Panel drawer and wait for it to be interactive. */
async function openControlPanel(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('drawer-open', '"false"');
  });
  await page.goto('/');

  // Wait for the app shell to be present before interacting.
  await page.waitForSelector('[role="main"], #root > *', { timeout: 30_000 });

  const openBtn = page.getByRole('button', { name: 'Open Control Panel' });
  await openBtn.waitFor({ state: 'visible', timeout: 30_000 });
  await openBtn.click();
}

// ---------------------------------------------------------------------------
// Suite 1: App shell mounts
// ---------------------------------------------------------------------------

test.describe('Smoke: app shell', () => {
  test('page loads without a blank screen or uncaught error', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // The app root must contain rendered content within 30 s.
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 30_000 });

    // Page must not be a plain error page (5xx / blank).
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.trim().length).toBeGreaterThan(0);

    // Version selector is always present in the header once the app mounts.
    await expect(
      page.getByRole('combobox', { name: 'Game version' }),
    ).toBeVisible({ timeout: 30_000 });

    // No critical JS errors (network 4xx/5xx are logged as errors; filter known
    // non-fatal ones that occur even in production).
    const critical = consoleErrors.filter(
      (e) =>
        !e.includes('wheel sensitivity') &&
        !e.includes('popperFactory') &&
        !e.includes('Infinity'),
    );
    expect(critical, `Unexpected console errors: ${critical.join('\n')}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Core create → share → restore flow (live API)
// ---------------------------------------------------------------------------

test.describe('Smoke: create → share → restore (live API)', () => {
  test('builds a minimal plan, shares it, and the share link restores the plan', async ({ page }) => {
    // ------------------------------------------------------------------ setup
    await openControlPanel(page);

    // Ensure the Production tab is active.
    await page.getByRole('tab', { name: 'Production', exact: true }).click();

    // ------------------------------------------------------------------ add a product
    await page.getByRole('button', { name: '+ Add Product' }).click();

    // Select "Iron Plate" from the item combobox.
    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // The Amount input must appear, confirming the item was accepted.
    const amountInput = page.getByPlaceholder('Amount');
    await expect(amountInput).toBeVisible();
    // Leave the default amount (the solver doesn't require a non-zero value to
    // generate a shareable config; the share payload is always sent).

    // ------------------------------------------------------------------ share
    const saveShareBtn = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveShareBtn).toBeVisible();
    await expect(saveShareBtn).toBeEnabled();

    // Intercept the /share-factory request so we can assert the response key.
    const shareResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/share-factory') && resp.status() === 201,
      { timeout: 30_000 },
    );

    await saveShareBtn.click();

    // The API must respond with a 201 and a key.
    const shareResponse = await shareResponsePromise;
    const shareJson = await shareResponse.json();
    const shareKey: string = shareJson?.data?.key;
    expect(shareKey, 'share-factory API must return a key').toBeTruthy();
    expect(typeof shareKey).toBe('string');
    expect(shareKey.length).toBeGreaterThan(0);

    // The share link input must populate with a URL containing the key.
    const shareLinkInput = page.getByPlaceholder('Save factory to generate a link');
    await expect(shareLinkInput).not.toHaveValue('', { timeout: 10_000 });
    const linkValue = await shareLinkInput.inputValue();
    expect(linkValue, 'share link must contain the factory key').toContain(shareKey);
    expect(linkValue).toMatch(/^https?:\/\//);

    // ------------------------------------------------------------------ restore
    // Navigate to the share URL and verify the factory restores via /initialize.
    const restoreResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/initialize') &&
        resp.url().includes(shareKey) &&
        resp.status() === 200,
      { timeout: 30_000 },
    );

    // The share link uses the same host as the deployed SPA, so goto it directly.
    await page.goto(linkValue, { waitUntil: 'domcontentloaded' });

    // The initialize call with the factory key must succeed.
    const restoreResponse = await restoreResponsePromise;
    const restoreJson = await restoreResponse.json();
    expect(
      restoreJson?.data?.factory_config,
      '/initialize?factoryKey=... must return a factory_config',
    ).toBeTruthy();

    // Open the drawer and confirm the product we saved is shown.
    const openBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await openBtn.click();

    await page.getByRole('tab', { name: 'Production', exact: true }).click();

    // The item selector must contain "Iron Plate" (the item we saved).
    // The Mantine Select renders the selected value inside the combobox input.
    const selectedItem = page.getByPlaceholder('Select an item').first();
    await expect(selectedItem).toHaveValue(/Iron Plate/i, { timeout: 15_000 });
  });
});
