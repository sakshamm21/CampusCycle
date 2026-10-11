import { describe, it, expect, beforeAll } from 'vitest';
import {
  adminClient,
  createAnonClient,
  createWorld,
  demoSession,
  IITK_ID,
  ok,
  passOf,
  purgeTestData,
} from './helpers';

describe('000: Database helpers and connection verification', () => {
  beforeAll(async () => {
    await purgeTestData();
  });

  it('answers the health check for anon', async () => {
    const health = ok(await createAnonClient().rpc('health'));
    expect(Date.parse(health.time)).toBeGreaterThan(Date.now() - 5 * 60_000);
  });

  it('holds the IITK seed: 10 stands and 30 demo bikes', async () => {
    const { data: college } = await adminClient
      .from('colleges')
      .select('short_code')
      .eq('id', IITK_ID)
      .single();
    expect(college?.short_code).toBe('IITK');

    const { count: stands } = await adminClient
      .from('stands')
      .select('*', { count: 'exact', head: true })
      .eq('college_id', IITK_ID);
    expect(stands).toBe(10);

    const { count: bikes } = await adminClient
      .from('bikes')
      .select('*', { count: 'exact', head: true })
      .eq('college_id', IITK_ID)
      .eq('is_demo', true);
    expect(bikes).toBe(30);
  });

  it('signs in the three demo accounts with their roles', async () => {
    for (const role of ['rider', 'admin', 'super'] as const) {
      const session = await demoSession(role);
      const ctx = ok(await session.client.rpc('get_my_context'));
      expect(ctx.profile.id).toBe(session.id);
      expect(ctx.profile.is_demo).toBe(true);
      expect(ctx.profile.role).toBe({ rider: 'rider', admin: 'college_admin', super: 'super_admin' }[role]);
    }
  });

  it('builds a real test college and removes every trace of it', async () => {
    const world = await createWorld({ riders: 1, bikes: 2 });
    const rider = world.riders[0];

    const ctx = ok(await rider.client.rpc('get_my_context'));
    expect(ctx.profile.is_demo).toBe(false);
    expect(ctx.profile.status).toBe('approved');
    expect(ctx.college.id).toBe(world.collegeId);
    expect((await passOf(rider.id)).status).toBe('ready');
    expect(world.bikes.map((b) => b.code)).toEqual([`${world.prefix}-001`, `${world.prefix}-002`]);
    expect(world.bikes[0].sig).toHaveLength(22);

    await world.destroy();

    for (const table of [
      'stands',
      'bikes',
      'rides',
      'rider_passes',
      'profiles',
      'notifications',
      'audit_log',
    ]) {
      const { count } = await adminClient
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('college_id', world.collegeId);
      expect(count, table).toBe(0);
    }
    const { data: gone } = await adminClient.from('colleges').select('id').eq('id', world.collegeId);
    expect(gone).toEqual([]);
    const { data: user } = await adminClient.auth.admin.getUserById(rider.id);
    expect(user.user).toBeNull();
  });
});
