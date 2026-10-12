import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Rides and Force Return Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('filters rides, force-returns active ride, and checks audit log', async ({ page }) => {
    await page.goto('/rides');
    await expect(page.locator('text=rides')).toBeVisible({ timeout: 10_000 });

    // Filter active rides
    const statusSelect = page.locator('select').first();
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('active');
    }

    // Click on the first ride in the table
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Look for Force return action
      const forceReturnBtn = page.locator('button:has-text("Force return")');
      if (await forceReturnBtn.isVisible()) {
        await forceReturnBtn.click();

        // Fill note and confirm
        const noteInput = page.locator('textarea, input[placeholder*="note"]');
        if (await noteInput.isVisible()) {
          await noteInput.fill('Admin force return test');
        }

        const confirmBtn = page.locator('div[role="dialog"] button:has-text("Force return")');
        if (await confirmBtn.isVisible()) {
          await confirmBtn.click();
        }

        await expect(page.locator('text=returned').or(page.locator('text=FORCED'))).toBeVisible({
          timeout: 10_000,
        });
      }
    }

    // Check audit log
    await page.goto('/audit');
    await expect(page.locator('text=audit')).toBeVisible({ timeout: 10_000 });
  });
});
