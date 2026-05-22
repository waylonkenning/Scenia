import { test, expect } from '@playwright/test';

/**
 * Application Segment Drag Improvements
 *
 * User Story:
 *   As a user working with application segments, I want to drag segments
 *   vertically to change their row, have the row-control buttons positioned
 *   so they don't block the right-edge resize handle, and see visible
 *   indicators on the left/right edges to know those edges are resizable.
 *
 * Acceptance Criteria:
 *   AC1: Dragging a segment body primarily downward moves it to a lower row
 *   AC2: Dragging a segment body primarily upward moves it to a higher row
 *   AC3: The row-control buttons do not overlap the right-edge resize zone
 *   AC4: Left and right resize edge indicators are present in the DOM
 */
test.describe('Application Segment Drag Improvements', () => {

  /** Navigate to a year with no demo segments so we control the layout. */
  async function goToEmptyYear(page: import('@playwright/test').Page) {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2030-01-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);
  }

  /** Create one segment in the first application swimlane via double-click. */
  async function createSegment(page: import('@playwright/test').Page) {
    const rowContent = page.locator('[data-testid="application-row-content"]').first();
    await rowContent.dblclick({ position: { x: 200, y: 20 } });
    const panel = page.getByTestId('segment-panel');
    await panel.getByRole('button', { name: 'Add Segment' }).click();
    await expect(panel).toBeHidden();
    await expect(page.locator('[data-testid^="segment-bar-"]').first()).toBeVisible();
  }

  // ── AC1: vertical drag down moves segment to a lower row ──────────────────

  test('AC1: dragging segment body downward moves it to a lower row', async ({ page }) => {
    await goToEmptyYear(page);
    await createSegment(page);

    const bar = page.locator('[data-testid^="segment-bar-"]').first();
    const boxBefore = await bar.boundingBox();
    expect(boxBefore).not.toBeNull();

    // Drag from centre of bar straight down by 50px (> 1 row unit of 40px)
    const cx = boxBefore!.x + boxBefore!.width / 2;
    const cy = boxBefore!.y + boxBefore!.height / 2;

    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx, cy + 50, { steps: 8 });
    await page.mouse.up();

    const boxAfter = await bar.boundingBox();
    expect(boxAfter).not.toBeNull();

    // Top position should have increased (segment moved down at least ~30px)
    expect(boxAfter!.y).toBeGreaterThan(boxBefore!.y + 30);
  });

  // ── AC2: vertical drag up moves segment to a higher row ───────────────────

  test('AC2: dragging segment body upward moves it to a higher row', async ({ page }) => {
    await goToEmptyYear(page);
    await createSegment(page);

    const bar = page.locator('[data-testid^="segment-bar-"]').first();

    // First drag it down so there's room to drag up
    let box = await bar.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2 + 50, { steps: 8 });
    await page.mouse.up();

    const boxAtRow1 = await bar.boundingBox();
    expect(boxAtRow1).not.toBeNull();

    // Now drag back up
    await page.mouse.move(boxAtRow1!.x + boxAtRow1!.width / 2, boxAtRow1!.y + boxAtRow1!.height / 2);
    await page.mouse.down();
    await page.mouse.move(boxAtRow1!.x + boxAtRow1!.width / 2, boxAtRow1!.y + boxAtRow1!.height / 2 - 50, { steps: 8 });
    await page.mouse.up();

    const boxAfterUp = await bar.boundingBox();
    expect(boxAfterUp).not.toBeNull();

    // Should have moved back up (top position less than row-1 position)
    expect(boxAfterUp!.y).toBeLessThan(boxAtRow1!.y - 10);
  });

  test('AC2b: dragging or row-moving a relocated segment uses the visible row, not the stored row', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    const startInput = page.getByTestId('timeline-start-input');
    await startInput.fill('2026-01-01');
    await startInput.press('Enter');
    await page.waitForTimeout(300);

    const relocated = page.getByTestId('segment-bar-seg-azuread-sunset');
    await expect(relocated).toBeVisible();
    const before = await relocated.boundingBox();
    expect(before).not.toBeNull();

    // Select the segment and move it down one row. Before the fix, the app used
    // the stale model row (undefined / 0) instead of the visible row, so the bar would
    // not move.
    await relocated.click();
    await expect(page.getByTestId('segment-row-down')).toBeVisible();
    await page.getByTestId('segment-row-down').click();

    await expect.poll(async () => {
      const box = await relocated.boundingBox();
      return Math.round(box!.y);
    }).toBeGreaterThan(Math.round(before!.y) + 30);
  });


  test('AC3: row-control buttons do not overlap the right edge of the segment', async ({ page }) => {
    await goToEmptyYear(page);
    await createSegment(page);

    // Select the segment to show buttons
    const bar = page.locator('[data-testid^="segment-bar-"]').first();
    await bar.click();

    const upBtn = page.locator('[data-testid="segment-row-up"]');
    await expect(upBtn).toBeVisible();

    const segBox = await bar.boundingBox();
    const btnBox = await upBtn.boundingBox();
    expect(segBox).not.toBeNull();
    expect(btnBox).not.toBeNull();

    const segRight = segBox!.x + segBox!.width;
    const btnRight = btnBox!.x + btnBox!.width;

    // The right edge of the buttons must be at least 10px from the right edge of the segment
    // (leaving the resize handle zone clear)
    expect(btnRight).toBeLessThanOrEqual(segRight - 10);
  });

  // ── AC4: left and right resize edge indicators exist in the DOM ───────────

  test('AC4: segment bars have left and right resize edge indicators', async ({ page }) => {
    await goToEmptyYear(page);
    await createSegment(page);

    const bar = page.locator('[data-testid^="segment-bar-"]').first();
    await expect(bar).toBeVisible();

    await expect(bar.locator('[data-testid="segment-resize-left"]')).toHaveCount(1);
    await expect(bar.locator('[data-testid="segment-resize-right"]')).toHaveCount(1);
  });
});
