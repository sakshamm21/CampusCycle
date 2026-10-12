import { test, expect, type Page } from '@playwright/test';
import { en } from '@campuscycle/shared';
import { expectToast, signInAsDemoAdmin } from './helpers';

function card(page: Page, name: string) {
  return page.locator('div.rounded-card').filter({ has: page.getByLabel(`Select ${name}`) });
}

test.describe('A03 approvals', () => {
  test('mismatch chip, reject with a quick reason, approve one, bulk approve the rest', async ({ page }) => {
    await signInAsDemoAdmin(page);
    await page.goto('/approvals');

    // the four seeded applicants
    const checkboxes = page.getByLabel(/^Select /);
    await expect(checkboxes).toHaveCount(4, { timeout: 15_000 });

    const rohan = card(page, 'Rohan Verma');
    await expect(rohan.getByText('ID MISMATCH')).toBeVisible();
    await expect(rohan.getByText(/Rohit Verma/)).toBeVisible();

    // reject with a quick-pick reason
    await rohan.getByRole('button', { name: en.a03.reject }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Reject Rohan Verma?')).toBeVisible();
    await dialog.getByRole('button', { name: en.a03.reasons[1] }).click();
    await expect(dialog.locator('#dialog-reason')).toHaveValue(en.a03.reasons[1]);
    await dialog.getByRole('button', { name: en.a03.reject, exact: true }).click();
    await expect(checkboxes).toHaveCount(3, { timeout: 15_000 });
    await expect(card(page, 'Rohan Verma')).toHaveCount(0);

    // approve one
    await card(page, 'Ishaan Gupta').getByRole('button', { name: en.a03.approve, exact: true }).click();
    await expect(checkboxes).toHaveCount(2, { timeout: 15_000 });

    // bulk approve the rest
    await page.getByRole('button', { name: 'Select all visible' }).click();
    await page.getByRole('button', { name: `${en.a03.approve_selected} (2)` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve', exact: true }).click();
    await expectToast(page, '2 riders approved');

    await expect(page.getByText(en.a03.empty)).toBeVisible({ timeout: 15_000 });
  });
});
