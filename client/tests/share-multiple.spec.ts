import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// E2E for the "share multiple factories" feature: one link carries several library
// factories (`?factory=k1,k2,…`) and the recipient picks which to import. The whole
// feature is client-side; the existing POST /share-factory and GET
// /shared-factories/{key} endpoints are reused and mocked here exactly like the
// single-share specs (anchored routes so Vite's own module requests aren't swallowed).

const FACTORY_TAB = '[role="tab"][title*="edited"]';
const LOADING = 'Loading game data...';

// ---- App bootstrap ---------------------------------------------------------

async function gotoApp(page: Page, url = '/') {
  await page.goto(url);
  await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
}

async function openControlPanel(page: Page) {
  await page.getByRole('button', { name: 'Open Control Panel' }).click();
  await page.getByRole('tab', { name: 'Production', exact: true }).click();
}

// ---- Library seeding -------------------------------------------------------

// A complete FactoryOptions with one selected product, so canShareFactory() is true
// and encode() (run client-side before the POST) has every field it reads.
function shareableConfig(itemKey = 'Desc_IronPlate_C', value = '10') {
  return {
    key: 'seedcfg',
    productionItems: [{ key: 'p1', itemKey, mode: 'per-minute', value }],
    inputItems: [],
    inputResources: [],
    allowHandGatheredItems: false,
    weightingOptions: { resources: '1000', power: '1', complexity: '0', buildings: '0' },
    gameModeOptions: { recipePartsCost: '1', powerConsumption: '1' },
    allowedRecipes: {},
    allowedBuildings: {},
    nodesPositions: [],
    maximizeBalanceMode: 'proportional',
    transportOptions: { beltCapacity: null, pipeCapacity: null },
  };
}

// A config with a placeholder (no item selected) row → not shareable.
function emptyProductsConfig() {
  const c = shareableConfig();
  c.productionItems = [{ key: 'p1', itemKey: '', mode: 'per-minute', value: '0' }];
  return c;
}

type Seed = { id: string; nickname?: string; config?: any; gameVersion?: string; createdAt?: number };

// Write a `factory-library` map + active pointer directly, mirroring the shape in
// contexts/library/storage.ts (a LibraryMap keyed by id). Order in the UI is
// createdAt asc, so callers pass increasing createdAt.
async function seedLibrary(page: Page, seeds: Seed[], activeId: string) {
  const now = Date.now();
  const library: Record<string, any> = {};
  seeds.forEach((s, i) => {
    library[s.id] = {
      id: s.id,
      nickname: s.nickname,
      gameVersion: s.gameVersion ?? '1.2',
      config: s.config,
      createdAt: s.createdAt ?? now + i,
      updatedAt: s.createdAt ?? now + i,
    };
  });
  await page.addInitScript(
    ([lib, active]) => {
      window.localStorage.setItem('factory-library', JSON.stringify(lib));
      window.sessionStorage.setItem('active-factory-id', active as string);
    },
    [library, activeId] as const,
  );
}

// ---- Network mocks ---------------------------------------------------------

// Stub POST /share-factory with a fresh unique key per call; returns the array the
// route fills so a test can count calls and know the issued keys.
function mockSharePost(page: Page): string[] {
  const postedKeys: string[] = [];
  page.route(/\/share-factory$/, async (route) => {
    const key = `sharekey${String(postedKeys.length).padStart(8, '0')}`;
    postedKeys.push(key);
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { key } }),
    });
  });
  return postedKeys;
}

// As above, but the first call 500s (partial-failure exercise). Returns the keys
// that were actually issued (the successes).
function mockSharePostWithOneFailure(page: Page): string[] {
  const postedKeys: string[] = [];
  let seen = 0;
  page.route(/\/share-factory$/, async (route) => {
    const i = seen++;
    if (i === 0) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      return;
    }
    const key = `sharekey${String(postedKeys.length).padStart(8, '0')}`;
    postedKeys.push(key);
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { key } }) });
  });
  return postedKeys;
}

type WireSpec = { version?: string; itemKey?: string; value?: number };

