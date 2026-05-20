/**
 * User Story: Prevent Duplicate Initiative IDs When Creating New Initiatives
 *
 * Bug: double-clicking a swimlane to create initiatives used to generate
 * counter-based IDs that could collide across remounts.
 *
 * Fix: the ID generator now uses collision-resistant UUIDs, so repeated
 * double-clicks should create distinct initiative IDs every time.
 */

import { test, expect } from '@playwright/test';

test.describe('Duplicate Initiative ID Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Clear all initiatives so no stale IDs from prior runs interfere
    await page.click('button:has-text("Data")');
    await page.waitForSelector('[data-testid="data-manager"]');
    await page.getByTestId('data-manager').getByRole('button', { name: /Initiatives/ }).click();
    await page.getByRole('button', { name: 'Delete all rows for this table' }).click();
    await page.locator('[data-testid="confirm-modal-confirm"]').click();

    // Return to Visualiser
    await page.click('button:has-text("Visualiser")');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });

    // Navigate to a future year where no initiatives or milestones are rendered
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2035-01-01');
    await startInput.press('Enter');
    await page.waitForSelector('[data-testid="asset-row-content"]');
  });

  test('three consecutive double-clicks produce three unique initiative IDs', async ({ page }) => {
    const swimlane = page.locator('[data-testid="asset-row-content"]').first();

    for (let i = 0; i < 3; i++) {
      // Use well-separated x positions to avoid hitting previously-created bars
      await swimlane.dblclick({ position: { x: 60 + i * 150, y: 10 }, force: true });

      // Wait for the Create Initiative panel
      await expect(page.locator('h2:has-text("Create Initiative")')).toBeVisible({ timeout: 8000 });

      // Fill in a name (required by validation) then save
      await page.getByLabel('Initiative Name').fill(`Test Initiative ${i}`);
      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Wait for panel to close
      await expect(page.locator('h2:has-text("Create Initiative")')).toBeHidden({ timeout: 5000 });
    }

    // All three created initiative bars should have distinct IDs
    const bars = page.locator('[data-initiative-id]');
    await expect(bars).toHaveCount(3);

    const ids = await bars.evaluateAll(els => els.map(el => el.getAttribute('data-initiative-id')));
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(3);
  });
});
