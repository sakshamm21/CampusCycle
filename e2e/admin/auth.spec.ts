import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Admin Authentication Flow', () => {
  test('refuses rider credentials with CC_NOT_ADMIN copy', async ({ page }) => {
    await page.goto('/sign-in');

    await page.fill('input#email', DEMO_EMAILS.rider);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');

    // Should display non-admin error
    await expect(page.locator('text=This site is for college admins')).toBeVisible({ timeout: 10_000 });
  });

  test('signs in as demo admin, displays demo banner, and signs out', async ({ page }) => {
    await page.goto('/sign-in');

    // Click demo admin button
    await page.click('button:has-text("Demo college admin")');

    // Lands on dashboard
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.locator('text=Demo mode')).toBeVisible();

    // Navigate to account and sign out
    await page.goto('/account');
    await page.click('button:has-text("Sign out")');

    // Should land back on sign-in
    await page.waitForURL('**/sign-in', { timeout: 10_000 });
  });
});