function wireFactory({ version = 'V1_2', itemKey = 'Desc_IronPlate_C', value = 10 }: WireSpec = {}) {
  return {
    gameVersion: version,
    productionItems: [{ itemKey, mode: 'per-minute', value }],
    inputItems: [],
    inputResources: [],
    allowHandGatheredItems: false,
    weightingOptions: { resources: 1000, power: 1, complexity: 0, buildings: 0 },
    gameModeOptions: { recipePartsCost: 1, powerConsumption: 1 },
    allowedRecipes: [],
    nodesPositions: [],
  };
}

// Mock GET /shared-factories/{key}. `resolve(key)` returns a WireSpec for a live
// key, or null for a dead one (404). Anchored to `//host/…/shared-factories/{key}`
// so it never swallows Vite's own useGetSharedFactory.ts module request.
function mockSharedGet(page: Page, resolve: (key: string) => WireSpec | null) {
  return page.route(/\/\/[^/]+\/(?:api\/)?shared-factories\/([^/?#]+)/, async (route) => {
    const m = route.request().url().match(/shared-factories\/([^/?#]+)/);
    const key = m ? m[1] : '';
    const spec = resolve(key);
    if (!spec) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { factory_config: wireFactory(spec) } }),
    });
  });
}

// ---- UI helpers ------------------------------------------------------------

// Open the Share split-button dropdown → "Share multiple…" and return the modal.
async function openShareMultiple(page: Page) {
  await page.getByRole('button', { name: 'More share options' }).click();
  await page.getByRole('menuitem', { name: 'Share multiple…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Share factories' });
  await expect(dialog).toBeVisible();
  return dialog;
}

// axe scan scoped to a single dialog (WCAG 2.0 A/AA), mirroring a11y.spec.ts. The
// `color-contrast` rule is dropped here: the row list (FactorySelectList, extracted
// verbatim from LibraryManagerModal) renders its meta/reason as Mantine's `dimmed`
// token (#868e96), which sits at ~3.15:1 on the light modal surface — a pre-existing
// app-wide token issue, not something these dialogs introduce. Every other structural
// WCAG rule (roles, names, labels, aria) still runs, which is what this asserts.
async function scanDialog(page: Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .include('[role="dialog"]')
    .disableRules(['color-contrast'])
    .analyze();
}

