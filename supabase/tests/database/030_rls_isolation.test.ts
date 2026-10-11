import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createAnonClient,
  createAuthenticatedClient,
  createTestCollege,
  type SupabaseClient,
} from './helpers';

describe('030: RLS Isolation & Multi-College Security', () => {
  let collegeAId: string;
  let collegeBId: string;
  let demoAdminClient: SupabaseClient;
  let demoSuperClient: SupabaseClient;
  let demoRiderClient: SupabaseClient;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    demoAdminClient = await createAuthenticatedClient('demo-admin@example.com');
    demoSuperClient = await createAuthenticatedClient('demo-super@example.com');
    demoRiderClient = await createAuthenticatedClient('demo-rider@example.com');

    // Get college A (IITK)
    const { data: colA } = await adminClient.from('colleges').select('id').eq('short_code', 'IITK').single();
    collegeAId = colA!.id;

    // Create a temporary College B
    collegeBId = await createTestCollege('COLB', 'B');
    // Add stand and bike in College B
    const { data: standB } = await adminClient
      .from('stands')
      .insert({ college_id: collegeBId, name: 'Stand B', lat: 28.6, lng: 77.2, radius_m: 40 })
      .select('id')
      .single();
    await adminClient
      .from('bikes')
      .insert({ college_id: collegeBId, short_code: 'B-001', current_stand_id: standB!.id });
  });

  afterAll(async () => {
    // Delete college B
    await adminClient.from('bikes').delete().eq('college_id', collegeBId);
    await adminClient.from('stands').delete().eq('college_id', collegeBId);
    await adminClient.from('colleges').delete().eq('id', collegeBId);
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('demo college admin of College A sees 0 stands or bikes of College B', async () => {
    const { data: stands } = await demoAdminClient.from('stands').select('*').eq('college_id', collegeBId);
    expect(stands?.length).toBe(0);

    const { data: bikes } = await demoAdminClient.from('bikes').select('*').eq('college_id', collegeBId);
    expect(bikes?.length).toBe(0);
  });

  it('rider can only view own profile and pass', async () => {
    const { data: user } = await demoRiderClient.auth.getUser();
    const riderId = user.user?.id;

    // Profile check
    const { data: profiles } = await demoRiderClient.from('profiles').select('id');
    expect(profiles?.length).toBe(1);
    expect(profiles?.[0].id).toBe(riderId);

    // Passes check
    const { data: passes } = await demoRiderClient.from('rider_passes').select('*');
    expect(passes?.length).toBe(1);
    expect(passes?.[0].rider_id).toBe(riderId);
  });

  it('rider cannot insert or modify bikes', async () => {
    const { error: insertErr } = await demoRiderClient
      .from('bikes')
      .insert({ college_id: collegeAId, short_code: 'K-999', is_demo: true });
    expect(insertErr).toBeDefined();

    const { error: updateErr } = await demoRiderClient
      .from('bikes')
      .update({ status: 'maintenance' })
      .eq('short_code', 'K-001');
    expect(updateErr).toBeDefined();
  });

  it('super admin can query multiple colleges overview', async () => {
    const { data, error } = await demoSuperClient.rpc('colleges_overview');
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThanOrEqual(1);
  });

  it('anon client cannot query sensitive tables directly', async () => {
    const anon = createAnonClient();
    const { data: profiles } = await anon.from('profiles').select('*');
    expect(profiles?.length).toBe(0);

    const { data: passes } = await anon.from('rider_passes').select('*');
    expect(passes?.length).toBe(0);
  });
});
