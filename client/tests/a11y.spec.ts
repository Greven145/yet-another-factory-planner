import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'fs';
import { join } from 'path';

const fixtureResponse = readFileSync(join(__dirname, 'fixtures/initialize-response.json'), 'utf-8');

test.describe('Accessibility (WCAG 2.0 A/AA) scans', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure drawer starts closed so tests can reliably click "Open Control Panel".
    // The hook stores JSON-encoded strings: '"false"' deserialises to the string 'false'.
    await page.addInitScript(() => {
      sessionStorage.setItem('drawer-open', '"false"');
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

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Production tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Ensure the Production tab is active (it is the default, but be explicit)
    await page.getByRole('tab', { name: 'Production', exact: true }).click();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Inputs tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Switch to the Inputs tab
    await page.getByRole('tab', { name: 'Inputs', exact: true }).click();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('Control Panel open — Recipes tab has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');

    // Open the control panel drawer
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Switch to the Recipes tab
    await page.getByRole('tab', { name: 'Recipes', exact: true }).click();

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();

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

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .exclude('canvas')
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
