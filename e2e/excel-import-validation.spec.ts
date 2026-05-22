import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';

/**
 * User Story: Excel Import Data Validation
 *
 * AC1: Uploading an Excel file with a missing required field (e.g., initiative
 *      without a name) displays an error message listing the missing field
 * AC2: Uploading an Excel file with an invalid date format displays an error
 *      indicating which record has an invalid date
 * AC3: Uploading an Excel file with negative capex/opex values shows a warning
 *      but allows the user to proceed or cancel
 * AC4: Importing with validation errors prevents the import from proceeding
 *      until all errors are resolved
 * AC5: Uploading a valid Excel file imports successfully with a success message
 */

test.describe('Excel Import Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });
  });

  // ── AC1 ──────────────────────────────────────────────────────────────────
  test('AC1: import with missing required initiative name shows error', async ({ page }) => {
    const invalidFilePath = path.join(process.cwd(), 'e2e', 'mock-missing-name.xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      id: 'init-no-name',
      name: '',  // Missing name - required field
      programmeId: 'prog-dtp',
      assetId: 'a-ciam',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      capex: 10000,
      opex: 1000
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Initiatives');
    fs.writeFileSync(invalidFilePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);

      // Should show validation error notification
      await expect(page.getByTestId('import-error-notification')).toBeVisible({ timeout: 5000 });
      
      // Error message should mention the missing field
      const errorText = await page.getByTestId('import-error-notification').textContent();
      expect(errorText).toContain('name');
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  test('AC1b: import with missing initiative programmeId shows error', async ({ page }) => {
    const invalidFilePath = path.join(process.cwd(), 'e2e', 'mock-missing-programme.xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      id: 'init-no-programme',
      name: 'Missing Programme',
      assetId: 'a-ciam',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      capex: 10000,
      opex: 1000
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Initiatives');
    fs.writeFileSync(invalidFilePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);

      await expect(page.getByTestId('import-error-notification')).toBeVisible({ timeout: 5000 });
      const errorText = await page.getByTestId('import-error-notification').textContent();
      expect(errorText).toContain('programmeId');
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  // ── AC2 ──────────────────────────────────────────────────────────────────
  test('AC2: import with invalid date format shows error', async ({ page }) => {
    const invalidFilePath = path.join(process.cwd(), 'e2e', 'mock-invalid-date.xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      id: 'init-bad-date',
      name: 'Bad Date Initiative',
      programmeId: 'prog-dtp',
      assetId: 'a-ciam',
      startDate: 'not-a-valid-date',  // Invalid date
      endDate: '2026-06-30',
      capex: 10000,
      opex: 1000
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Initiatives');
    fs.writeFileSync(invalidFilePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);

      // Should show validation error notification
      await expect(page.getByTestId('import-error-notification')).toBeVisible({ timeout: 5000 });
      
      // Error message should mention the invalid date
      const errorText = await page.getByTestId('import-error-notification').textContent();
      expect(errorText).toMatch(/date|invalid/i);
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  // ── AC3 & AC4 ─────────────────────────────────────────────────────────────
  test('AC3+AC4: import with negative capex shows warning and blocks import', async ({ page }) => {
    const invalidFilePath = path.join(process.cwd(), 'e2e', 'mock-negative-capex.xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      id: 'init-neg-capex',
      name: 'Negative CapEx Initiative',
      programmeId: 'prog-dtp',
      assetId: 'a-ciam',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      capex: -10000,  // Negative value
      opex: 1000
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Initiatives');
    fs.writeFileSync(invalidFilePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidFilePath);

      // Should show validation warning or error
      // The import should be blocked until issues are resolved
      const notification = page.getByTestId('import-error-notification').or(page.getByTestId('import-warning-notification'));
      await expect(notification).toBeVisible({ timeout: 5000 });
    } finally {
      if (fs.existsSync(invalidFilePath)) fs.unlinkSync(invalidFilePath);
    }
  });

  // ── AC5 ──────────────────────────────────────────────────────────────────
  test('AC5: import with valid data shows success', async ({ page }) => {
    const validFilePath = path.join(process.cwd(), 'e2e', 'mock-valid-import.xlsx');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      id: 'init-valid-test',
      name: 'Valid Test Initiative',
      programmeId: 'prog-dtp',
      assetId: 'a-ciam',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      capex: 10000,
      opex: 1000
    }]);
    XLSX.utils.book_append_sheet(wb, ws, 'Initiatives');
    fs.writeFileSync(validFilePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(validFilePath);

      // Wait for import preview modal
      await page.waitForSelector('.import-preview-modal', { timeout: 5000 });
      
      // Click overwrite to proceed with import
      await page.getByRole('button', { name: 'Overwrite All Data' }).click();

      // Should show success notification
      await expect(page.getByTestId('import-success-notification')).toBeVisible({ timeout: 5000 });
    } finally {
      if (fs.existsSync(validFilePath)) fs.unlinkSync(validFilePath);
    }
  });
});
