import { test, expect, Page } from '@playwright/test';

// Regression coverage for #182: on a cold-started server the /share-factory POST is slow,
// so the clipboard write must (a) stay tied to the click's user activation and (b) only
// claim "Link copied!" once the write actually resolves — with a manual-copy fallback when
// the browser rejects the write (Edge/Safari after activation lapses).

const SHARE_ROUTE = /\/share-factory$/;
const STUB_KEY = 'coldstart000000000';

// Simulate a cold start: hold the POST open before returning a valid key. Uses
// page.waitForTimeout for the delay (the route sandbox has no setTimeout of its own).
async function routeColdStartShare(page: Page, delayMs: number) {
  await page.route(SHARE_ROUTE, async (route) => {
    await page.waitForTimeout(delayMs);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { key: STUB_KEY } }),
    });
  });
}

async function addProductAndReachShare(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Open Control Panel' }).click();
  await page.getByRole('button', { name: '+ Add Product' }).click();
  await page.getByPlaceholder('Select an item').click();
  await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
  // Share lives in the body FactorySwitcher — close the drawer so it isn't overlapped.
  await page.getByRole('button', { name: 'Close Control Panel' }).click();
  await expect(page.getByRole('button', { name: 'Share' })).toBeEnabled();
}

test.describe('Share on a cold-started server (#182)', () => {
  test.beforeEach(async ({ page }) => {
    // Start with the drawer closed so "Open Control Panel" is the visible toggle. The
    // hook stores JSON-encoded strings: '"false"' deserializes to the string 'false'.
    await page.addInitScript(() => {
      sessionStorage.setItem('drawer-open', '"false"');
    });
  });

  test('does not claim "Link copied!" until the clipboard write resolves', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    // Deterministic clipboard: record the write and resolve immediately, so the only
    // thing gating "copied" is the (delayed) share link resolving.
    await page.addInitScript(() => {
      (window as any).__clipWrites = 0;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          write: async () => { (window as any).__clipWrites += 1; },
          writeText: async () => { (window as any).__clipWrites += 1; },
        },
      });
    });

    await routeColdStartShare(page, 3000);
    await addProductAndReachShare(page);

    await page.getByRole('button', { name: 'Share' }).click();

    // While the cold POST is in flight the popover must read "Generating…", never "copied".
    await expect(page.getByText('Generating…')).toBeVisible();
    await expect(page.getByText('Link copied!')).toHaveCount(0);

    // Once the link resolves and the write completes, success is shown.
    await expect(page.getByText('Link copied!')).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => (window as any).__clipWrites)).toBeGreaterThan(0);
    expect(pageErrors).toEqual([]);
  });

  test('shows the manual-copy fallback when the clipboard write is rejected', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

    // Reproduce Edge/Safari dropping the write after activation lapses: both clipboard
    // paths reject.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          write: async () => { throw new Error('NotAllowedError'); },
          writeText: async () => { throw new Error('NotAllowedError'); },
        },
      });
    });

    await routeColdStartShare(page, 1500);
    await addProductAndReachShare(page);

    await page.getByRole('button', { name: 'Share' }).click();

    // The failure copy appears and the link is offered in a read-only field, never a
    // false "Link copied!".
    await expect(page.getByText("Couldn't copy — copy the link below")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Link copied!')).toHaveCount(0);

    const manualField = page.getByRole('textbox', { name: 'Shareable link' });
    await expect(manualField).toBeVisible();
    await expect(manualField).toHaveValue(new RegExp(`${STUB_KEY}$`));

    // The rejected writes must be caught, not left as unhandled rejections.
    expect(pageErrors).toEqual([]);
  });
});
