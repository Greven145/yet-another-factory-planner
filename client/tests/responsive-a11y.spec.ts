import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Responsive a11y scan against the LIVE stack. The config runs every spec under
// all seven viewport projects, but a WCAG scan only needs one representative
// mobile and one desktop viewport, so the test skips on the other projects.
const SCANNED_PROJECTS = ['mobile-portrait', 'desktop-fhd'];

const MOBILE_BREAKPOINT = 768;

function isMobileShell(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width <= MOBILE_BREAKPOINT;
}

// Mirror a11y.spec.ts: WCAG 2.0 A/AA, canvas excluded (the graph is a separate
// tracked follow-up). Headless WebKit's colour management produces flaky
// color-contrast results, so that one rule is dropped on WebKit only — all
// projects here are Chromium-based, but the guard is kept for parity.
function buildScan(page: Page) {
  const builder = new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('canvas');

  if (test.info().project.name === 'webkit') {
    builder.disableRules(['color-contrast']);
  }

  return builder;
}

async function waitForAppReady(page: Page) {
  await expect(page.getByText('Loading game data...')).toBeHidden({ timeout: 40_000 });
  if (isMobileShell(page)) {
    await expect(page.getByRole('button', { name: 'Configure' })).toBeVisible({ timeout: 40_000 });
  } else {
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 40_000 });
  }
}

test.describe('Responsive accessibility (WCAG 2.0 A/AA)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !SCANNED_PROJECTS.includes(test.info().project.name),
      'a11y scan runs only on the representative mobile + desktop viewports',
    );

    // Freeze transitions/animations and pin a deterministic colour scheme so axe
    // never samples an element mid-fade (mirrors a11y.spec.ts).
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    await page.addInitScript(() => {
      const style = document.createElement('style');
      style.textContent =
        '*,*::before,*::after{transition:none!important;animation:none!important;}';
      document.documentElement.appendChild(style);
    });
  });

  test('initial page load has no WCAG A/AA violations', async ({ page }) => {
    await page.goto('/');
    await waitForAppReady(page);

    const results = await buildScan(page).analyze();

    expect(results.violations).toEqual([]);
  });
});
