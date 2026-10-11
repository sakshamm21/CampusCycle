import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('040: Admin Functions Suite', () => {
  let adminUserClient: SupabaseClient;
  let sampleRiderId: string;
  let collegeId: string;
  let testBikeId: string;
  let testStandId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    adminUserClient = await createAuthenticatedClient('demo-admin@example.com');

    const { data: college } = await adminClient
      .from('colleges')
      .select('id')
      .eq('short_code', 'IITK')
      .single();
    collegeId = college!.id;

    // Use sample02 as test target (sample riders have demo_role = null)
    const { data: sampleRider } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', 'sample02@example.com')
      .single();
    sampleRiderId = sampleRider!.id;

    const { data: stand } = await adminClient
      .from('stands')
      .select('id')
      .eq('college_id', collegeId)
      .limit(1)
      .single();
    testStandId = stand!.id;

    const { data: bike } = await adminClient
      .from('bikes')
      .select('id, short_code')
      .eq('college_id', collegeId)
      .eq('is_demo', true)
      .limit(1)
      .single();
    testBikeId = bike!.id;
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('suspend_rider suspends and reinstate_rider restores status and resets strikes', async () => {
    // Add a strike first
    await adminClient.from('profiles').update({ strikes: 2 }).eq('id', sampleRiderId);

    // Suspend rider
    const { data: suspData, error: suspErr } = await adminUserClient.rpc('suspend_rider', {
      p_user_id: sampleRiderId,
      p_reason: 'Testing policy violation suspension',
    });
    expect(suspErr).toBeNull();
    expect(suspData?.ok).toBe(true);

    const { data: pSusp } = await adminClient
      .from('profiles')
      .select('status')
      .eq('id', sampleRiderId)
      .single();
    expect(pSusp?.status).toBe('suspended');

    // Reinstate rider
    const { data: reinData, error: reinErr } = await adminUserClient.rpc('reinstate_rider', {
      p_user_id: sampleRiderId,
    });
    expect(reinErr).toBeNull();
    expect(reinData?.ok).toBe(true);

    const { data: pRein } = await adminClient
      .from('profiles')
      .select('status, strikes')
      .eq('id', sampleRiderId)
      .single();
    expect(pRein?.status).toBe('approved');
    expect(pRein?.strikes).toBe(0);
  });

  it('reset_strikes sets rider strikes to 0', async () => {
    await adminClient.from('profiles').update({ strikes: 2 }).eq('id', sampleRiderId);

    const { data, error } = await adminUserClient.rpc('reset_strikes', {
      p_user_id: sampleRiderId,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    const { data: p } = await adminClient.from('profiles').select('strikes').eq('id', sampleRiderId).single();
    expect(p?.strikes).toBe(0);
  });

  it('set_bike_maintenance toggles maintenance status', async () => {
    const { data: onData, error: onErr } = await adminUserClient.rpc('set_bike_maintenance', {
      p_bike_id: testBikeId,
      p_on: true,
      p_note: 'Need brake adjustment',
    });
    expect(onErr).toBeNull();
    expect(onData?.ok).toBe(true);

    let { data: bike } = await adminClient.from('bikes').select('status').eq('id', testBikeId).single();
    expect(bike?.status).toBe('maintenance');

    const { data: offData, error: offErr } = await adminUserClient.rpc('set_bike_maintenance', {
      p_bike_id: testBikeId,
      p_on: false,
    });
    expect(offErr).toBeNull();
    expect(offData?.ok).toBe(true);

    ({ data: bike } = await adminClient.from('bikes').select('status').eq('id', testBikeId).single());
    expect(bike?.status).toBe('available');
  });

  it('stand_check_submit reconciles seen and missing bikes', async () => {
    const { data: seenBikes } = await adminClient
      .from('bikes')
      .select('short_code')
      .eq('current_stand_id', testStandId)
      .limit(2);

    const seenCodes = seenBikes?.map((b) => b.short_code) || [];

    const { data, error } = await adminUserClient.rpc('stand_check_submit', {
      p_stand_id: testStandId,
      p_codes: seenCodes,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
  });

  it('auditing: admin operations write to audit_log', async () => {
    const { data: logs } = await adminClient
      .from('audit_log')
      .select('*')
      .eq('college_id', collegeId)
      .order('created_at', { ascending: false })
      .limit(5);

    expect(logs?.length).toBeGreaterThan(0);
  });
});
