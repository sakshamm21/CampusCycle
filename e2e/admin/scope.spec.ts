import { randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { serviceClient, signIn } from './helpers';

const PASSWORD = 'cc-test-password-2026';

function letters(n: number): string {
  return Array.from(randomBytes(n), (b) => String.fromCharCode(65 + (b % 26))).join('');
}

test.describe('college scope', () => {
  const db = serviceClient();
  let collegeId = '';
  let userId = '';
  let email = '';

  test.beforeAll(async () => {
    const code = `T${letters(4)}`;
    const college = await db
      .from('colleges')
      .insert({
        name: `Test ${code}`,
        short_code: code,
        bike_prefix: `T${letters(2)}`,
        email_domains: ['cctest.example.com'],
        center_lat: 26.505,
        center_lng: 80.205,
      })
      .select('id')
      .single();
    if (college.error) throw new Error(`create college: ${college.error.message}`);
    collegeId = college.data.id;

    email = `t-${randomBytes(5).toString('hex')}@cctest.example.com`;
    const user = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: 'Scope Admin',
        college_id: collegeId,
        phone: '+91 90000 00000',
        roll_number: 'T-0001',
      },
    });
    if (user.error || !user.data.user) throw new Error(`create user: ${user.error?.message}`);
    userId = user.data.user.id;

    // roles are never client-settable, so this needs the service key
    const promoted = await db
      .from('profiles')
      .update({ role: 'college_admin', status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', userId);
    if (promoted.error) throw new Error(`promote: ${promoted.error.message}`);
  });

  test.afterAll(async () => {
    if (userId) {
      await db.from('notifications').delete().eq('data->>user_id', userId);
      await db.auth.admin.deleteUser(userId);
    }
    if (collegeId) await db.from('colleges').delete().eq('id', collegeId);
  });

  test('an admin of another college sees none of IITK’s riders, bikes or rides', async ({ page }) => {
    await signIn(page, email, PASSWORD);

    // riders: only this admin's own college, so no IITK people
    await page.goto('/users');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Scope Admin').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Aanya Sharma')).toHaveCount(0);
    await expect(page.getByText(/@example\.com/)).toHaveCount(0);

    await page.goto('/bikes');
    await expect(page.getByText('Showing 0 of 0 bikes')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/^K-\d{3}$/)).toHaveCount(0);

    await page.goto('/rides');
    await expect(page.getByText('Showing 0 of 0 rides')).toBeVisible({ timeout: 15_000 });

    // the super-admin page does not exist for a college admin
    const res = await page.goto('/colleges');
    expect(res?.status()).toBe(404);
  });
});
