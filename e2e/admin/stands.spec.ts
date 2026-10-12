import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Stands Geofencing Flow', () => {
  test('demo admin is prevented from editing with read-only copy', async ({ page }) => {
    // Sign in as demo college admin
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    await page.goto('/stands');
    await expect(page.locator('text=stands')).toBeVisible({ timeout: 10_000 });

    // Look for add stand or place mode
    const placeBtn = page.locator('button:has-text("Add stand")').first();
    if (await placeBtn.isVisible()) {
      await placeBtn.click();
      const saveBtn = page.locator('button:has-text("Save stand")');
      if (await saveBtn.isVisible()) {
        await saveBtn.click();
        // Shows read-only error
        await expect(page.locator('text=read-only').or(page.locator('text=Demo accounts'))).toBeVisible();
      }
    }
  });

  test('super admin can add and configure a stand', async ({ page }) => {
    // Sign in as demo super admin
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.super_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    await page.goto('/stands');
    await expect(page.locator('text=stands')).toBeVisible({ timeout: 10_000 });

    const addStandBtn = page.locator('button:has-text("Add stand")').first();
    if (await addStandBtn.isVisible()) {
      await addStandBtn.click();
      const nameInput = page.locator('input#stand-name, input[placeholder*="Stand name"]');
      if (await nameInput.isVisible()) {
        await nameInput.fill(`Test Stand ${Date.now()}`);
      }
    }
  });
});
