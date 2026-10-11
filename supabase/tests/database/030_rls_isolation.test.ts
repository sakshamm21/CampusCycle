import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  at,
  createAnonClient,
  createTestUser,
  createWorld,
  deleteTestUser,
  demoSession,
  denied,
  IITK_ID,
  ok,
  promote,
  raised,
  refused,
  row,
  type SupabaseClient,
  type TestUser,
  type World,
} from './helpers';

describe('030: RLS Isolation & Multi-College Security', () => {
  let a: World;
  let b: World;
  let riderB: TestUser;
  let otherB: TestUser;
  let superAdmin: TestUser;
  let realIitk: TestUser;

  const tables = ['profiles', 'stands', 'bikes', 'rider_passes', 'rides', 'issue_reports'];
  const views = ['admin_users_v', 'admin_rides_v', 'admin_bikes_v', 'admin_issues_v'];

  async function countIn(client: SupabaseClient, table: string, collegeId: string): Promise<number> {
    const { data, error } = await client.from(table).select('college_id').eq('college_id', collegeId);
    expect(error, table).toBeNull();
    return data!.length;
  }

  beforeAll(async () => {
    a = await createWorld({ riders: 1, bikes: 1 });
    b = await createWorld({ riders: 2, bikes: 1 });
    [riderB, otherB] = b.riders;

    // Give college B a finished ride and an issue, so there is something to hide
    const bike = b.bikes[0];
    ok(await riderB.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(b.standA) }));
    ok(await riderB.client.rpc('return_bike', { p_code: bike.code, p_sig: bike.sig, ...at(b.standB) }));
    ok(
      await riderB.client.rpc('report_issue', {
        p_type: 'chain',
        p_note: 'Chain slips',
        p_bike_code: bike.code,
      }),
    );

    superAdmin = await createTestUser(null, { name: 'Test Super' });
    await promote(superAdmin.id, 'super_admin');
    realIitk = await createTestUser(IITK_ID, { name: 'Real IITK Applicant', login: false });
  });

  afterAll(async () => {
    if (superAdmin) await deleteTestUser(superAdmin.id);
    if (realIitk) await deleteTestUser(realIitk.id);
    await a?.destroy();
    await b?.destroy();
  });

  it('shows a college admin nothing of another college, through tables or admin views', async () => {
    for (const source of [...tables, ...views]) {
      expect(await countIn(a.admin.client, source, b.collegeId), source).toBe(0);
    }
    // and the same queries do return rows where the admin is allowed
    for (const source of ['profiles', 'stands', 'bikes', 'rider_passes', 'admin_users_v', 'admin_bikes_v']) {
      expect(await countIn(a.admin.client, source, a.collegeId), source).toBeGreaterThan(0);
    }
    for (const source of [...tables, ...views]) {
      expect(await countIn(b.admin.client, source, b.collegeId), source).toBeGreaterThan(0);
    }
  });

  it('shows a rider only their own profile, pass, rides, reports and notifications', async () => {
    const own: [string, string][] = [
      ['profiles', 'id'],
      ['rider_passes', 'rider_id'],
      ['rides', 'rider_id'],
      ['issue_reports', 'reporter_id'],
      ['notifications', 'user_id'],
    ];
    for (const [table, column] of own) {
      const { data, error } = await riderB.client.from(table).select(column);
      expect(error, table).toBeNull();
      const owners = (data as unknown as Record<string, string>[]).map((r) => r[column]);
      expect(owners.length, table).toBeGreaterThan(0);
      expect(new Set(owners), table).toEqual(new Set([riderB.id]));
    }
    // a rider of the same college sees none of it
    for (const table of ['rides', 'issue_reports']) {
      const { data } = await otherB.client.from(table).select('id');
      expect(data, table).toEqual([]);
    }
    const { data: inbox } = await otherB.client.from('notifications').select('user_id');
    expect(new Set(inbox!.map((n) => n.user_id))).toEqual(new Set([otherB.id]));
    for (const view of views) {
      expect(await countIn(riderB.client, view, b.collegeId), view).toBeLessThanOrEqual(1);
    }
  });

  it('denies a rider any direct write to bikes, rides and passes', async () => {
    const bike = b.bikes[0];
    const attempts = [
      riderB.client.from('bikes').insert({ college_id: b.collegeId, short_code: `${b.prefix}-999` }),
      riderB.client.from('bikes').update({ status: 'retired' }).eq('id', bike.id),
      riderB.client.from('bikes').delete().eq('id', bike.id),
      riderB.client
        .from('rides')
        .insert({ college_id: b.collegeId, bike_id: bike.id, due_at: new Date().toISOString() }),
      riderB.client.from('rides').update({ late: false }).eq('rider_id', riderB.id),
      riderB.client.from('rider_passes').update({ total_rides: 999 }).eq('rider_id', riderB.id),
      riderB.client.from('rider_passes').insert({ rider_id: riderB.id, college_id: b.collegeId }),
    ];
    for (const res of await Promise.all(attempts)) expect(denied(res)).toBe(true);

    expect((await row('bikes', bike.id)).status).toBe('available');
    expect((await row('rider_passes', riderB.passId)).total_rides).toBe(1);
  });

  it('lets a rider change only their own contact columns', async () => {
    const promoteSelf = await riderB.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', riderB.id);
    expect(denied(promoteSelf)).toBe(true);
    const approveSelf = await riderB.client
      .from('profiles')
      .update({ strikes: 0, status: 'approved' })
      .eq('id', riderB.id);
    expect(denied(approveSelf)).toBe(true);

    ok(await riderB.client.from('profiles').update({ phone: '+91 91111 11111' }).eq('id', riderB.id));
    expect((await row('profiles', riderB.id)).phone).toBe('+91 91111 11111');

    // someone else's row is simply not there to update
    ok(await riderB.client.from('profiles').update({ phone: '+91 92222 22222' }).eq('id', otherB.id));
    expect((await row('profiles', otherB.id)).phone).toBe('+91 90000 00000');
    expect((await row('profiles', riderB.id)).role).toBe('rider');
  });

  it('gives anon the three public functions and nothing else', async () => {
    const anon = createAnonClient();

    const colleges: { short_code: string }[] = ok(await anon.rpc('list_colleges_public'));
    expect(colleges.map((c) => c.short_code)).toContain('IITK');
    ok(await anon.rpc('health'));
    expect(Array.isArray(ok(await anon.rpc('demo_qr_samples')))).toBe(true);

    for (const table of [...tables, 'notifications', 'audit_log', ...views]) {
      const { data } = await anon.from(table).select('*').limit(1);
      expect(data ?? [], table).toEqual([]);
    }

    expect(ok(await anon.rpc('get_my_context'))).toBeNull();
    expect(refused(await anon.rpc('borrow_bike', { p_code: 'K-001' }))).toBe('CC_NOT_SIGNED_IN');
    expect(refused(await anon.rpc('admin_scan_bike', { p_payload: 'K-001' }))).toBe('CC_FORBIDDEN');
    expect(raised(await anon.rpc('dashboard_stats', { p_college_id: IITK_ID }))).toBe('CC_FORBIDDEN');
    expect(raised(await anon.rpc('approve_rider', { p_user_id: realIitk.id }))).toBe('CC_FORBIDDEN');
    expect(raised(await anon.rpc('colleges_overview'))).toBe('CC_FORBIDDEN');
    expect(denied(await anon.rpc('admin_run_demo_reset'))).toBe(true);
    expect((await row('profiles', realIitk.id)).status).toBe('pending');
  });

  it('shows a super admin both colleges', async () => {
    for (const world of [a, b]) {
      for (const source of ['profiles', 'stands', 'bikes', 'admin_users_v', 'admin_bikes_v']) {
        expect(await countIn(superAdmin.client, source, world.collegeId), source).toBeGreaterThan(0);
      }
    }
    expect(await countIn(superAdmin.client, 'rides', b.collegeId)).toBe(1);
  });

  it('shows a demo admin only demo rows', async () => {
    const demoAdmin = (await demoSession('admin')).client;

    for (const source of ['profiles', 'bikes', 'rider_passes', 'rides', 'issue_reports', 'admin_users_v']) {
      const { data, error } = await demoAdmin.from(source).select('is_demo').limit(1000);
      expect(error, source).toBeNull();
      expect(data!.length, source).toBeGreaterThan(0);
      expect(
        data!.every((r) => r.is_demo),
        source,
      ).toBe(true);
    }
    // a real person of the same college stays invisible to the demo admin
    for (const source of ['profiles', 'admin_users_v']) {
      const { data } = await demoAdmin.from(source).select('id').eq('id', realIitk.id);
      expect(data, source).toEqual([]);
    }
    const { data: visible } = await adminClient.from('profiles').select('id').eq('id', realIitk.id);
    expect(visible).toHaveLength(1);
  });
});
