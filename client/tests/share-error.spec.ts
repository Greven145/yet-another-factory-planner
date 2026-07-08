import { test, expect } from '@playwright/test';

// An invalid or expired (>7-day TTL) ?factory= link must NOT dead-end the app
// with the old full-screen "error connecting to the server x_x" takeover.
// Instead the normal planner loads and an escapable modal explains why the link
// didn't open. See ProductionPlanner/ShareErrorModal + contexts/gameData.

const DEAD_KEY = 'expired00000000000';
// Match the real GET endpoint by its exact key — a broad /shared-factories/
// pattern also swallows Vite's own useGetSharedFactory.ts module request.
const SHARED_GET_ROUTE = new RegExp(`/shared-factories/${DEAD_KEY}$`);

test.describe('Invalid / expired share link', () => {
  test.beforeEach(async ({ page }) => {
    // The share GET 404s, exactly as it would for a key past its Cosmos TTL.
    await page.route(SHARED_GET_ROUTE, async (route) => {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'not found' }) });
    });
  });

  test('loads the normal planner and surfaces a cohesive modal, not a dead-end', async ({ page }) => {
    await page.goto(`/?factory=${DEAD_KEY}`);

    // The real app loads — the planner chrome is present, not a blocking overlay.
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible({ timeout: 30_000 });

    // The old dead-end must be gone.
    await expect(page.getByText(/error occurred connecting to the server/i)).toHaveCount(0);

    // The cohesive explanation is shown, including the 7-day validity.
    const dialog = page.getByRole('dialog', { name: /Shared factory not found/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/valid for/i)).toContainText('7 days');

    // It's escapable: Continue drops straight into the loaded factory.
    await dialog.getByRole('button', { name: 'Continue' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Game version' })).toBeVisible();
  });

  test('strips the dead ?factory= key so a refresh does not retry it', async ({ page }) => {
    await page.goto(`/?factory=${DEAD_KEY}`);
    await expect(page.getByRole('dialog', { name: /Shared factory not found/i })).toBeVisible({ timeout: 30_000 });
    // The URL no longer carries the dead key.
    await expect.poll(() => new URL(page.url()).searchParams.get('factory')).toBeNull();
  });
});
