import { test, expect } from '@playwright/test';
import { en } from '@campuscycle/shared';
import { signInAsDemoAdmin } from './helpers';

test.describe('A05 scan (phone)', () => {
  test('a typed bike code shows the bike card without the camera', async ({ page }) => {
    await signInAsDemoAdmin(page);
    await page.goto('/scan');

    await page.getByRole('tab', { name: en.a05.tab_bike }).click();
    const manual = page.getByPlaceholder('Type bike code e.g. K-042');
    await manual.fill('k-004');
    await manual.press('Enter');

    await expect(page.getByText('K-004').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Lecture Hall Complex/).first()).toBeVisible();
  });
});
