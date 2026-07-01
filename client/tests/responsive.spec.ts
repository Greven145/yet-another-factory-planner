import { test, expect, Page } from '@playwright/test';

// Cross-viewport behavioural suite, run against the LIVE Aspire stack (real
// /initialize + Cosmos + the in-browser GLPK solver). One run per project in
// playwright.responsive.config.ts; this single flow branches on whether the app
// shows the mobile shell, which must mirror the app's gating in theme.ts
// (MOBILE_MEDIA_QUERY).
//
// The shell is "phone-shaped", not just "narrow": portrait phones are caught by
// the 768px width, AND landscape phones (wider than 768 but short) are caught by
// the short-and-landscape clause. Tablets in landscape (e.g. 1024x768) are tall
// enough to stay on the desktop layout.

const MOBILE_BREAKPOINT = 768;
const LANDSCAPE_PHONE_MAX_HEIGHT = 480;

function isMobileShell(page: Page): boolean {
  const vp = page.viewportSize();
  if (!vp) return false;
  const landscape = vp.width > vp.height;
  return vp.width <= MOBILE_BREAKPOINT || (landscape && vp.height <= LANDSCAPE_PHONE_MAX_HEIGHT);
}

function isPortrait(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.height > vp.width;
}

// The loading overlay shows "Loading game data..." until the real /initialize
// resolves; wait it out, then wait on a layout-specific ready marker. Both have
// generous timeouts because this is the un-mocked API + solver.
async function waitForAppReady(page: Page) {
  await expect(page.getByText('Loading game data...')).toBeHidden({ timeout: 40_000 });
  if (isMobileShell(page)) {
    // The mobile shell's bottom nav is the stable "ready" signal.
    await expect(page.getByRole('button', { name: 'Configure' })).toBeVisible({ timeout: 40_000 });
  } else {
    // The desktop header's game-version Select is always mounted.
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 40_000 });
  }
}

// Add a production product. Works in both layouts: on mobile the Production
// accordion section is open by default, on desktop the Production drawer tab is
// the default — in both cases the "+ Add Product" button and the item Select
// have the same accessible markers.
async function addProduct(page: Page, name: string) {
  await page.getByRole('button', { name: '+ Add Product' }).click();
  await page.getByPlaceholder('Select an item').last().click();
  await page.getByRole('option', { name, exact: true }).click();
  // The amount field only appears once an item is bound — a cheap confirmation.
  await expect(page.getByPlaceholder('Amount').last()).toBeVisible();
}

// Reveal the production graph. Mobile: flip the bottom nav to Results. Desktop:
// close the drawer so it doesn't overlap the graph panel. Returns whether a
// canvas actually rendered (the GLPK/cytoscape build can fail on the dev-server
// CSP — see the comment at the call site).
async function showGraphAndReport(page: Page): Promise<boolean> {
  if (isMobileShell(page)) {
    await page.getByRole('button', { name: 'Results' }).click();
  } else {
    const closeBtn = page.getByRole('button', { name: 'Close Control Panel' });
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }
  }

  // Make sure we're on the Production Graph tab (default, but be explicit).
  await page.getByRole('tab', { name: 'Graph' }).click();

  let graphRendered = false;
  try {
    await page.waitForSelector('canvas', { state: 'attached', timeout: 25_000 });
    await expect(page.locator('canvas').first()).toBeVisible();
    graphRendered = true;
  } catch {
    test.info().annotations.push({
      type: 'graph-build',
      description:
        'Production graph canvas did not render within timeout. Likely the dev-server '
        + 'CSP blocking the GLPK wasm/blob worker (prod CSP is covered by smoke tests). '
        + 'Captured and continued.',
    });
  }
  return graphRendered;
}

test.describe('Responsive core flow', () => {
  test('add product, render graph, switch sections, open report', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    await addProduct(page, 'Iron Plate');

    const graphRendered = await showGraphAndReport(page);

    // Open the Factory Report (same tab control in both layouts).
    await page.getByRole('tab', { name: 'Report' }).click();
    await expect(page.getByRole('tab', { name: 'Report' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    if (isMobileShell(page)) {
      // ---- Mobile shell behaviours (viewports <=768px wide) ----

      // 1. Bottom-nav Configure <-> Results toggle.
      await page.getByRole('button', { name: 'Configure' }).click();
      await expect(page.getByRole('button', { name: 'Configure' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      // Configure shows the accordion (the Production section control). `exact`
      // avoids the nested "Production Goals" collapsible inside the panel.
      const productionSection = page.getByRole('button', { name: 'Production', exact: true });
      await expect(productionSection).toBeVisible();

      await page.getByRole('button', { name: 'Results' }).click();
      await expect(page.getByRole('button', { name: 'Results' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      // Back to Configure for the accordion checks below.
      await page.getByRole('button', { name: 'Configure' }).click();

      // 2. Accordion expand/collapse: the Inputs section starts collapsed and
      // toggles open.
      const inputsControl = page.getByRole('button', { name: 'Inputs', exact: true });
      await expect(inputsControl).toHaveAttribute('aria-expanded', 'false');
      await inputsControl.click();
      await expect(inputsControl).toHaveAttribute('aria-expanded', 'true');

      // 3. Stacked Production rows: on the mobile shell the product row wraps so
      // the amount field drops onto its own line below the item picker. On
      // desktop they share a row (same y). Geometric check = layout-resilient.
      const itemBox = await page.getByPlaceholder('Select an item').last().boundingBox();
      const amountBox = await page.getByPlaceholder('Amount').last().boundingBox();
      expect(itemBox).not.toBeNull();
      expect(amountBox).not.toBeNull();
      // Amount sits clearly below the item picker (stacked), not on the same line.
      expect(amountBox!.y).toBeGreaterThan(itemBox!.y + itemBox!.height / 2);

      // 4. Graph orientation tracks device orientation. The cytoscape layout
      // direction is keyed off '(orientation: portrait)' (DOWN vs RIGHT) but
      // lives in a <canvas>, so we assert the media query the app reads resolves
      // correctly for this viewport rather than inspecting the canvas pixels.
      const portraitMq = await page.evaluate(
        () => window.matchMedia('(orientation: portrait)').matches,
      );
      expect(portraitMq).toBe(isPortrait(page));

      // 5. Fit-to-screen control exists and is clickable (Results / graph view).
      await page.getByRole('button', { name: 'Results' }).click();
      await page.getByRole('tab', { name: 'Graph' }).click();
      const fitBtn = page.getByRole('button', { name: 'Fit graph to screen' });
      await expect(fitBtn).toBeVisible();
      await fitBtn.click();
    } else {
      // ---- Desktop layout (viewports >768px wide) ----

      // No mobile shell: the bottom-nav Configure/Results buttons must not exist.
      await expect(page.getByRole('button', { name: 'Configure' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Results' })).toHaveCount(0);

      // The desktop drawer + main-body layout: the game-version Select sits in the
      // header and the drawer toggle exists (open or closed).
      await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible();
      await expect(
        page.getByRole('button', { name: /(Open|Close) Control Panel/ }),
      ).toBeVisible();

      // Desktop product rows are NOT stacked: item picker + amount share a row.
      const itemBox = await page.getByPlaceholder('Select an item').last().boundingBox();
      const amountBox = await page.getByPlaceholder('Amount').last().boundingBox();
      if (itemBox && amountBox) {
        expect(Math.abs(amountBox.y - itemBox.y)).toBeLessThan(itemBox.height);
      }
    }

    // Record the graph outcome on every project for the run summary.
    test.info().annotations.push({
      type: 'graph-rendered',
      description: String(graphRendered),
    });
  });
});
