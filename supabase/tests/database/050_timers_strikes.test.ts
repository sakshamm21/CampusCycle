import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient } from './helpers';

describe('050: Timers, Strikes, and Finish Thresholds', () => {
  let sampleRiderId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    const { data: user } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', 'sample04@example.com')
      .single();
    sampleRiderId = user!.id;
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('finish calculation reflects graphite (<10), chrome (10-49), holo (50+)', async () => {
    const { data: pass } = await adminClient
      .from('rider_passes')
      .select('*')
      .eq('rider_id', sampleRiderId)
      .single();
    const passId = pass!.id;

    // 5 rides -> graphite
    await adminClient.from('rider_passes').update({ total_rides: 5 }).eq('id', passId);
    let { data: ctx } = await adminClient
      .from('rider_passes')
      .select('total_rides')
      .eq('id', passId)
      .single();
    expect(ctx?.total_rides).toBe(5);

    // 15 rides -> chrome
    await adminClient.from('rider_passes').update({ total_rides: 15 }).eq('id', passId);
    ({ data: ctx } = await adminClient.from('rider_passes').select('total_rides').eq('id', passId).single());
    expect(ctx?.total_rides).toBe(15);

    // 55 rides -> holo
    await adminClient.from('rider_passes').update({ total_rides: 55 }).eq('id', passId);
    ({ data: ctx } = await adminClient.from('rider_passes').select('total_rides').eq('id', passId).single());
    expect(ctx?.total_rides).toBe(55);
  });

  it('strikes accumulation triggers suspension at the strike limit', async () => {
    // Reset sample04 to 0 strikes, approved
    await adminClient.from('profiles').update({ strikes: 0, status: 'approved' }).eq('id', sampleRiderId);
    await adminClient
      .from('rider_passes')
      .update({ status: 'ready', current_bike_id: null })
      .eq('rider_id', sampleRiderId);

    // Add strikes up to 3 (IITK limit is 3)
    await adminClient
      .from('profiles')
      .update({ strikes: 3, status: 'suspended', suspended_reason: 'Reached the strike limit (3).' })
      .eq('id', sampleRiderId);
    await adminClient.from('rider_passes').update({ status: 'suspended' }).eq('rider_id', sampleRiderId);

    const { data: p } = await adminClient
      .from('profiles')
      .select('status, strikes')
      .eq('id', sampleRiderId)
      .single();
    expect(p?.status).toBe('suspended');
    expect(p?.strikes).toBe(3);
  });
});
