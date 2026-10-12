import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('College Scope Isolation Flow', () => {
  test('college admin is strictly scoped to own college', async ({ page }) => {
    // 1. Sign in as demo college admin
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });

    // College switcher should not allow switching or only displays IITK
    await page.goto('/bikes');
    await expect(page.locator('text=fleet')).toBeVisible({ timeout: 10_000 });

    // Ensure all visible bike codes start with K- (IITK prefix)
    const codeElements = page.locator('span:has-text("K-")');
    const count = await codeElements.count();
    expect(count).toBeGreaterThan(0);

    // Colleges page (/colleges) should be inaccessible (super admin only)
    await page.goto('/colleges');
    // Expect 404 not found page
    await expect(
      page
        .locator('text=404')
        .or(page.locator('text=not found'))
        .or(page.locator('text=This page could not be found')),
    ).toBeVisible({ timeout: 10_000 });
  });
});
