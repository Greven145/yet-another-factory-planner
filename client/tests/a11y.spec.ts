import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixtureResponse = readFileSync(join(__dirname, 'fixtures/initialize-response.json'), 'utf-8');

// Builds the standard WCAG 2.0 A/AA axe scan (canvas excluded — the graph is a
// separate tracked follow-up). Headless WebKit's colour management diverges
// from real sRGB and produces non-deterministic color-contrast results on
// borderline brand colours that pass reliably on Chromium + Firefox (which are
// authoritative for contrast here), so that single rule is dropped on WebKit
// only — every other axe rule still runs cross-browser.
function buildScan(page: Page) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('canvas');

  if (test.info().project.name === 'webkit') {
    builder.disableRules(['color-contrast']);
  }

  return builder;
}

test.describe('Accessibility (WCAG 2.0 A/AA) scans', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure drawer starts closed so tests can reliably click "Open Control Panel".
    // The hook stores JSON-encoded strings: '"false"' deserialises to the string 'false'.
    await page.addInitScript(() => {
      sessionStorage.setItem('drawer-open', '"false"');
    });

    // Disable CSS transitions/animations so axe never samples an element mid-fade
    // (e.g. a modal/popover transition), which produces non-deterministic
    // composited colours — especially under headless WebKit.
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent =
        '*,*::before,*::after{transition:none!important;animation:none!important;}';
      document.documentElement.appendChild(style);
    });

    // Mock the /initialize API so tests run without the Aspire backend.
    await page.route(/\/initialize(\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: fixtureResponse,
      });
    });
  });

  test('initial page load has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Production tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Ensure the Production tab is active (it is the default, but be explicit)
    await page.getByRole('tab', { name: 'Production', exact: true }).click();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Inputs tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Switch to the Inputs tab
    await page.getByRole('tab', { name: 'Inputs', exact: true }).click();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Recipes tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Switch to the Recipes tab
    await page.getByRole('tab', { name: 'Recipes', exact: true }).click();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Reset-confirmation modal has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Open the reset-confirmation modal
    await page.getByRole('button', { name: 'Reset ALL Factory Options' }).click();

    // Wait for the modal dialog to be present before scanning
    await expect(page.getByRole('dialog')).toBeVisible();

    // Scope the scan to the dialog itself: the open Modal renders a translucent
    // overlay that dims the (inert, aria-hidden) page behind it, which would
    // otherwise lower the composited contrast of background elements. The
    // transient surface under test is the dialog.
    const results = await buildScan(page).include('[role="dialog"]').analyze();

    expect(results.violations).toEqual([]);
  });

  test('Share-link "copied" popover has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Clicking the share input opens the "Link copied!" popover directly,
    // avoiding the backend round-trip the "Save & Share" button performs.
    await page.getByPlaceholder('Save factory to generate a link').click();

    await expect(page.getByText('Link copied!')).toBeVisible();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Factory Report tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel and add a product so the results area is populated
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Wait a moment for computation
    await page.waitForTimeout(1000);

    // Close the drawer so Factory Report tab is accessible
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await closeBtn.click();

    // Switch to the Factory Report tab
    await page.getByRole('tab', { name: 'Factory Report' }).click();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });
});
