import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

const MOCK_FILE = path.join(process.cwd(), 'e2e', 'mock-parallel-arrows.xlsx');

async function loadArrowScenario(page: any) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 10000 });
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  const fc = await fileChooserPromise;
  await fc.setFiles(MOCK_FILE);
  const modal = page.locator('.import-preview-modal');
  await expect(modal).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Merge Data' }).click();
  await expect(modal).toBeHidden();
  await page.waitForSelector('g.cursor-pointer.group', { timeout: 10000 });
}

test.describe('Dependency Arrow Z-Index', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dependencies-svg"]', { timeout: 10000 });
  });

  test('dependency SVG z-index is above initiative bar hover z-index', async ({ page }) => {
    const svgZIndex = await page.locator('[data-testid="dependencies-svg"]').evaluate(
      el => parseInt(window.getComputedStyle(el).zIndex) || 0
    );
    expect(svgZIndex).toBeGreaterThan(20);
  });

  test('dependency arrows are visually above a hovered initiative bar', async ({ page }) => {
    await page.waitForSelector('[data-testid^="initiative-bar"]', { timeout: 10000 });
    const bar = page.locator('[data-testid^="initiative-bar"]').first();
    await bar.hover();

    const [svgZ, barZ] = await Promise.all([
      page.locator('[data-testid="dependencies-svg"]').evaluate(
        el => parseInt(window.getComputedStyle(el).zIndex) || 0
      ),
      bar.evaluate(el => parseInt(window.getComputedStyle(el).zIndex) || 0),
    ]);

    expect(svgZ).toBeGreaterThan(barZ);
  });
});

test.describe('Arrow Label Tooltip', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="dep-label-rect"]', { timeout: 10000 });
  });

  test('clicking a dependency label shows a tooltip with the relationship sentence', async ({ page }) => {
    await page.locator('[data-testid="dep-label-rect"]').first().click();
    const tooltip = page.locator('[data-testid="arrow-label-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 3000 });

    const text = await tooltip.textContent();
    expect(text).toBeTruthy();
    expect(text!.length).toBeGreaterThan(20);
    expect(text).toMatch(/must finish before|requires .+ to finish|are related/i);
  });

  test('clicking the tooltip dismisses it', async ({ page }) => {
    await page.locator('[data-testid="dep-label-rect"]').first().click();
    const tooltip = page.locator('[data-testid="arrow-label-tooltip"]');
    await expect(tooltip).toBeVisible({ timeout: 3000 });
    await tooltip.click();
    await expect(tooltip).toBeHidden();
  });

  test('clicking the label does not open the dependency edit panel', async ({ page }) => {
    await page.locator('[data-testid="dep-label-rect"]').first().click();
    await expect(page.locator('[data-testid="arrow-label-tooltip"]')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('[data-testid="dependency-panel"]')).toBeHidden();
  });
});

