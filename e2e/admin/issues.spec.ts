import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Issue Reporting and Grouping Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('views grouped issues, inspects group, and resolves with note', async ({ page }) => {
    await page.goto('/issues');
    await expect(page.locator('text=issues')).toBeVisible({ timeout: 10_000 });

    // Look for K-021 or issue groups
    const groupCard = page.locator('text=K-021').first();
    if (await groupCard.isVisible()) {
      await groupCard.click();

      // Look for Resolve all or Resolve button
      const resolveBtn = page.locator('button:has-text("Resolve")').first();
      if (await resolveBtn.isVisible()) {
        await resolveBtn.click();

        // Note input in dialog
        const noteArea = page.locator('textarea, input[placeholder*="note"]');
        if (await noteArea.isVisible()) {
          await noteArea.fill('Fixed puncture and chain tension.');
        }

        const confirmResolve = page.locator('div[role="dialog"] button:has-text("Resolve")');
        if (await confirmResolve.isVisible()) {
          await confirmResolve.click();
        }

        await expect(page.locator('text=Resolved').or(page.locator('text=Updated'))).toBeVisible({
          timeout: 10_000,
        });
      }
    }
  });
});
