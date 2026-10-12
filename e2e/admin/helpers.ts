import { expect, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { DEMO_EMAILS, DEMO_PASSWORD } from '@campuscycle/shared';

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is missing from the root .env`);
  return value;
}

/** Service-role client: test setup and clean-up only, never the thing under test. */
export function serviceClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), NO_SESSION);
}

export function anonClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), NO_SESSION);
}

export async function signIn(page: Page, email: string, password: string = DEMO_PASSWORD) {
  await page.goto('/sign-in');
  await page.locator('input#email').fill(email);
  await page.locator('input#password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
}

export function signInAsDemoAdmin(page: Page) {
  return signIn(page, DEMO_EMAILS.college_admin);
}

/** The newest toast with this text. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.locator('[data-sonner-toast]').filter({ hasText: text }).first()).toBeVisible({
    timeout: 15_000,
  });
}
