import { test, expect } from '@playwright/test';
import { en } from '@campuscycle/shared';
import { expectToast, signInAsDemoAdmin } from './helpers';

test.describe('A08 bikes and A09 labels', () => {
  test('add 2 bikes at Library, print their labels, maintenance, move to Hall 5', async ({ page }) => {
    await signInAsDemoAdmin(page);
    await page.goto('/bikes');

    // add 2 bikes at Library
    await page.getByRole('button', { name: en.a08.add }).click();
    const addDialog = page.getByRole('dialog');
    await addDialog.locator('#add-stand').click();
    await page.getByRole('option', { name: 'Library', exact: true }).click();
    await addDialog.locator('#add-count').fill('2');
    await addDialog.getByRole('button', { name: en.a08.add, exact: true }).click();

    // codes shown, continuing the college prefix sequence
    const added = page.locator('[data-sonner-toast]').filter({ hasText: /Added K-\d{3}, K-\d{3}/ });
    await expect(added).toBeVisible({ timeout: 15_000 });
    const codes = (await added.innerText()).match(/K-\d{3}/g) ?? [];
    expect(codes).toHaveLength(2);
    const [first, second] = codes as [string, string];

    // labels page opens with exactly those two
    await added.getByRole('button', { name: en.a08.print }).click();
    await page.waitForURL(/\/bikes\/labels\?ids=/);
    const labels = page.getByText(en.a09.scan_to_borrow, { exact: true });
    await expect(labels).toHaveCount(2, { timeout: 20_000 });
    await expect(page.getByText(first, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(second, { exact: true }).first()).toBeVisible();

    // put the first into maintenance
    await page.goto(`/bikes?search=${first}`);
    await page.locator('tbody tr').filter({ hasText: first }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('switch').first().click();
    await page.locator('#maint-note').fill('Loose chain');
    await page.getByRole('button', { name: 'Set maintenance' }).click();
    await expectToast(page, `Bike ${first} moved to maintenance`);
    await expect(page.locator('tbody tr').filter({ hasText: first })).toContainText(/maintenance/i);

    // move the second to Hall 5
    await page.goto(`/bikes?search=${second}`);
    await page.locator('tbody tr').filter({ hasText: second }).click();
    await page.getByRole('dialog').getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Hall 5', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click();
    await expectToast(page, `Bike ${second} relocated`);
    await expect(page.locator('tbody tr').filter({ hasText: second })).toContainText('Hall 5');
  });
});
