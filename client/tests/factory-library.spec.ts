import { test, expect, Page } from '@playwright/test';

// Factory tabs share the app's `segmented-tabs` look with the drawer/view tabs, so
// they're disambiguated by their title attribute ("<label> · edited <time>"), set in
// FactorySwitcher.tsx.
const FACTORY_TAB = '[role="tab"][title*="edited"]';
const LOADING = 'Loading game data...';

// Game data ships as static ESM/JSON chunks (no API call). Slow those chunks so
// the loading overlay is observable when a test switches game versions.
async function delayGameData(page: Page, ms: number) {
  await page.route('**/data/1.*/**', async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

async function gotoApp(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
}

async function openControlPanel(page: Page) {
  await page.getByRole('button', { name: 'Open Control Panel' }).click();
  await page.getByRole('tab', { name: 'Production', exact: true }).click();
}

async function closeControlPanel(page: Page) {
  await page.getByRole('button', { name: 'Close Control Panel' }).click();
}

async function addProduct(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Add Product' }).click();
  await page.getByPlaceholder('Select an item').last().click();
  await page.getByRole('option', { name, exact: true }).click();
}

test.describe('Multi-factory library', () => {
  test.beforeEach(async ({ page }) => {
    // Drawer starts closed so the FactorySwitcher controls in the main body are
    // reachable without the drawer overlapping them.
    await page.addInitScript(() => {
      sessionStorage.setItem('drawer-open', '"false"');
    });
  });

  test('persists a factory across reloads via localStorage', async ({ page }) => {
    await gotoApp(page);
    await openControlPanel(page);
    await addProduct(page, 'Iron Plate');
    await closeControlPanel(page);

    // The active tab's auto-label reflects the product, and the library is in localStorage.
    await expect(page.locator(FACTORY_TAB).first()).toContainText('Iron Plate');
    const stored = await page.evaluate(() => localStorage.getItem('factory-library'));
    expect(stored).toContain('Desc_IronPlate_C');

    // Reload: the factory comes back from localStorage (previously this work was lost).
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(FACTORY_TAB).first()).toContainText('Iron Plate');
  });

  test('supports create / rename / duplicate / delete, persisted across reload', async ({ page }) => {
    await gotoApp(page);
    const tabs = page.locator(FACTORY_TAB);
    await expect(tabs).toHaveCount(1);

    // New
    await page.getByRole('button', { name: 'New factory' }).click();
    await expect(tabs).toHaveCount(2);

    // Rename the active factory
    await page.getByRole('button', { name: 'Factory actions' }).click();
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const renameDialog = page.getByRole('dialog', { name: 'Rename factory' });
    await renameDialog.getByLabel('Nickname').fill('My Steel Base');
    await renameDialog.getByRole('button', { name: 'Save' }).click();
    await expect(tabs.filter({ hasText: 'My Steel Base' })).toHaveCount(1);

    // Duplicate → "<name> (copy)"
    await page.getByRole('button', { name: 'Factory actions' }).click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    await expect(tabs).toHaveCount(3);
    await expect(tabs.filter({ hasText: 'My Steel Base (copy)' })).toHaveCount(1);

    // Delete the active (the copy)
    await page.getByRole('button', { name: 'Factory actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Delete factory' });
    await deleteDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(tabs).toHaveCount(2);
    await expect(tabs.filter({ hasText: 'My Steel Base (copy)' })).toHaveCount(0);

    // Persisted across reload
    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
    await expect(tabs).toHaveCount(2);
    await expect(tabs.filter({ hasText: 'My Steel Base' })).toHaveCount(1);
  });

  test('reset-to-empty clears the active factory', async ({ page }) => {
    await gotoApp(page);
    await openControlPanel(page);
    await addProduct(page, 'Iron Plate');
    await closeControlPanel(page);
    await expect(page.locator(FACTORY_TAB).first()).toContainText('Iron Plate');

    await page.getByRole('button', { name: 'Factory actions' }).click();
    await page.getByRole('menuitem', { name: 'Reset to empty' }).click();

    await expect(page.locator(FACTORY_TAB).first()).toContainText('Empty factory');
  });

  test('switching between same-version factories is instant (no loading overlay)', async ({ page }) => {
    await gotoApp(page);

    // Factory A: Iron Plate
    await openControlPanel(page);
    await addProduct(page, 'Iron Plate');
    await closeControlPanel(page);

    // Factory B: Iron Rod
    await page.getByRole('button', { name: 'New factory' }).click();
    await openControlPanel(page);
    await addProduct(page, 'Iron Rod');
    await closeControlPanel(page);

    const tabs = page.locator(FACTORY_TAB);
    const ironPlateTab = tabs.filter({ hasText: 'Iron Plate' });

    // Switch back to A. The overlay (which only renders on a game-data refetch) must
    // never appear, and the target tab must be selected immediately with its real
    // label — no "Empty factory" flash.
    await ironPlateTab.click();
    await expect(page.getByText(LOADING)).toHaveCount(0);
    await expect(ironPlateTab).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.filter({ hasText: 'Empty factory' })).toHaveCount(0);
  });

  test('switching to a different-version factory shows the loading overlay', async ({ page }) => {
    // Add latency so the refetch overlay is observable.
    await delayGameData(page, 600);
    await gotoApp(page);

    const tabs = page.locator(FACTORY_TAB);
    const versionSelect = page.getByRole('combobox', { name: 'Game version' });

    // Factory A stays on 1.2. Create B and retarget it to 1.1 (this itself refetches).
    await page.getByRole('button', { name: 'New factory' }).click();
    await expect(tabs).toHaveCount(2);
    await versionSelect.click();
    await page.getByRole('option', { name: '1.1', exact: true }).click();
    await expect(page.getByText(LOADING)).toBeVisible();
    await expect(page.getByText(LOADING)).toBeHidden({ timeout: 15_000 });
    await expect(versionSelect).toHaveValue(/1\.1/);

    // Switch to A (1.2): a different-version switch must refetch → overlay appears.
    await tabs.first().click();
    await expect(page.getByText(LOADING)).toBeVisible();
    await expect(page.getByText(LOADING)).toBeHidden({ timeout: 15_000 });
    await expect(versionSelect).toHaveValue(/1\.2/);
  });

  test('imports a ?factory= share link as a new slot and strips the URL', async ({ page }) => {
    // The share path resolves the saved config via GET /shared-factories/:key.
    // Anchor to the endpoint path so it doesn't also match the Vite dev-server
    // module request for src/api/modules/shared-factories/*.
    await page.route(/\/\/[^/]+\/(?:api\/)?shared-factories\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            factory_config: {
              gameVersion: 'V1_2',
              productionItems: [{ itemKey: 'Desc_IronPlate_C', mode: 'per-minute', value: 10 }],
              inputItems: [],
              inputResources: [],
              allowHandGatheredItems: false,
              weightingOptions: { resources: 1000, power: 1, complexity: 0, buildings: 0 },
              gameModeOptions: { recipePartsCost: 1, powerConsumption: 1 },
              allowedRecipes: [],
              nodesPositions: [],
            },
          },
        }),
      });
    });

    await gotoApp(page, '/?factory=e2eimportkey0001');

    // URL is stripped of the query string after import.
    await expect(page).toHaveURL(/^[^?]*$/);

    // The imported factory is a slot labelled from its config, and persists on reload.
    const imported = page.locator(FACTORY_TAB).filter({ hasText: 'Iron Plate' });
    await expect(imported).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(FACTORY_TAB).filter({ hasText: 'Iron Plate' })).toHaveCount(1);
  });

  test('Share is gated until a product exists, then posts and confirms', async ({ page, context, browserName }) => {
    // The confirmation popover now waits for the clipboard write to resolve (#182), so
    // grant clipboard-write for Chromium (whose permission model gates it) to exercise
    // the success path; Firefox/WebKit resolve the write without an explicit grant.
    if (browserName === 'chromium') {
      await context.grantPermissions(['clipboard-write']);
    }

    // Stub the share endpoint so no real backend is needed.
    await page.route(/\/share-factory$/, async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { key: 'e2esharekey00001' } }),
      });
    });

    await gotoApp(page);

    // Empty factory → Share disabled (firing it would 400).
    const shareBtn = page.getByRole('button', { name: 'Share' });
    await expect(shareBtn).toBeDisabled();

    // Add a product → Share becomes enabled.
    await openControlPanel(page);
    await addProduct(page, 'Iron Plate');
    await closeControlPanel(page);
    await expect(shareBtn).toBeEnabled();

    // Click → the share request fires and the copied-confirmation popover appears.
    const sharePost = page.waitForResponse(
      (r) => r.url().includes('/share-factory') && r.status() === 201,
      { timeout: 15_000 },
    );
    await shareBtn.click();
    await sharePost;
    await expect(page.getByText('Link copied!')).toBeVisible();
  });

  test('exposes no Calculate, Auto-calculate, or Save & Share controls', async ({ page }) => {
    await gotoApp(page);
    await openControlPanel(page);

    await expect(page.getByRole('button', { name: /calculate/i })).toHaveCount(0);
    await expect(page.getByRole('switch', { name: /auto-calculate/i })).toHaveCount(0);
    await expect(page.getByText(/auto-calculate/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /save & share/i })).toHaveCount(0);
  });
});
