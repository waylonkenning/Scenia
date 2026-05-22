import { test, expect } from '@playwright/test';

test.describe('Sidebar column resizing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
  });

  test('dragging the sidebar divider resizes the asset column and persists after reload', async ({ page }) => {
    const sidebarHeader = page.getByTestId('timeline-sidebar-header');
    const resizeHandle = page.getByTestId('sidebar-resize-handle');

    await expect(sidebarHeader).toBeVisible();
    await expect(resizeHandle).toBeVisible();

    const initialWidth = Math.round(await sidebarHeader.evaluate((el) => el.getBoundingClientRect().width));
    const handleBox = await resizeHandle.boundingBox();
    if (!handleBox) throw new Error('Could not locate the sidebar resize handle');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x + handleBox.width / 2 + 120, handleBox.y + handleBox.height / 2, { steps: 12 });
    await page.mouse.up();

    await expect.poll(async () => Math.round(await sidebarHeader.evaluate((el) => el.getBoundingClientRect().width))).toBeGreaterThan(initialWidth + 80);
    const resizedWidth = Math.round(await sidebarHeader.evaluate((el) => el.getBoundingClientRect().width));

    await page.reload();
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });

    await expect.poll(async () => Math.round(await sidebarHeader.evaluate((el) => el.getBoundingClientRect().width))).toBe(resizedWidth);
  });
});
