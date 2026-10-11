import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('070: Demo Mode Protections & Reset', () => {
  let demoAdminClient: SupabaseClient;
  let collegeId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    demoAdminClient = await createAuthenticatedClient('demo-admin@example.com');
    const { data: col } = await adminClient.from('colleges').select('id').eq('short_code', 'IITK').single();
    collegeId = col!.id;
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('demo admin mutating stand fails with CC_DEMO_READONLY', async () => {
    const { error } = await demoAdminClient.rpc('upsert_stand', {
      p_id: null,
      p_college_id: collegeId,
      p_name: 'Unauthorized Stand',
      p_lat: 26.5,
      p_lng: 80.2,
      p_capacity: 10,
    });
    expect(error?.message).toContain('CC_DEMO_READONLY');
  });

  it('demo admin updating college settings fails with CC_DEMO_READONLY', async () => {
    const { error } = await demoAdminClient.rpc('update_college_settings', {
      p_college_id: collegeId,
      p_name: 'Hacked College',
      p_max_ride_minutes: 100,
      p_strike_limit: 5,
      p_default_geofence_m: 50,
      p_email_domains: ['iitk.ac.in'],
      p_rules_text: 'New rules',
      p_center_lat: 26.5,
      p_center_lng: 80.2,
    });
    expect(error?.message).toContain('CC_DEMO_READONLY');
  });

  it('admin_run_demo_reset restores bikes to home stands and resets state', async () => {
    const { error } = await adminClient.rpc('admin_run_demo_reset');
    expect(error).toBeNull();

    // Verify all demo bikes are available and have current_stand_id set
    const { data: demoBikes } = await adminClient
      .from('bikes')
      .select('status, current_stand_id')
      .eq('is_demo', true);

    expect(demoBikes?.length).toBe(30);
    const available = demoBikes?.filter((b) => b.status === 'available');
    expect(available?.length).toBe(29);
    const maintenance = demoBikes?.filter((b) => b.status === 'maintenance');
    expect(maintenance?.length).toBe(1);
  }, 30000);
});
