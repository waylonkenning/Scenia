import { test, expect } from '@playwright/test';

async function loadDtsTemplate(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('it-initiative-visualiser');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => setTimeout(resolve, 200);
    });
    localStorage.removeItem('scenia-e2e');
    localStorage.setItem('scenia_has_seen_landing', 'true');
  });
  await page.reload();
  await page.waitForSelector('[data-testid="template-picker-modal"]', { timeout: 20000 });
  await page.getByTestId('template-select-with-demo-btn-dts').click();
  await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  const tutorialModal = page.getByTestId('tutorial-modal');
  if (await tutorialModal.isVisible()) {
    await tutorialModal.getByRole('button', { name: 'Close' }).click();
  }
}

/**
 * The Reports view includes a "History Differences" section where
 * the user can select a saved version and run a diff report inline.
 */
test.describe('History Differences report', () => {
  test.beforeEach(async ({ page }) => {
    await loadDtsTemplate(page);
  });

  test('Reports view shows History Differences section', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    await expect(page.getByTestId('report-history-diff')).toBeVisible();
  });

  test('shows empty state when no versions are saved', async ({ page }) => {
    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await expect(section).toBeVisible();
    await expect(section).toContainText('No saved versions');
  });

  test('shows version selector after saving a version', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Test Snapshot');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await expect(section).toBeVisible();
    await expect(section.getByTestId('version-select')).toBeVisible();
    await expect(section).toContainText('Test Snapshot');
  });

  test('running the diff report shows results inline', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Baseline Snapshot');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const initiativeNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalInitiativeName = await initiativeNameInput.inputValue();
    const renamedInitiativeName = `${originalInitiativeName} MODIFIED`;
    await initiativeNameInput.fill(renamedInitiativeName);
    await initiativeNameInput.press('Enter');

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: 'Baseline Snapshot' });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();

    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    await expect(diffResult).toContainText('MODIFIED');
  });

  test('diff report includes asset, programme, and strategy changes', async ({ page }) => {
    await page.getByTestId('nav-history').click();
    await page.getByRole('button', { name: 'Save Current State' }).click();
    await page.fill('input[placeholder="e.g., March 2026 Snapshot"]', 'Category Baseline');
    await page.getByRole('button', { name: 'Save Version' }).click();
    await page.getByTestId('close-version-manager').click();

    await page.getByTestId('nav-data-manager').click();

    await page.getByRole('button', { name: /Assets\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const assetNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalAssetName = await assetNameInput.inputValue();
    const renamedAssetName = `${originalAssetName} ASSET MOD`;
    await assetNameInput.fill(renamedAssetName);
    await assetNameInput.press('Enter');

    await page.getByRole('button', { name: /Programmes\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const programmeNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalProgrammeName = await programmeNameInput.inputValue();
    const renamedProgrammeName = `${originalProgrammeName} PROG MOD`;
    await programmeNameInput.fill(renamedProgrammeName);
    await programmeNameInput.press('Enter');

    await page.getByRole('button', { name: /Strategies\s*\d*/ }).click();
    await page.waitForSelector('input[data-testid^="real-input-name"]', { timeout: 10000 });
    const strategyNameInput = page.locator('input[data-testid^="real-input-name"]').first();
    const originalStrategyName = await strategyNameInput.inputValue();
    const renamedStrategyName = `${originalStrategyName} STRAT MOD`;
    await strategyNameInput.fill(renamedStrategyName);
    await strategyNameInput.press('Enter');

    await page.getByTestId('nav-reports').click();
    await page.getByTestId('report-card-version-history').click();
    const section = page.getByTestId('report-history-diff');
    await section.getByTestId('version-select').selectOption({ label: 'Category Baseline' });
    await section.getByRole('button', { name: 'Run Difference Report' }).click();

    const diffResult = section.getByTestId('diff-result');
    await expect(diffResult).toBeVisible({ timeout: 5000 });
    await expect(diffResult).toContainText('Assets');
    await expect(diffResult).toContainText('Programmes');
    await expect(diffResult).toContainText('Strategies');
    await expect(diffResult).toContainText(`Renamed from "${originalAssetName}" to "${renamedAssetName}"`);
    await expect(diffResult).toContainText(`Renamed from "${originalProgrammeName}" to "${renamedProgrammeName}"`);
    await expect(diffResult).toContainText(`Renamed from "${originalStrategyName}" to "${renamedStrategyName}"`);
  });
});
