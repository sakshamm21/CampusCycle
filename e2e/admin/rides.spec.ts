import { test, expect } from '@playwright/test';
import { DEMO_EMAILS, DEMO_PASSWORD, en } from '@campuscycle/shared';
import { anonClient, expectToast, signInAsDemoAdmin } from './helpers';

test.describe('A07 rides', () => {
  let rideId = '';
  let bikeCode = '';

  // The demo data has no ride in progress, so the demo rider borrows one (no GPS needed in the demo).
  test.beforeAll(async () => {
    const rider = anonClient();
    const login = await rider.auth.signInWithPassword({ email: DEMO_EMAILS.rider, password: DEMO_PASSWORD });
    if (login.error) throw new Error(`demo rider sign in: ${login.error.message}`);

    const ctx = await rider.rpc('get_my_context');
    const current = (ctx.data as { ride?: { id: string; bike_code: string } | null } | null)?.ride;
    if (current?.id) {
      rideId = current.id;
      bikeCode = current.bike_code;
      return;
    }

    const samples = await rider.rpc('demo_qr_samples');
    const sample = (samples.data as { code: string; payload: string }[] | null)?.[0];
    if (!sample) throw new Error(`demo_qr_samples: ${samples.error?.message ?? 'no bikes'}`);
    const borrowed = await rider.rpc('borrow_bike', {
      p_code: sample.code,
      p_sig: sample.payload.split('?s=')[1] ?? '',
    });
    const result = borrowed.data as { ok: boolean; code?: string; ride_id?: string } | null;
    if (borrowed.error || !result?.ok) {
      throw new Error(`borrow: ${borrowed.error?.message ?? result?.code}`);
    }
    bikeCode = sample.code;
    const ride = await rider.from('rides').select('id').eq('status', 'active').limit(1).single();
    if (ride.error) throw new Error(`active ride: ${ride.error.message}`);
    rideId = ride.data.id;
  });

  test('filter active rides, force-return with a note, FORCED chip, audit row', async ({ page }) => {
    await signInAsDemoAdmin(page);

    // filter: active only
    await page.goto('/rides');
    await page.getByRole('combobox').filter({ hasText: 'All statuses' }).click();
    await page.getByRole('option', { name: 'Active', exact: true }).click();
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(1, { timeout: 20_000 });
    await expect(rows.first()).toContainText(bikeCode);

    // force return from the ride's sheet
    await rows.first().click();
    await page.getByRole('dialog').getByRole('button', { name: en.a07.force }).click();
    await expect(page.getByText(`Force return ${bikeCode}?`)).toBeVisible();
    await page.locator('#force-note').fill('Bike left outside the stand');
    await page.getByRole('button', { name: en.a07.force, exact: true }).last().click();
    await expectToast(page, `Bike ${bikeCode} returned successfully`);

    // the ride now shows FORCED
    await page.goto(`/rides?ride=${rideId}`);
    await expect(page.getByText('FORCED').first()).toBeVisible({ timeout: 20_000 });

    // and the audit log has the action
    await page.goto('/audit');
    await expect(page.getByText('ride.force_return').first()).toBeVisible({ timeout: 20_000 });
  });
});
