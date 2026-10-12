import { test, expect } from '@playwright/test';
import { en } from '@campuscycle/shared';

test.describe('/try', () => {
  test('signed out: 6 QR tiles and working links', async ({ page }) => {
    await page.goto('/try');
    await expect(page).toHaveURL(/\/try$/);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('campuscycle');
    await expect(page.getByText(en.try.lede)).toBeVisible();

    const tiles = page.locator('img[alt*="QR Code for bike"]');
    await expect(tiles).toHaveCount(6, { timeout: 20_000 });

    await expect(page.getByRole('link', { name: /Download for Android/ })).toHaveAttribute(
      'href',
      'https://github.com/sakshamm21/CampusCycle/releases/latest',
    );
    await expect(page.getByText(en.try.reset)).toBeVisible();

    await page.getByRole('link', { name: /Privacy/ }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('one-click demo college admin signs in', async ({ page }) => {
    await page.goto('/try');
    await page.getByRole('button', { name: en.a01.demo_admin }).click();
    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByText(en.common.demo_banner_admin)).toBeVisible();
  });
});
