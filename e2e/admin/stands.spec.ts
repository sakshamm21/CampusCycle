import { test, expect, type Page } from '@playwright/test';
import { en } from '@campuscycle/shared';
import { expectToast, serviceClient, signIn, signInAsDemoAdmin } from './helpers';

/** Add stand → click the map → fill the form → save. */
async function placeStand(page: Page, name: string, at: { x: number; y: number }) {
  await page.goto('/stands');
  await expect(page.getByText('Computer Centre').first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: en.a10.add }).click();
  const canvas = page.locator('.maplibregl-canvas');
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('map canvas has no size');
  await canvas.click({ position: { x: box.width * at.x, y: box.height * at.y } });

  await page.locator('#stand-name').fill(name);
  await expect(page.locator('#stand-lat')).not.toHaveValue('');
  await page.getByRole('button', { name: en.a10.save }).click();
}

test.describe('A10 stands', () => {
  const standName = `E2E Stand ${Date.now()}`;

  test.afterAll(async () => {
    await serviceClient().from('stands').delete().eq('name', standName);
  });

  test('the owner adds a stand by clicking the map', async ({ page }) => {
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (!email || !password) throw new Error('OWNER_EMAIL / OWNER_PASSWORD are missing from the root .env');

    await signIn(page, email, password);
    await placeStand(page, standName, { x: 0.2, y: 0.2 });
    await expectToast(page, 'Stand created.');
    await expect(page.getByText(standName).first()).toBeVisible({ timeout: 15_000 });
  });

  test('a demo admin cannot save: read-only copy', async ({ page }) => {
    await signInAsDemoAdmin(page);
    await placeStand(page, 'Demo Stand', { x: 0.8, y: 0.45 });
    await expectToast(page, en.errors.CC_DEMO_READONLY);
  });
});
