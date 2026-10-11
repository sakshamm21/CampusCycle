import { describe, it, expect } from 'vitest';
import { adminClient, createAnonClient, createAuthenticatedClient } from './helpers';

describe('000: Database helpers and connection verification', () => {
  it('connects to Supabase and can run health check', async () => {
    const anon = createAnonClient();
    const { data, error } = await anon.rpc('health');
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.time).toBeDefined();
  });

  it('admin client can query colleges and private settings', async () => {
    const { data, error } = await adminClient
      .from('colleges')
      .select('id, short_code')
      .eq('short_code', 'IITK')
      .single();
    expect(error).toBeNull();
    expect(data?.short_code).toBe('IITK');
  });

  it('can authenticate with demo rider account', async () => {
    const rider = await createAuthenticatedClient('demo-rider@example.com');
    const { data: user, error } = await rider.auth.getUser();
    expect(error).toBeNull();
    expect(user.user?.email).toBe('demo-rider@example.com');
  });
});