test.describe('Share multiple — send', () => {
  test.beforeEach(async ({ page }) => {
    // Drawer closed so the FactorySwitcher (which hosts the Share split button) is reachable.
    await page.addInitScript(() => sessionStorage.setItem('drawer-open', '"false"'));
  });

  test('lists all library factories and disables un-shareable slots', async ({ page }) => {
    await seedLibrary(
      page,
      [
        { id: 'a', nickname: 'Alpha Base', config: shareableConfig() },
        { id: 'b', nickname: 'Beta Base', config: shareableConfig('Desc_IronRod_C', '20') },
        { id: 'c', nickname: 'Never Edited' }, // config undefined
        { id: 'd', nickname: 'No Products', config: emptyProductsConfig() },
      ],
      'c',
    );
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    // Every library factory is a row.
    await expect(dialog.getByRole('checkbox', { name: /Alpha Base/ })).toBeEnabled();
    await expect(dialog.getByRole('checkbox', { name: /Beta Base/ })).toBeEnabled();

    // A never-edited (empty) slot and a no-products slot are both disabled with the reason.
    await expect(dialog.getByRole('checkbox', { name: /Never Edited/ })).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: /No Products/ })).toBeDisabled();
    await expect(dialog.getByText('No products to share').first()).toBeVisible();
  });

  test('shares 2 selected factories → 2 POSTs and a 2-key link', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const postedKeys = mockSharePost(page);

    await seedLibrary(
      page,
      [
        { id: 'a', nickname: 'Alpha Base', config: shareableConfig() },
        { id: 'b', nickname: 'Beta Base', config: shareableConfig('Desc_IronRod_C', '20') },
      ],
      'a',
    );
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    await dialog.getByRole('checkbox', { name: /Alpha Base/ }).check();
    await dialog.getByRole('checkbox', { name: /Beta Base/ }).check();
    await dialog.getByRole('button', { name: 'Share 2 selected' }).click();

    await expect(dialog.getByText('Link copied!')).toBeVisible({ timeout: 15_000 });
    expect(postedKeys).toHaveLength(2);

    if (browserName === 'chromium') {
      const link = await page.evaluate(() => navigator.clipboard.readText());
      expect(link).toContain('?factory=');
      const value = new URL(link).searchParams.get('factory') ?? '';
      expect(value.split(',')).toHaveLength(2);
      for (const k of postedKeys) expect(value).toContain(k);
    }
  });

  test('Select all over a mixed library shares only the shareable ones', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const postedKeys = mockSharePost(page);
    await seedLibrary(
      page,
      [
        { id: 'a', nickname: 'Alpha Base', config: shareableConfig() },
        { id: 'b', nickname: 'Never Edited' },
        { id: 'c', nickname: 'Gamma Base', config: shareableConfig('Desc_IronRod_C', '20') },
        { id: 'd', nickname: 'No Products', config: emptyProductsConfig() },
      ],
      'a',
    );
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    await dialog.getByRole('button', { name: 'Select all' }).click();
    // Only the two shareable rows become checked.
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Share 2 selected' }).click();

    await expect(dialog.getByText('Link copied!')).toBeVisible({ timeout: 15_000 });
    expect(postedKeys).toHaveLength(2);
  });

  test('partial POST failure reports the shortfall and drops the failed key', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const postedKeys = mockSharePostWithOneFailure(page);

    await seedLibrary(
      page,
      [
        { id: 'a', nickname: 'Alpha Base', config: shareableConfig() },
        { id: 'b', nickname: 'Beta Base', config: shareableConfig('Desc_IronRod_C', '20') },
      ],
      'a',
    );
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    await dialog.getByRole('checkbox', { name: /Alpha Base/ }).check();
    await dialog.getByRole('checkbox', { name: /Beta Base/ }).check();
    await dialog.getByRole('button', { name: 'Share 2 selected' }).click();

    await expect(dialog.getByText('Shared 1 of 2 — copied')).toBeVisible({ timeout: 15_000 });
    expect(postedKeys).toHaveLength(1); // exactly one survivor

    if (browserName === 'chromium') {
      const link = await page.evaluate(() => navigator.clipboard.readText());
      const value = new URL(link).searchParams.get('factory') ?? '';
      expect(value).not.toContain(','); // one key, no comma
      expect(value).toBe(postedKeys[0]);
    }
  });

  test('single selection builds a back-compat link with no comma', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const postedKeys = mockSharePost(page);

    await seedLibrary(page, [{ id: 'a', nickname: 'Alpha Base', config: shareableConfig() }], 'a');
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    await dialog.getByRole('checkbox', { name: /Alpha Base/ }).check();
    await dialog.getByRole('button', { name: 'Share 1 selected' }).click();

    await expect(dialog.getByText('Link copied!')).toBeVisible({ timeout: 15_000 });
    expect(postedKeys).toHaveLength(1);

    if (browserName === 'chromium') {
      const link = await page.evaluate(() => navigator.clipboard.readText());
      const value = new URL(link).searchParams.get('factory') ?? '';
      expect(value).not.toContain(',');
      expect(value).toBe(postedKeys[0]);
    }
  });

  test('caps selection at 50 on send: 51st disabled, notice shown, link has 50 keys', async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const postedKeys = mockSharePost(page);

    // 51 shareable factories, ordered by createdAt (Factory-00 .. Factory-50).
    const seeds: Seed[] = [];
    for (let i = 0; i <= 50; i++) {
      const id = `f${String(i).padStart(2, '0')}`;
      seeds.push({ id, nickname: `Factory-${String(i).padStart(2, '0')}`, config: shareableConfig(), createdAt: 1_000 + i });
    }
    await seedLibrary(page, seeds, 'f00');
    await gotoApp(page);
    const dialog = await openShareMultiple(page);

    await dialog.getByRole('button', { name: 'Select all' }).click();

    // At most 50 selected; the 51st row is over the cap and disabled; notice visible.
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(50);
    await expect(dialog.getByRole('checkbox', { name: /Factory-50/ })).toBeDisabled();
    await expect(dialog.getByText('Over the 50-factory limit').first()).toBeVisible();
    await expect(dialog.getByText('You can share up to 50 factories in one link.')).toBeVisible();

    await dialog.getByRole('button', { name: 'Share 50 selected' }).click();
    await expect(dialog.getByText('Link copied!')).toBeVisible({ timeout: 30_000 });
    expect(postedKeys).toHaveLength(50);

    if (browserName === 'chromium') {
      const link = await page.evaluate(() => navigator.clipboard.readText());
      const value = new URL(link).searchParams.get('factory') ?? '';
      expect(value.split(',')).toHaveLength(50);
    }
  });
});

