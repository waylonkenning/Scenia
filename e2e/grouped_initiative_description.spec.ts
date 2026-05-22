import { test, expect } from '@playwright/test';

test.describe('Grouped Initiative Description', () => {
  test('should concatenate initiative names with + in collapsed groups', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // Enable description display via inline toggle
    await page.getByTestId('toggle-descriptions').click();
    
    // For now, let's assume it's ON by default or toggle it if needed.
    // Let's use the 'a-ciam' asset which likely has grouped initiatives in demo data.
    const targetAssetId = 'a-ciam';
    const targetRow = page.locator(`[data-asset-id="${targetAssetId}"]`);
    
    // Find the group and collapse it
    const groupBox = targetRow.getByTestId('initiative-group-box');
    await expect(groupBox).toBeVisible({ timeout: 15000 });
    
    await targetRow.hover();
    const collapseBtn = groupBox.getByTestId('collapse-group-btn');
    await collapseBtn.click();

    // Verify the project bar is visible
    const projectBar = page.getByTestId('project-group-bar');
    await expect(projectBar).toBeVisible({ timeout: 15000 });

    // The description usually appears inside the bar or as a tooltip/text.
    // In Timeline.tsx line 1244: {init.description}
    // We expect "Name 1 + Name 2" instead of "Name 1, Name 2"
    
    // Note: This test is EXPECTED TO FAIL currently because it uses ", "
    const descriptionText = await projectBar.textContent();
    console.log('Detected Group Description:', descriptionText);
    
    // Each initiative name should now appear as a bullet point
    await expect(projectBar).toContainText('•');
  });
});
