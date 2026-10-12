import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD, en } from '@campuscycle/shared';

test.describe('A01 sign in', () => {
  test('refuses rider credentials with the CC_NOT_ADMIN copy', async ({ page }) => {
    await page.goto('/sign-in');
    await page.locator('input#email').fill(DEMO_EMAILS.rider);
    await page.locator('input#password').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();

    await expect(page.getByRole('alert').filter({ hasText: en.errors.CC_NOT_ADMIN })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/\/sign-in/);

    // the refused session is gone: the app is still closed
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('demo admin button lands on the dashboard with the demo banner, then signs out', async ({ page }) => {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: en.a01.demo_admin }).click();

    await page.waitForURL('**/dashboard', { timeout: 30_000 });
    await expect(page.getByText(en.common.demo_banner_admin)).toBeVisible();

    await page.goto('/account');
    await page.getByRole('button', { name: en.a18.sign_out }).click();
    await page.waitForURL('**/sign-in', { timeout: 15_000 });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