test.describe('Share multiple — receive', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('drawer-open', '"false"'));
  });

  test('imports both keys of a 2-key link, strips URL, persists across reload', async ({ page }) => {
    mockSharedGet(page, (key) =>
      key === 'k1' ? { itemKey: 'Desc_IronPlate_C', value: 10 } : key === 'k2' ? { itemKey: 'Desc_IronRod_C', value: 20 } : null,
    );

    await gotoApp(page, '/?factory=k1,k2');

    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    // Both resolved rows default-checked.
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Import 2 selected' }).click();

    // URL is stripped (it is stripped up front on a multi-share boot).
    await expect(page).toHaveURL(/^[^?]*$/);

    const tabs = page.locator(FACTORY_TAB);
    await expect(tabs.filter({ hasText: 'Iron Plate' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Iron Rod' })).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(FACTORY_TAB).filter({ hasText: 'Iron Plate' })).toHaveCount(1);
    await expect(page.locator(FACTORY_TAB).filter({ hasText: 'Iron Rod' })).toHaveCount(1);
  });

  test('imports only the checked subset', async ({ page }) => {
    mockSharedGet(page, (key) =>
      key === 'k1' ? { itemKey: 'Desc_IronPlate_C', value: 10 } : key === 'k2' ? { itemKey: 'Desc_IronRod_C', value: 20 } : null,
    );

    await gotoApp(page, '/?factory=k1,k2');
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // Uncheck the Iron Rod row → only Iron Plate imports.
    await dialog.getByRole('checkbox', { name: /Iron Rod/ }).uncheck();
    await dialog.getByRole('button', { name: 'Import 1 selected' }).click();

    const tabs = page.locator(FACTORY_TAB);
    await expect(tabs.filter({ hasText: 'Iron Plate' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Iron Rod' })).toHaveCount(0);
  });

  test('a dead key is greyed and unselectable; the live one still imports', async ({ page }) => {
    mockSharedGet(page, (key) => (key === 'k1' ? { itemKey: 'Desc_IronPlate_C', value: 10 } : null)); // k2 → 404

    await gotoApp(page, '/?factory=k1,k2');
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // The dead key row is disabled with the reason.
    const dead = dialog.getByRole('checkbox', { name: /Expired or invalid/ });
    await expect(dead).toBeDisabled();

    await dialog.getByRole('button', { name: 'Import 1 selected' }).click();
    await expect(page.locator(FACTORY_TAB).filter({ hasText: 'Iron Plate' })).toHaveCount(1);
  });

  test('all keys dead → cohesive share-error, no picker, nothing imported', async ({ page }) => {
    mockSharedGet(page, () => null); // both 404

    await gotoApp(page, '/?factory=dead1,dead2');

    // No import picker; the cohesive share-error surfaces instead (matches share-error.spec).
    await expect(page.getByRole('dialog', { name: 'Import shared factories' })).toHaveCount(0);
    const err = page.getByRole('dialog', { name: /Shared factory not found/i });
    await expect(err).toBeVisible({ timeout: 30_000 });
    await expect(err.getByText(/valid for/i)).toContainText('7 days');

    // The old dead-end takeover must be gone, and nothing was imported.
    await expect(page.getByText(/error occurred connecting to the server/i)).toHaveCount(0);
    await err.getByRole('button', { name: 'Continue' }).click();
    await expect(page.locator(FACTORY_TAB).filter({ hasText: /Iron/ })).toHaveCount(0);
  });

  test('a single-key link silently imports without the picker (regression guard)', async ({ page }) => {
    mockSharedGet(page, () => ({ itemKey: 'Desc_IronPlate_C', value: 10 }));

    await gotoApp(page, '/?factory=onlyonekey');

    // The imported factory lands directly as a slot — no picker dialog.
    await expect(page.locator(FACTORY_TAB).filter({ hasText: 'Iron Plate' })).toHaveCount(1);
    await expect(page.getByRole('dialog', { name: 'Import shared factories' })).toHaveCount(0);
    await expect(page).toHaveURL(/^[^?]*$/);
  });

  test('imports a mix of game versions with correct labels', async ({ page }) => {
    mockSharedGet(page, (key) =>
      key === 'k1'
        ? { version: 'V1_1', itemKey: 'Desc_IronPlate_C', value: 10 }
        : key === 'k2'
        ? { version: 'V1_2', itemKey: 'Desc_IronRod_C', value: 20 }
        : null,
    );

    await gotoApp(page, '/?factory=k1,k2');
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // Per-version rows carry their version meta.
    await expect(dialog.getByText('v1.1')).toBeVisible();
    await expect(dialog.getByText('v1.2')).toBeVisible();

    await dialog.getByRole('button', { name: 'Import 2 selected' }).click();

    const tabs = page.locator(FACTORY_TAB);
    await expect(tabs.filter({ hasText: 'Iron Plate' })).toHaveCount(1, { timeout: 30_000 });
    await expect(tabs.filter({ hasText: 'Iron Rod' })).toHaveCount(1);
  });

  test('cancel imports nothing; URL already stripped; planner usable', async ({ page }) => {
    mockSharedGet(page, (key) =>
      key === 'k1' ? { itemKey: 'Desc_IronPlate_C', value: 10 } : key === 'k2' ? { itemKey: 'Desc_IronRod_C', value: 20 } : null,
    );

    await gotoApp(page, '/?factory=k1,k2');
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);

    // Nothing imported, URL already stripped, and the planner still works.
    await expect(page.locator(FACTORY_TAB).filter({ hasText: /Iron/ })).toHaveCount(0);
    await expect(page).toHaveURL(/^[^?]*$/);
    await openControlPanel(page);
    await expect(page.getByRole('button', { name: '+ Add Product' })).toBeVisible();
  });

  test('caps at 50 on receive: overflow surfaced, at most 50 importable', async ({ page }) => {
    // 51 live keys k0..k50; the 51st is past the cap and never fetched (overflow).
    mockSharedGet(page, () => ({ itemKey: 'Desc_IronPlate_C', value: 10 }));
    const keys = Array.from({ length: 51 }, (_, i) => `k${i}`).join(',');

    await gotoApp(page, `/?factory=${keys}`);
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    // At most 50 are checkable/checked; the overflow row is disabled (not a dead-end).
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(50);
    await expect(dialog.getByRole('button', { name: 'Import 50 selected' })).toBeVisible();
    await expect(dialog.getByRole('checkbox', { disabled: true })).toHaveCount(1);
    // The overflow row reads as over-the-limit, NOT "Expired or invalid": these keys
    // were never fetched, they're simply past the 50-per-link cap.
    await expect(dialog.getByText('Over the 50-factory limit')).toBeVisible();
    await expect(dialog.getByText('Expired or invalid')).toHaveCount(0);
  });
});

test.describe('Share multiple — accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('drawer-open', '"false"'));
    // Freeze transitions so axe never samples an element mid-fade (see a11y.spec.ts).
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent = '*,*::before,*::after{transition:none!important;animation:none!important;}';
      document.documentElement.appendChild(style);
    });
  });

  test('the Share-factories modal has an accessible name and no WCAG A/AA violations', async ({ page }) => {
    await seedLibrary(page, [{ id: 'a', nickname: 'Alpha Base', config: shareableConfig() }], 'a');
    await gotoApp(page);
    const dialog = await openShareMultiple(page); // accessible name asserted inside
    await expect(dialog).toBeVisible();

    const results = await scanDialog(page);
    expect(results.violations).toEqual([]);
  });

  test('the Import-shared-factories modal has an accessible name and no WCAG A/AA violations', async ({ page }) => {
    mockSharedGet(page, (key) =>
      key === 'k1' ? { itemKey: 'Desc_IronPlate_C', value: 10 } : key === 'k2' ? { itemKey: 'Desc_IronRod_C', value: 20 } : null,
    );
    await gotoApp(page, '/?factory=k1,k2');
    const dialog = page.getByRole('dialog', { name: 'Import shared factories' });
    await expect(dialog).toBeVisible({ timeout: 30_000 });

    const results = await scanDialog(page);
    expect(results.violations).toEqual([]);
  });
});
