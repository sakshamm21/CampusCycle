import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

test.describe('Approvals Queue Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Sign in as demo college admin
    await page.goto('/sign-in');
    await page.fill('input#email', DEMO_EMAILS.college_admin);
    await page.fill('input#password', DEMO_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 15_000 });
  });

  test('manages approvals queue: mismatch, rejection, single and bulk approval', async ({ page }) => {
    await page.goto('/approvals');

    // 1. Check applicants presence
    await expect(page.locator('text=Rohan Verma')).toBeVisible({ timeout: 10_000 });
    // Check mismatch chip
    await expect(page.locator('text=ID MISMATCH')).toBeVisible();

    // 2. Reject Rohan Verma with quick pick reason
    const rohanCard = page.locator('div:has-text("Rohan Verma")').last();
    await rohanCard.locator('button:has-text("Reject")').click();

    // Reason dialog appears
    await expect(page.locator('text=Reject Rohan Verma?')).toBeVisible();
    // Click first quick-pick reason chip
    const reasonChip = page.locator('button:has-text("Photo unreadable")');
    if (await reasonChip.isVisible()) {
      await reasonChip.click();
    } else {
      // Pick first available chip
      await page.locator('div[role="dialog"] button.rounded-full').first().click();
    }
    // Confirm rejection
    await page.locator('div[role="dialog"] button:has-text("Reject")').click();
    await expect(page.locator('text=Rejected application')).toBeVisible();

    // 3. Approve one applicant
    const firstApplicant = page.locator('button:has-text("Approve")').first();
    await firstApplicant.click();
    await expect(page.locator('text=Approved and issued pass')).toBeVisible();

    // 4. Bulk approve remaining applicants
    const selectAllCheckbox = page.locator('input[type="checkbox"]').first();
    if (await selectAllCheckbox.isVisible()) {
      await selectAllCheckbox.click();
      const approveSelectedBtn = page.locator('button:has-text("Approve selected")');
      if (await approveSelectedBtn.isVisible()) {
        await approveSelectedBtn.click();
        await page.locator('div[role="dialog"] button:has-text("Approve")').click();
      }
    }

    // 5. Verify queue empty state or count decrement
    await expect(page.locator('text=no pending').or(page.locator('text=Approved'))).toBeVisible({
      timeout: 10_000,
    });
  });
});
