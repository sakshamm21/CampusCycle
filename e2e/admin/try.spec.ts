import { test, expect } from '@playwright/test';

test.describe('Public Demo Share Page (/try)', () => {
  test('renders signed-out with 6 QR tiles and working navigation links', async ({ page }) => {
    // Navigate signed out
    await page.goto('/try');

    // 1. Check hero title and lede
    await expect(page.locator('text=campuscycle')).toBeVisible();
    await expect(page.locator('text=Ride it')).toBeVisible();
    await expect(page.locator('text=Run it')).toBeVisible();
    await expect(page.locator('text=Scan it')).toBeVisible();

    // 2. Verify sample QR stickers section
    await expect(page.locator('text=sample bicycle qr stickers')).toBeVisible();

    // Wait for QR images to render
    const qrImages = page.locator('img[alt*="QR Code for bike"]');
    await expect(qrImages.first()).toBeVisible({ timeout: 15_000 });
    const count = await qrImages.count();
    expect(count).toBeGreaterThanOrEqual(6);

    // 3. Verify footer links
    await expect(page.locator('a:has-text("Privacy Policy")')).toBeVisible();
    await expect(page.locator('a:has-text("Delete Account")')).toBeVisible();
  });
});
