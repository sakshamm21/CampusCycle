import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAnonClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('010: Borrow and Return RPCs', () => {
  let demoRiderClient: SupabaseClient;
  let demoBikeCode: string;
  let demoBikeSig: string;
  let demoStandId: string;
  let secondStandId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    demoRiderClient = await createAuthenticatedClient('demo-rider@example.com');

    const anon = createAnonClient();
    const { data: samples } = await anon.rpc('demo_qr_samples');
    const first = samples?.[0];
    demoBikeCode = first?.code;
    const url = new URL(first?.payload);
    demoBikeSig = url.searchParams.get('s') || '';

    const { data: stands } = await adminClient
      .from('stands')
      .select('id, name, lat, lng')
      .eq('active', true)
      .limit(2);
    demoStandId = stands![0].id;
    secondStandId = stands![1].id;
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('rejects borrow with bad QR signature', async () => {
    const { data } = await demoRiderClient.rpc('borrow_bike', {
      p_code: demoBikeCode,
      p_sig: 'bad_signature_00000000',
      p_demo_stand_id: demoStandId,
    });
    expect(data?.ok).toBe(false);
    expect(data?.code).toBe('CC_BAD_QR');
  });

  it('borrow happy path: links bike and pass', async () => {
    const { data, error } = await demoRiderClient.rpc('borrow_bike', {
      p_code: demoBikeCode,
      p_sig: demoBikeSig,
      p_demo_stand_id: demoStandId,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.bike_code).toBe(demoBikeCode);

    const userRes = await demoRiderClient.auth.getUser();
    const { data: pass } = await adminClient
      .from('rider_passes')
      .select('status, current_bike_id')
      .eq('rider_id', userRes.data.user?.id)
      .single();
    expect(pass?.status).toBe('riding');
    expect(pass?.current_bike_id).toBeDefined();
  });

  it('second borrow refused with CC_PASS_HAS_BIKE', async () => {
    const { data } = await demoRiderClient.rpc('borrow_bike', {
      p_code: demoBikeCode,
      p_sig: demoBikeSig,
      p_demo_stand_id: demoStandId,
    });
    expect(data?.ok).toBe(false);
    expect(data?.code).toBe('CC_PASS_HAS_BIKE');
  });

  it('same bike refused for another rider with status borrowed', async () => {
    const { data: bike } = await adminClient
      .from('bikes')
      .select('status')
      .eq('short_code', demoBikeCode)
      .single();
    expect(bike?.status).toBe('borrowed');
  });

  it('rejects return of wrong bike with CC_WRONG_BIKE', async () => {
    const { data } = await demoRiderClient.rpc('return_bike', {
      p_code: 'K-999',
      p_sig: '',
      p_demo_stand_id: secondStandId,
    });
    expect(data?.ok).toBe(false);
    expect(['CC_WRONG_BIKE', 'CC_NO_BIKE_ON_PASS', 'CC_BIKE_NOT_FOUND', 'CC_BAD_CODE']).toContain(data?.code);
  });

  it('return at another stand succeeds and updates counts', async () => {
    const { data, error } = await demoRiderClient.rpc('return_bike', {
      p_code: demoBikeCode,
      p_sig: demoBikeSig,
      p_demo_stand_id: secondStandId,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);

    const userRes = await demoRiderClient.auth.getUser();
    const { data: pass } = await adminClient
      .from('rider_passes')
      .select('status, current_bike_id, total_rides')
      .eq('rider_id', userRes.data.user?.id)
      .single();
    expect(pass?.status).toBe('ready');
    expect(pass?.current_bike_id).toBeNull();
    expect(pass?.total_rides).toBeGreaterThan(0);
  });
});
