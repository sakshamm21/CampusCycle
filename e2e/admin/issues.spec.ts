import { test, expect } from '@playwright/test';
import { en } from '@campuscycle/shared';
import { expectToast, signInAsDemoAdmin } from './helpers';

test.describe('A11 issues', () => {
  test('grouped view shows the K-021 group with 3 reports; resolve all with a note', async ({ page }) => {
    await signInAsDemoAdmin(page);
    await page.goto('/issues');

    const group = page
      .locator('div.rounded-2xl')
      .filter({ has: page.getByRole('heading', { name: 'K-021 brakes' }) });
    await expect(group).toBeVisible({ timeout: 20_000 });
    await expect(group.getByText('3 reports')).toBeVisible();
    await expect(group.getByText(/urgency 5/i)).toBeVisible();

    await group.getByRole('button', { name: en.a11.resolve_all }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox').fill('Brake cable replaced and tested.');
    await dialog.getByRole('button', { name: en.a11.resolve_all }).click();
    await expectToast(page, 'Resolved all 3 issues in group.');

    await expect(page.getByRole('heading', { name: 'K-021 brakes' })).toHaveCount(0, { timeout: 20_000 });
  });
});
