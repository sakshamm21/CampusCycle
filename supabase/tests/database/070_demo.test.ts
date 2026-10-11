import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createAnonClient,
  createTestUser,
  createWorld,
  deleteTestUser,
  DEMO,
  DEMO_PASSWORD,
  demoSession,
  freshSession,
  IITK_ID,
  must,
  ok,
  passOf,
  raised,
  refused,
  resetDemo,
  row,
  sigOf,
  type SupabaseClient,
  type TestUser,
  type World,
} from './helpers';

describe('070: Demo Mode Protections & Reset', () => {
  let world: World;
  let realIitk: TestUser;
  let demoRider: { id: string; client: SupabaseClient };
  let demoAdmin: SupabaseClient;
  let demoSuper: SupabaseClient;

  const iitkStand = async (name: string): Promise<string> =>
    must(
      await adminClient.from('stands').select('id').eq('college_id', IITK_ID).eq('name', name).single(),
      `stand ${name}`,
    ).id;
  const demoBike = async (code: string) =>
    must(await adminClient.from('bikes').select('*').eq('short_code', code).single(), `bike ${code}`);

  beforeAll(async () => {
    ok(await resetDemo());
    world = await createWorld({ riders: 1, bikes: 1 });
    realIitk = await createTestUser(IITK_ID, { name: 'Real IITK Applicant', login: false });
    demoRider = await demoSession('rider');
    demoAdmin = (await demoSession('admin')).client;
    demoSuper = (await demoSession('super')).client;
  });

  afterAll(async () => {
    if (realIitk) await deleteTestUser(realIitk.id);
    await world?.destroy();
    await resetDemo();
  });

  it('lets the demo rider borrow and return without any coordinates', async () => {
    const samples: { code: string; stand_name: string; payload: string }[] = ok(
      await createAnonClient().rpc('demo_qr_samples'),
    );
    const sample = samples[0];
    const hall5 = await iitkStand('Hall 5');

    const borrowed = ok(
      await demoRider.client.rpc('borrow_bike', { p_code: sample.code, p_sig: sigOf(sample.payload) }),
    );
    // placed at the stand the bike is recorded at
    expect(borrowed.stand_name).toBe(sample.stand_name);
    expect((await passOf(demoRider.id)).status).toBe('riding');

    const returned = ok(
      await demoRider.client.rpc('return_bike', {
        p_code: sample.code,
        p_sig: sigOf(sample.payload),
        p_demo_stand_id: hall5,
      }),
    );
    expect(returned.end_stand_name).toBe('Hall 5');
    expect(await demoBike(sample.code)).toMatchObject({ status: 'available', current_stand_id: hall5 });
  });

  it('refuses a real rider who sends no coordinates', async () => {
    const bike = world.bikes[0];
    const res = await world.riders[0].client.rpc('borrow_bike', {
      p_code: bike.code,
      p_sig: bike.sig,
      p_demo_stand_id: world.standA.id,
    });
    expect(refused(res)).toBe('CC_NO_LOCATION');
  });

  it('keeps demo accounts away from real rows', async () => {
    const approve = await demoAdmin.rpc('approve_rider', { p_user_id: realIitk.id });
    expect(raised(approve)).toBe('CC_DEMO_FORBIDDEN');
    const reject = await demoAdmin.rpc('reject_rider', { p_user_id: realIitk.id, p_reason: 'Not a student' });
    expect(raised(reject)).toBe('CC_DEMO_FORBIDDEN');
    expect((await row('profiles', realIitk.id)).status).toBe('pending');

    // a real bike of another college does not exist as far as the demo rider is concerned
    const bike = world.bikes[0];
    const res = await demoRider.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig });
    expect(refused(res)).toBe('CC_BIKE_NOT_FOUND');
  });

  it('makes settings, stands, colleges, roles and AI settings read-only in the demo', async () => {
    const before = await row('colleges', IITK_ID);
    const attempts = await Promise.all([
      demoAdmin.rpc('upsert_stand', {
        p_id: null,
        p_college_id: IITK_ID,
        p_name: 'Demo Visitor Stand',
        p_lat: 26.5,
        p_lng: 80.2,
      }),
      demoAdmin.rpc('update_college_settings', {
        p_college_id: IITK_ID,
        p_name: 'Renamed By A Visitor',
        p_max_ride_minutes: 15,
        p_strike_limit: 1,
        p_default_geofence_m: 300,
        p_email_domains: [],
        p_rules_text: '',
      }),
      demoAdmin.rpc('update_ai_settings', { p_college_id: IITK_ID, p_features: { rider_assistant: false } }),
      demoSuper.rpc('create_college', {
        p_name: 'Visitor College',
        p_short_code: 'VISIT',
        p_bike_prefix: 'VV',
        p_email_domains: [],
        p_time_zone: 'Asia/Kolkata',
        p_center_lat: null,
        p_center_lng: null,
      }),
      demoSuper.rpc('set_college_active', { p_college_id: IITK_ID, p_active: false }),
      demoSuper.rpc('set_user_role', { p_user_id: realIitk.id, p_role: 'super_admin' }),
    ]);
    for (const res of attempts) expect(raised(res)).toBe('CC_DEMO_READONLY');

    const after = await row('colleges', IITK_ID);
    expect(after).toMatchObject({
      name: before.name,
      max_ride_minutes: before.max_ride_minutes,
      strike_limit: before.strike_limit,
      active: true,
    });
    const { count: stands } = await adminClient
      .from('stands')
      .select('*', { count: 'exact', head: true })
      .eq('college_id', IITK_ID);
    expect(stands).toBe(10);
    const { data: visitor } = await adminClient.from('colleges').select('id').eq('short_code', 'VISIT');
    expect(visitor).toEqual([]);
    expect((await row('profiles', realIitk.id)).role).toBe('rider');
  });

  it('refuses any change to a demo password', async () => {
    const session = await freshSession(DEMO.rider);
    const { error } = await session.client.auth.updateUser({ password: 'changed-by-a-visitor' });
    expect(error).not.toBeNull();

    const viaAdmin = await adminClient.auth.admin.updateUserById(demoRider.id, {
      password: 'changed-by-a-script',
    });
    expect(viaAdmin.error).not.toBeNull();

    // the public demo password still works
    expect((await freshSession(DEMO.rider, DEMO_PASSWORD)).id).toBe(demoRider.id);
  });

  it('resets everything demo users changed and leaves real rows alone', async () => {
    const mainGate = await iitkStand('Main Gate');
    const hall12 = await iitkStand('Hall 12');
    const k001 = await demoBike('K-001');
    const k004 = await demoBike('K-004');
    expect(k001.current_stand_id).toBe(mainGate);

    // a demo visitor moves a bike, adds one, leaves a ride open and files a report
    ok(await demoAdmin.rpc('move_bike', { p_bike_id: k001.id, p_stand_id: hall12 }));
    const added = ok(
      await demoAdmin.rpc('create_bikes', { p_college_id: IITK_ID, p_stand_id: hall12, p_count: 1 }),
    );
    expect(added.codes).toEqual(['K-031']);
    ok(await demoRider.client.rpc('borrow_bike', { p_code: 'K-004' }));
    ok(
      await demoRider.client.rpc('report_issue', {
        p_type: 'chain',
        p_note: 'Visitor report',
        p_bike_code: 'K-004',
      }),
    );
    expect((await demoBike('K-001')).current_stand_id).toBe(hall12);

    // a real ride in another college, to prove the reset does not reach it
    const realBike = world.bikes[0];
    const realRide = ok(
      await world.riders[0].client.rpc('borrow_bike', {
        p_code: realBike.code,
        p_sig: realBike.sig,
        p_lat: world.standA.lat,
        p_lng: world.standA.lng,
        p_accuracy: 10,
      }),
    ).ride_id;

    ok(await resetDemo());

    // bikes K-001..K-030 are back at their home stands, the visitor's bike is gone
    const { data: bikes } = await adminClient
      .from('bikes')
      .select('short_code, status, current_stand_id, current_pass_id')
      .eq('college_id', IITK_ID)
      .eq('is_demo', true)
      .order('short_code');
    expect(bikes!.map((b) => b.short_code)).toEqual(
      Array.from({ length: 30 }, (_, i) => `K-${String(i + 1).padStart(3, '0')}`),
    );
    expect(bikes!.every((b) => b.current_stand_id !== null && b.current_pass_id === null)).toBe(true);
    expect((await demoBike('K-001')).current_stand_id).toBe(mainGate);
    expect((await demoBike('K-004')).current_stand_id).toBe(k004.current_stand_id);
    expect(bikes!.filter((b) => b.status !== 'available').map((b) => b.short_code)).toEqual(['K-023']);
    expect((await demoBike('K-017')).ai_flag).toBe('not_seen_at_stand_check');

    // demo rides are history again, the demo rider is free with 7 rides
    const { count: active } = await adminClient
      .from('rides')
      .select('*', { count: 'exact', head: true })
      .eq('is_demo', true)
      .eq('status', 'active');
    expect(active).toBe(0);
    expect(await passOf(demoRider.id)).toMatchObject({
      status: 'ready',
      current_bike_id: null,
      total_rides: 7,
    });

    // seeded issues and the digest are back, the visitor's report is gone
    const { data: issues } = await adminClient
      .from('issue_reports')
      .select('type, note, is_seed')
      .eq('college_id', IITK_ID)
      .eq('is_demo', true);
    expect(issues).toHaveLength(5);
    expect(issues!.every((i) => i.is_seed)).toBe(true);
    expect(issues!.filter((i) => i.type === 'brakes')).toHaveLength(3);
    const { data: digests } = await adminClient
      .from('ai_insights')
      .select('status')
      .eq('college_id', IITK_ID)
      .eq('kind', 'digest')
      .eq('is_demo', true);
    expect(digests).toEqual([{ status: 'active' }]);

    // real rows are untouched
    expect((await row('rides', realRide)).status).toBe('active');
    expect((await row('bikes', realBike.id)).status).toBe('borrowed');
    expect((await row('profiles', realIitk.id)).status).toBe('pending');
    expect(ok(await createAnonClient().rpc('health')).last_demo_reset_at).not.toBeNull();
  }, 90_000);
});
