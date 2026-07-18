import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Builds the standard WCAG 2.0 A/AA axe scan. The `<canvas>` element itself is
// excluded because a canvas is inherently opaque to assistive tech; the accessible
// equivalent of the graph is the Flow tab (issue #92, ADR 0002), which IS scanned and
// positively asserted below. Headless WebKit's colour management diverges
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
    // Game data ships as static bundles now, so no API mock is needed to load the app.
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

  test('Delete-factory modal has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the Delete dialog from the factory switcher's actions menu (the body
    // switcher is always visible; the drawer stays closed).
    await page.getByRole('button', { name: 'Factory actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Wait for the modal dialog to be present before scanning
    await expect(page.getByRole('dialog', { name: 'Delete factory' })).toBeVisible();

    // Scope the scan to the dialog itself: the open Modal renders a translucent
    // overlay that dims the (inert, aria-hidden) page behind it, which would
    // otherwise lower the composited contrast of background elements. The
    // transient surface under test is the dialog.
    const results = await buildScan(page).include('[role="dialog"]').analyze();

    expect(results.violations).toEqual([]);
  });

  test('Share-link "copied" popover has no WCAG A/AA violations', async ({ page, context, browserName }) => {
    // The popover now confirms "Link copied!" only once the clipboard write actually
    // resolves (#182). Grant clipboard-write so Chromium's write succeeds here (its
    // permission model gates it; Firefox/WebKit resolve without an explicit grant).
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-write']);
    }

    // Stub the share endpoint so the popover opens without a live backend.
    await page.route(/\/share-factory$/, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { key: 'a11ysharekey00001' } }),
      });
    });

    await page.goto('/');

    // Share is gated until the factory has a product, so add one first.
    await page.getByRole('button', { name: 'Open Control Panel' }).click();
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByPlaceholder('Select an item').click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    await page.getByRole('button', { name: 'Close Control Panel' }).click();

    // Clicking Share posts the factory and opens the "Link copied!" popover.
    // (exact: the multi-share split control also renders a "More share options" button.)
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.getByText('Link copied!')).toBeVisible();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Flow tab is an accessible equivalent of the graph (no WCAG A/AA violations)', async ({ page }) => {
    await page.goto('/');

    // Open the control panel and add a product so the results area is populated
    await page.getByRole('button', { name: 'Open Control Panel' }).click();
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByPlaceholder('Select an item').click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Wait for the solver to compute a plan
    await page.waitForTimeout(1000);

    // Close the drawer so the results tabs are reachable
    await page.getByRole('button', { name: 'Close Control Panel' }).click();

    // Switch to the Flow tab — the DOM equivalent of the canvas graph
    await page.getByRole('tab', { name: 'Flow' }).click();

    // Positive assertion: the production-steps section and per-recipe cards are present
    // and reachable, so the plan's structure is available without the canvas.
    await expect(page.getByRole('heading', { name: 'Production steps' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iron Plate' }).first()).toBeVisible();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Report tab has no WCAG A/AA violations', async ({ page }) => {
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

    // Close the drawer so the Report tab is accessible
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await closeBtn.click();

    // Switch to the Report tab
    await page.getByRole('tab', { name: 'Report' }).click();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });

  test('Report tab with an amplification budget has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open Control Panel' }).click();
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByPlaceholder('Select an item').click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Set budgets so the Report tab renders the Amplification stat cards (only shown
    // when a somersloop/power-shard budget is available).
    await page.getByRole('spinbutton', { name: 'Somersloops' }).fill('20');
    await page.getByRole('spinbutton', { name: 'Power Shards' }).fill('30');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Close Control Panel' }).click();
    await page.getByRole('tab', { name: 'Report' }).click();

    // Confirm the new cards actually rendered before scanning them.
    await expect(page.getByRole('heading', { name: 'Amplification' })).toBeVisible();

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });
});
