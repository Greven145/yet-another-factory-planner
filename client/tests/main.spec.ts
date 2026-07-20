import { test, expect } from '@playwright/test';

test.describe('Factory Planner Application', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure drawer starts closed so tests can reliably click "Open Control Panel".
    // The hook stores JSON-encoded strings: '"false"' deserializes to the string 'false'.
    await page.addInitScript(() => {
      sessionStorage.setItem('drawer-open', '"false"');
    });
    // Game data now ships as static bundles, so a normal load needs no API mock.
  });

  test('should load application with default 1.2 game version', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/\[1\.2\]/);
  });

  test('should display game version selector', async ({ page }) => {
    await page.goto('/');

    // Version selector is always visible in the header (Mantine 9 Select uses combobox role)
    const versionControl = page.getByRole('combobox', { name: 'Game version' });
    await expect(versionControl).toBeVisible();
  });

  test('should add a product and compute solution', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Click Add Product button
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    // Click on Item selector and select Iron Plate (Mantine 9 Select — find by placeholder)
    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Verify item was selected: the amount field appears (TextInput has no label, use placeholder)
    const amountInput = page.getByPlaceholder('Amount');
    await expect(amountInput).toBeVisible();
  });

  test('should display production graph', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add a product
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Wait and check for graph canvas
    await page.waitForSelector('canvas', { timeout: 5000 });
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add product to get results
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Wait a moment for computation
    await page.waitForTimeout(1000);

    // Close the drawer so tabs are not blocked
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await closeBtn.click();

    // Click Factory Report tab (now in main content area, not blocked by drawer)
    await page.getByRole('tab', { name: 'Report' }).click();

    // Verify tab is active
    const reportTab = page.getByRole('tab', { name: 'Report' });
    await expect(reportTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should handle AI Expansion Server production chain', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add AI Expansion Server (tests the SAM fix)
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'AI Expansion Server' }).click();

    // Should compute without crashing
    await page.waitForSelector('canvas', { timeout: 10000 });
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should maintain drawer and graph layout', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Drawer should be visible
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await expect(closeBtn).toBeVisible();

    // Add product
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Canvas should be visible alongside drawer
    await page.waitForSelector('canvas');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should render footer with credits', async ({ page }) => {
    await page.goto('/');

    // Scroll the main content area to the bottom to reveal the footer
    await page.evaluate(() => {
      const mainContent = document.querySelector('[class*="MainContent"]') as HTMLElement
        ?? document.querySelector('main') as HTMLElement;
      if (mainContent) {
        mainContent.scrollTop = mainContent.scrollHeight;
      }
    });

    // Both creators should be credited
    await expect(page.locator('text=LydianLights')).toBeVisible();
    await expect(page.locator('text=Greven145')).toBeVisible();
  });

  test('should have white borders on graph panel', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add product to render graph panel
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Close drawer so we can access the graph panel tabs
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await closeBtn.click();

    // Get the production graph tablist (the second one, not the drawer)
    const tabLists = page.locator('[role="tablist"]');
    const graphTabList = tabLists.nth(1);

    const borderColor = await graphTabList.evaluate((el) => {
      return window.getComputedStyle(el).borderBottom;
    });

    // Should have a visible solid border
    expect(borderColor).toMatch(/\d+px solid (rgb|rgba)\(/);
  });

  test('should load page without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add product to trigger calculations
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Should have no critical errors
    const criticalErrors = errors.filter(e =>
      !e.includes('wheel sensitivity') &&
      !e.includes('Infinity') &&
      !e.includes('popperFactory')
    );
    expect(criticalErrors.length).toBe(0);
  });

  test('should preserve weighting options when set to 1', async ({ page }) => {
    await page.goto('/');

    // Open the control panel (drawer starts hidden)
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Weighting options are in the Production tab (default) — ensure it is active
    await page.getByRole('tab', { name: 'Production', exact: true }).click();

    // Get the weighting option inputs
    const resourceEfficiencyInput = page.getByRole('spinbutton', { name: 'Resource Efficiency' });
    const powerEfficiencyInput = page.getByRole('spinbutton', { name: 'Power Efficiency' });
    const complexityInput = page.getByRole('spinbutton', { name: 'Complexity' });
    const buildingsInput = page.getByRole('spinbutton', { name: 'Buildings' });

    // Verify initial values
    const resourceInitial = await resourceEfficiencyInput.inputValue();

    // Resource should default to 1000, others may be 0 or 1
    expect(resourceInitial).toBe('1000');

    // Now set all to 1
    await resourceEfficiencyInput.fill('1');
    await powerEfficiencyInput.fill('1');
    await complexityInput.fill('1');
    await buildingsInput.fill('1');

    // Verify all inputs are at 1
    expect(await resourceEfficiencyInput.inputValue()).toBe('1');
    expect(await powerEfficiencyInput.inputValue()).toBe('1');
    expect(await complexityInput.inputValue()).toBe('1');
    expect(await buildingsInput.inputValue()).toBe('1');

    // Wait a bit
    await page.waitForTimeout(500);

    // Verify they STILL show 1 (not reset or changed)
    expect(await resourceEfficiencyInput.inputValue()).toBe('1');
    expect(await powerEfficiencyInput.inputValue()).toBe('1');
    expect(await complexityInput.inputValue()).toBe('1');
    expect(await buildingsInput.inputValue()).toBe('1');
  });

  test('should save and share factory', async ({ page }) => {
    await page.goto('/');

    // Open the control panel
    const openPanelBtn = page.getByRole('button', { name: 'Open Control Panel' });
    await openPanelBtn.click();

    // Add a product
    const addProductBtn = page.getByRole('button', { name: '+ Add Product' });
    await addProductBtn.click();

    const itemInput = page.getByPlaceholder('Select an item');
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Wait for calculation
    await page.waitForTimeout(500);

    // The Share control now lives in the body FactorySwitcher; close the drawer so
    // it isn't overlapped. With a product selected it must be enabled.
    await page.getByRole('button', { name: 'Close Control Panel' }).click();
    const shareBtn = page.getByRole('button', { name: 'Share', exact: true });
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toBeEnabled();
  });

  test('should send game mode multipliers in the save & share request', async ({ page }) => {
    // Capture the outgoing /share-factory body and return a stub key.
    let sharedBody: any = null;
    await page.route(/\/share-factory$/, async (route) => {
      sharedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { key: 'e2ekey0000000000' } }),
      });
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Open Control Panel' }).click();

    // A production goal is required before sharing.
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByPlaceholder('Select an item').click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();

    // Set the 1.2 Game Mode multipliers (section is gated to the 1.2 version, which is the default).
    await page.getByRole('combobox', { name: 'Recipe Cost Multiplier' }).click();
    await page.getByRole('option', { name: '0.5x', exact: true }).click();
    await page.getByRole('combobox', { name: 'Power Multiplier' }).click();
    await page.getByRole('option', { name: '2x', exact: true }).click();

    // Share moved to the body FactorySwitcher; close the drawer so it isn't overlapped.
    await page.getByRole('button', { name: 'Close Control Panel' }).click();
    await page.getByRole('button', { name: 'Share', exact: true }).click();

    await expect.poll(() => sharedBody).not.toBeNull();
    expect(sharedBody.factoryConfig.gameModeOptions).toEqual({
      recipePartsCost: 0.5,
      powerConsumption: 2,
    });
  });

  test('should restore game mode multipliers from a shared link', async ({ page }) => {
    // The share path resolves the saved config via GET /shared-factories/:key.
    // Return a config carrying non-default multipliers. (The live endpoint is
    // built in a later step; the mock stands in for it.)
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
              gameModeOptions: { recipePartsCost: 0.5, powerConsumption: 2 },
              allowedRecipes: [],
              nodesPositions: [],
            },
          },
        }),
      });
    });

    await page.goto('/?factory=e2ekey0000000000');
    await page.getByRole('button', { name: 'Open Control Panel' }).click();

    // The dropdowns should reflect the saved multipliers, not the defaults.
    await expect(page.getByRole('combobox', { name: 'Recipe Cost Multiplier' })).toHaveValue('0.5x');
    await expect(page.getByRole('combobox', { name: 'Power Multiplier' })).toHaveValue('2x');
  });

  test('applies a somersloop budget and reports the boost usage', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open Control Panel' }).click();

    // A production goal is required for the solver to run.
    await page.getByRole('button', { name: '+ Add Product' }).click();
    await page.getByPlaceholder('Select an item').click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    // Somersloops amplify WHOLE machines, so a target must be large enough that a fully
    // amplified machine reduces resource use — the default 10/min is under a single machine
    // and correctly warrants no sloops. 100/min spans several machines worth of production.
    await page.getByPlaceholder('Amount').fill('100');

    // Give the solver a somersloop budget (section gated to 1.2, the default version).
    // With the default resource-dominant weighting, amplifying halves the ore a step
    // consumes, so the solver should spend sloops.
    const sloopsInput = page.getByRole('spinbutton', { name: 'Somersloops' });
    await sloopsInput.fill('20');
    await page.waitForTimeout(700); // let the debounced auto-solve run

    // Read the plan on the Report tab.
    await page.getByRole('button', { name: 'Close Control Panel' }).click();
    await page.getByRole('tab', { name: 'Report' }).click();

    // The Amplification section and its cards appear only when a budget is set.
    await expect(page.getByRole('heading', { name: 'Amplification' })).toBeVisible();
    const sloopCard = page.getByText('Somersloops Used', { exact: true }).locator('..');
    await expect(sloopCard).toContainText('/ 20');
    // Usage must be > 0 — the solver actually amplified (not just rendered the card).
    await expect(sloopCard).not.toContainText('0 / 20');
  });
});
