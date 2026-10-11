import { describe, it, expect, beforeAll } from 'vitest';
import { createAnonClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('120: Extras and Public RPCs', () => {
  let demoAdminClient: SupabaseClient;
  let demoSuperClient: SupabaseClient;

  beforeAll(async () => {
    demoAdminClient = await createAuthenticatedClient('demo-admin@example.com');
    demoSuperClient = await createAuthenticatedClient('demo-super@example.com');
  });

  it('demo_qr_samples is accessible to anon and returns available demo bikes with valid payload format', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.rpc('demo_qr_samples');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThan(0);

    const first = data![0];
    expect(first.code).toMatch(/^[A-Z]{1,3}-[0-9]{3,4}$/);
    expect(first.payload).toMatch(/^campuscycle:\/\/b\/[A-Z]{1,3}-[0-9]{3,4}\?s=[A-Za-z0-9_-]{22}$/);
  });

  it('colleges_overview refused for college admin with CC_FORBIDDEN', async () => {
    const { error } = await demoAdminClient.rpc('colleges_overview');
    expect(error?.message).toContain('CC_FORBIDDEN');
  });

  it('colleges_overview returns one row per college for super admin', async () => {
    const { data, error } = await demoSuperClient.rpc('colleges_overview');
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const iitk = data!.find((c: { short_code: string }) => c.short_code === 'IITK');
    expect(iitk).toBeDefined();
    expect(iitk.stands).toBeGreaterThan(0);
    expect(iitk.bikes).toBeGreaterThan(0);
  });
});
