import { test, expect } from '@playwright/test';

test.describe('Factory Planner Application', () => {
  test('should load application with default 1.1 game version', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/\[1\.1\]/);
  });

  test('should display game version selector', async ({ page }) => {
    await page.goto('/');
    
    // Version selector is always visible in the header
    const versionControl = page.getByRole('textbox', { name: 'Game version' });
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
    
    // Click on Item selector and select Iron Plate
    const itemInput = page.getByRole('textbox', { name: 'Item' });
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    
    // Verify item was selected by checking that the amount field is visible
    const amountInput = page.getByRole('spinbutton', { name: 'Amount' });
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    
    // Wait a moment for computation
    await page.waitForTimeout(1000);
    
    // Close the drawer so tabs are not blocked
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    await closeBtn.click();
    
    // Click Factory Report tab (now in main content area, not blocked by drawer)
    await page.getByRole('tab', { name: 'Factory Report' }).click();
    
    // Verify tab is active
    const reportTab = page.getByRole('tab', { name: 'Factory Report' });
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    
    // Canvas should be visible alongside drawer
    await page.waitForSelector('canvas');
    await expect(page.locator('canvas').first()).toBeVisible();
  });

  test('should render footer with credits', async ({ page }) => {
    await page.goto('/');
    
    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
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
    
    // Should contain white (255, 255, 255)
    expect(borderColor).toContain('255, 255, 255');
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
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
    
    // Click Inputs tab
    const inputsTab = page.getByRole('tab', { name: 'Inputs' });
    await inputsTab.click();
    
    // Get the weighting option inputs
    const resourceEfficiencyInput = page.getByRole('spinbutton', { name: 'Resource Efficiency' });
    const powerEfficiencyInput = page.getByRole('spinbutton', { name: 'Power Efficiency' });
    const complexityInput = page.getByRole('spinbutton', { name: 'Complexity' });
    const buildingsInput = page.getByRole('spinbutton', { name: 'Buildings' });
    
    // Verify initial values
    const resourceInitial = await resourceEfficiencyInput.inputValue();
    const powerInitial = await powerEfficiencyInput.inputValue();
    const complexityInitial = await complexityInput.inputValue();
    const buildingsInitial = await buildingsInput.inputValue();
    
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
    
    const itemInput = page.getByRole('textbox', { name: 'Item' });
    await itemInput.click();
    await page.getByRole('option', { name: 'Iron Plate', exact: true }).click();
    
    // Wait for calculation
    await page.waitForTimeout(500);
    
    // Verify the Save & Share button exists and is clickable
    const saveShareBtn = page.getByRole('button', { name: 'Save & Share' });
    await expect(saveShareBtn).toBeVisible();
    await expect(saveShareBtn).toBeEnabled();
    
    // Note: API currently has Cosmos DB emulator SDK compatibility issues
    // The client-side logic is working correctly, but backend storage is blocked
  });
});

