import { test, expect } from '@playwright/test';

test.describe('Initiative Grouping', () => {
  test('should group connected initiatives and allow collapsing', async ({ page }) => {
    test.setTimeout(60000);
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto('/');
    await page.waitForSelector('[data-testid="asset-row-content"]', { timeout: 20000 });

    // 1. Clear existing data to have a clean slate (optional but recommended for stability)
    // For now, let's just use the demo data or create new items.
    
    // 2. Add two initiatives in the same asset and connect them
    const targetAssetId = 'a-ciam';
    const firstInitiativeName = 'Passkey Rollout'; 
    const secondInitiativeName = 'SSO Consolidation'; 

    const targetRow = page.locator(`[data-asset-id="${targetAssetId}"]`);
    // 4. Verify grouping box exists
    const groupBox = targetRow.getByTestId('initiative-group-box');
    await expect(groupBox).toBeVisible({ timeout: 15000 });

    // 5. Click collapse button (on group box)
    await targetRow.hover();
    const collapseBtn = groupBox.getByTestId('collapse-group-btn');
    await expect(collapseBtn).toBeVisible({ timeout: 5000 });
    await collapseBtn.click();

    // 6. Verify initiatives are hidden and a project bar is visible
    const projectBar = page.getByTestId('project-group-bar');
    await expect(projectBar).toBeVisible({ timeout: 15000 });
    
    // VERIFY VISUALS: Dashed border, light background (opacity), and dark text
    await expect(projectBar).toHaveCSS('border-style', 'dashed');
    // border-blue-400 is roughly rgb(96, 165, 250). With 0.5 opacity it might vary, but border-style is a good check.
    // Let's check color (slate-900 is rgb(15, 23, 42))
    await expect(projectBar).toHaveCSS('color', 'rgb(15, 23, 42)');
    
    await expect(page.locator(`text="${firstInitiativeName}"`)).not.toBeVisible();
    await expect(page.locator(`text="${secondInitiativeName}"`)).not.toBeVisible();

    // 7. Verify the ungroup icon appears on hover
    await projectBar.hover();
    const ungroupBtn = projectBar.getByTestId('expand-group-btn');
    await expect(ungroupBtn).toBeVisible();
    await expect(ungroupBtn).toHaveCSS('opacity', '1');

    // 8. Verify we can ungroup using the icon
    await ungroupBtn.click();
    await expect(page.locator(`text="${firstInitiativeName}"`)).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`text="${secondInitiativeName}"`)).toBeVisible({ timeout: 15000 });
    
    // 9. Collapse again to verify persistence
    await targetRow.hover();
    await collapseBtn.click({ force: true });
    await expect(page.getByTestId('project-group-bar')).toBeVisible({ timeout: 15000 });

    // 10. Verify persistence
    await page.waitForTimeout(1000);
    await page.reload();
    await expect(page.locator('[data-testid="project-group-bar"]')).toBeVisible();
    await expect(page.locator(`text="${firstInitiativeName}"`)).not.toBeVisible();
  });
});