test.describe('Arrow Selection — stagger & disambiguation', () => {
  test.beforeAll(() => {
    const wb = XLSX.utils.book_new();
    const initiatives = [
      { id: 'arr-a', name: 'Arrow Source',     programmeId: 'prog-dtp', assetId: 'a-pam', startDate: '2026-01-01', endDate: '2026-01-31', capex: 0, opex: 0 },
      { id: 'arr-b', name: 'Arrow Target One', programmeId: 'prog-dtp', assetId: 'a-pam', startDate: '2026-03-01', endDate: '2026-03-31', capex: 0, opex: 0 },
      { id: 'arr-c', name: 'Arrow Target Two', programmeId: 'prog-dtp', assetId: 'a-pam', startDate: '2026-03-01', endDate: '2026-03-31', capex: 0, opex: 0 },
    ];
    const dependencies = [
      { id: 'dep-ab', sourceId: 'arr-a', targetId: 'arr-b', type: 'requires' },
      { id: 'dep-ac', sourceId: 'arr-a', targetId: 'arr-c', type: 'requires' },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(initiatives), 'Initiatives');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dependencies), 'Dependencies');
    fs.writeFileSync(MOCK_FILE, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  });

  test.afterAll(() => {
    if (fs.existsSync(MOCK_FILE)) fs.unlinkSync(MOCK_FILE);
  });

  test('parallel arrows in same corridor have different midX (auto-stagger)', async ({ page }) => {
    test.setTimeout(60000);
    await loadArrowScenario(page);

    const paths = await page.locator('g.cursor-pointer.group path[stroke]:not([stroke="transparent"])').all();
    const dValues = await Promise.all(paths.map(p => p.getAttribute('d')));

    const midXValues = dValues
      .filter(Boolean)
      .map(d => {
        const parts = d!.split(' ');
        return parts.length >= 5 ? parseFloat(parts[4]) : null;
      })
      .filter(v => v !== null) as number[];

    expect(midXValues.length).toBeGreaterThanOrEqual(2);
    const unique = new Set(midXValues.map(v => Math.round(v)));
    expect(unique.size).toBeGreaterThan(1);
  });

  test('clicking near overlapping arrows shows disambiguation popover or edit panel', async ({ page }) => {
    test.setTimeout(60000);
    await loadArrowScenario(page);

    const depAbPath = page.locator('g[data-dep-id="dep-ab"] path').first();
    await expect(depAbPath).toBeVisible({ timeout: 10000 });
    await depAbPath.click({ force: true });

    const disambiguatorVisible = await page.locator('[data-testid="arrow-disambiguator"]').isVisible().catch(() => false);
    const editPanelVisible = await page.locator('[data-testid="dependency-panel"]').isVisible().catch(() => false);

    expect(disambiguatorVisible || editPanelVisible).toBe(true);
  });

  test('moved arrow should not intercept clicks in a different corridor', async ({ page }) => {
    test.setTimeout(60000);
    await loadArrowScenario(page);

    const depAbGroup = page.locator('g[data-dep-id="dep-ab"]');
    const depAcGroup = page.locator('g[data-dep-id="dep-ac"]');
    const depAbVisiblePath = depAbGroup.locator('path[stroke]:not([stroke="transparent"])').first();
    const depAcVisiblePath = depAcGroup.locator('path[stroke]:not([stroke="transparent"])').first();

    await expect(depAbVisiblePath).toBeVisible({ timeout: 10000 });
    await expect(depAcVisiblePath).toBeVisible({ timeout: 10000 });

    // Move dep-ab away horizontally.
    const depAbBox = await depAbGroup.boundingBox();
    if (!depAbBox) throw new Error('No bounding box for dep-ab');
    await page.mouse.move(depAbBox.x + depAbBox.width / 2, depAbBox.y + depAbBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(depAbBox.x + depAbBox.width / 2 + 140, depAbBox.y + depAbBox.height / 2, { steps: 12 });
    await page.mouse.up();

    const depAcScreenPoint = await depAcVisiblePath.evaluate(el => {
      const pathEl = el as unknown as SVGPathElement;
      const d = pathEl.getAttribute('d');
      if (!d) throw new Error('Missing dependency path d attribute');
      const nums = Array.from(d.matchAll(/-?\d+(?:\.\d+)?/g)).map(m => Number(m[0]));
      if (nums.length < 8) throw new Error(`Unexpected path format: ${d}`);
      const localPoint = { x: (nums[4] + nums[6]) / 2, y: nums[5] };
      const ctm = (pathEl as unknown as SVGGraphicsElement).getScreenCTM();
      if (!ctm) throw new Error('Missing screen CTM for dependency path');
      const screenPoint = new DOMPoint(localPoint.x, localPoint.y).matrixTransform(ctm);
      return { x: screenPoint.x, y: screenPoint.y };
    });

    const depAcGroupBox = await depAcGroup.boundingBox();
    if (!depAcGroupBox) throw new Error('Missing dep-ac group bounding box');

    await depAcGroup.click({ position: {
      x: depAcScreenPoint.x - depAcGroupBox.x,
      y: depAcScreenPoint.y - depAcGroupBox.y,
    } });

    const disambiguator = page.locator('[data-testid="arrow-disambiguator"]');
    const panel = page.locator('[data-testid="dependency-panel"]');

    if (await disambiguator.isVisible().catch(() => false)) {
      const options = disambiguator.locator('[data-testid="disambiguator-item"]');
      await expect(options).toHaveCount(1);
      await options.first().click();
    }

    await expect(panel).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="dep-target-name"]')).toContainText('Arrow Target Two');
  });

  test('clicking a specific arrow opens the correct dependency panel', async ({ page }) => {
    test.setTimeout(60000);
    await loadArrowScenario(page);

    const depAbPath = page.locator('g[data-dep-id="dep-ab"] path').first();
    await expect(depAbPath).toBeVisible({ timeout: 10000 });
    await depAbPath.click({ force: true });

    const disambiguator = page.locator('[data-testid="arrow-disambiguator"]');
    const disambiguatorVisible = await disambiguator.isVisible().catch(() => false);
    if (disambiguatorVisible) {
      await expect(disambiguator).toContainText('Arrow Source');
      await disambiguator.locator('[data-testid="disambiguator-item"]').first().click();
    }
    await expect(page.locator('[data-testid="dependency-panel"]')).toBeVisible({ timeout: 5000 });
  });
});
