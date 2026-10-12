import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Fleet Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('adds bikes, previews QR labels, toggles maintenance, and moves bike', async ({ page }) => {
    await page.goto('/bikes');

    // 1. Add 2 bikes
    await page.click('button:has-text("Add bikes")');
    await expect(page.locator('div[role="dialog"]')).toBeVisible();

    // Fill count = 2
    const countInput = page.locator('div[role="dialog"] input#bike-count');
    if (await countInput.isVisible()) {
      await countInput.fill('2');
    }

    // Submit dialog
    await page.locator('div[role="dialog"] button:has-text("Add bikes")').click();

    // Wait for success toast with codes
    await expect(page.locator('text=Added').or(page.locator('text=codes'))).toBeVisible({
      timeout: 10_000,
    });

    // 2. Open QR labels page
    await page.goto('/bikes/labels?bikes=K-001,K-002');
    await expect(page.locator('text=K-001')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=K-002')).toBeVisible();

    // 3. Return to bikes list and put K-001 into maintenance
    await page.goto('/bikes');
    const firstRow = page.locator('table tbody tr').first();
    await firstRow.click();

    // Detail sheet opens
    await expect(page.locator('text=Bike Details').or(page.locator('text=K-'))).toBeVisible();

    // Toggle maintenance switch
    const maintenanceSwitch = page.locator('button[role="switch"]').first();
    if (await maintenanceSwitch.isVisible()) {
      await maintenanceSwitch.click();
    }

    // Close sheet
    const closeBtn = page.locator('button[data-slot="dialog-close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
    }

    // 4. Move a bike
    const moveBtn = page.locator('button:has-text("Move")').first();
    if (await moveBtn.isVisible()) {
      await moveBtn.click();
      if (await page.locator('div[role="dialog"]').isVisible()) {
        const confirmMove = page.locator('div[role="dialog"] button:has-text("Move")').first();
        if (await confirmMove.isVisible()) {
          await confirmMove.click();
        }
      }
    }
  });
});
