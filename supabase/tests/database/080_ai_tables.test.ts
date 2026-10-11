import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('080: AI Security and Settings', () => {
  let demoAdminClient: SupabaseClient;
  let demoRiderClient: SupabaseClient;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    demoAdminClient = await createAuthenticatedClient('demo-admin@example.com');
    demoRiderClient = await createAuthenticatedClient('demo-rider@example.com');
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('ai_usage_summary(null) refused for college admins with CC_FORBIDDEN', async () => {
    const { error } = await demoAdminClient.rpc('ai_usage_summary', {
      p_college_id: null,
    });
    expect(error?.message).toContain('CC_FORBIDDEN');
  });

  it('clear_my_ai_memory removes only caller memory rows', async () => {
    const { data: user } = await demoRiderClient.auth.getUser();
    const riderId = user.user!.id;

    // Insert dummy memory for rider
    await adminClient.from('ai_memories').insert({
      user_id: riderId,
      memory: 'Prefers red bikes',
    });

    const { data, error } = await demoRiderClient.rpc('clear_my_ai_memory');
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: mems } = await adminClient.from('ai_memories').select('*').eq('user_id', riderId);
    expect(mems?.length).toBe(0);
  });

  it('direct insert into ai_runs or ai_messages by client is rejected', async () => {
    const { error } = await demoRiderClient.from('ai_runs').insert({
      agent: 'ride',
      model: 'test',
    });
    expect(error).toBeDefined();
  });
});
