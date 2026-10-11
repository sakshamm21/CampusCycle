import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  at,
  createWorld,
  must,
  notificationsOf,
  ok,
  passOf,
  refused,
  row,
  type Bike,
  type TestUser,
  type World,
} from './helpers';

describe('050: Timers, Strikes, and Finish Thresholds', () => {
  let world: World;
  let rider: TestUser;
  let regular: TestUser;
  let rideId: string;

  const borrow = async (who: TestUser, bike: Bike): Promise<string> =>
    ok(await who.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }))
      .ride_id;
  const giveBack = async (who: TestUser, bike: Bike) =>
    ok(await who.client.rpc('return_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }));
  // The timers run from pg_cron every 5 minutes; this runs the same function now.
  const runTimers = async () => ok(await adminClient.rpc('admin_run_ride_timers'));

  async function setDue(ride: string, minutesFromNow: number) {
    const due = new Date(Date.now() + minutesFromNow * 60_000).toISOString();
    must(
      await adminClient.from('rides').update({ due_at: due }).eq('id', ride).select('id').single(),
      'set due_at',
    );
  }

  beforeAll(async () => {
    world = await createWorld({ riders: 2, bikes: 3 });
    [rider, regular] = world.riders;
  });

  afterAll(async () => {
    await world?.destroy();
  });

  it('sends no reminder while more than 15 minutes remain', async () => {
    rideId = await borrow(rider, world.bikes[0]);
    await runTimers();
    expect(await notificationsOf(rider.id, 'ride_reminder')).toEqual([]);
    expect(await row('rides', rideId)).toMatchObject({ reminder_sent_at: null, is_overdue: false });
  });

  it('sends the reminder once when 15 minutes remain', async () => {
    await setDue(rideId, 10);
    await runTimers();
    await runTimers();

    const reminders = await notificationsOf(rider.id, 'ride_reminder');
    expect(reminders).toHaveLength(1);
    expect(reminders[0].title).toBe('15 minutes left');
    expect(reminders[0].body).toContain(world.bikes[0].code);
    expect((await row('rides', rideId)).reminder_sent_at).not.toBeNull();
    expect((await passOf(rider.id)).status).toBe('riding');
  });

  it('marks a ride overdue once: the ride, the pass, the rider and the admins', async () => {
    await setDue(rideId, -2);
    await runTimers();
    await runTimers();

    const ride = await row('rides', rideId);
    expect(ride.is_overdue).toBe(true);
    expect(ride.overdue_at).not.toBeNull();
    expect((await passOf(rider.id)).status).toBe('overdue');
    expect((await notificationsOf(rider.id, 'ride_overdue')).map((n) => n.title)).toEqual([
      'Your ride is overdue',
    ]);
    const alerts = (await notificationsOf(world.admin.id, 'admin_alert')).filter(
      (n) => n.title === 'Overdue ride',
    );
    expect(alerts).toHaveLength(1);
    expect(alerts[0].body).toContain(world.bikes[0].code);
  });

  it('adds a strike for a late return and marks the ride late', async () => {
    const res = await giveBack(rider, world.bikes[0]);
    expect(res).toMatchObject({ late: true, strikes: 1, suspended: false });

    const ride = await row('rides', rideId);
    expect(ride).toMatchObject({ status: 'returned', late: true });
    expect(ride.flags).toContain('late');
    expect(await row('profiles', rider.id)).toMatchObject({ strikes: 1, status: 'approved' });
    expect((await passOf(rider.id)).status).toBe('ready');
    const strikes = await notificationsOf(rider.id, 'strike');
    expect(strikes).toHaveLength(1);
    expect(strikes[0].body).toBe(`Late return of ${world.bikes[0].code}. You have 1 of 3 strikes.`);
  });

  it('suspends the pass at the strike limit and tells the rider and the admins', async () => {
    must(
      await adminClient.from('profiles').update({ strikes: 2 }).eq('id', rider.id).select('id').single(),
      'set strikes',
    );
    const ride = await borrow(rider, world.bikes[1]);
    await setDue(ride, -1);

    const res = await giveBack(rider, world.bikes[1]);
    expect(res).toMatchObject({ late: true, strikes: 3, suspended: true });

    expect(await row('profiles', rider.id)).toMatchObject({
      status: 'suspended',
      strikes: 3,
      suspended_reason: 'Reached the strike limit (3).',
    });
    expect((await passOf(rider.id)).status).toBe('suspended');
    expect(await notificationsOf(rider.id, 'suspension')).toHaveLength(1);
    const alerts = await notificationsOf(world.admin.id, 'admin_alert');
    expect(alerts.map((n) => n.title)).toContain('Rider suspended');

    const blocked = await rider.client.rpc('borrow_bike', {
      p_code: world.bikes[1].code,
      p_sig: world.bikes[1].sig,
      ...at(world.standA),
    });
    expect(refused(blocked)).toBe('CC_PASS_SUSPENDED');
  });

  it('moves the pass finish from graphite to chrome at 10 rides and to holo at 50', async () => {
    const bike = world.bikes[2];
    const setRides = async (n: number) =>
      must(
        await adminClient
          .from('rider_passes')
          .update({ total_rides: n })
          .eq('rider_id', regular.id)
          .select('id')
          .single(),
        'set total_rides',
      );
    const finish = async () => ok(await regular.client.rpc('get_my_context')).pass.finish;

    await setRides(8);
    await borrow(regular, bike);
    expect(await giveBack(regular, bike)).toMatchObject({
      total_rides: 9,
      finish_before: 'graphite',
      finish_after: 'graphite',
    });
    expect(ok(await regular.client.rpc('get_pass_stats'))).toMatchObject({
      rides: 9,
      finish: 'graphite',
      next_finish: 'chrome',
      rides_to_next: 1,
    });

    await borrow(regular, bike);
    expect(await giveBack(regular, bike)).toMatchObject({
      total_rides: 10,
      finish_before: 'graphite',
      finish_after: 'chrome',
    });
    expect(await finish()).toBe('chrome');
    expect(ok(await regular.client.rpc('get_pass_stats'))).toMatchObject({
      next_finish: 'holo',
      rides_to_next: 40,
    });

    await setRides(49);
    await borrow(regular, bike);
    expect(await giveBack(regular, bike)).toMatchObject({
      total_rides: 50,
      finish_before: 'chrome',
      finish_after: 'holo',
    });
    expect(await finish()).toBe('holo');
    expect(ok(await regular.client.rpc('get_pass_stats'))).toMatchObject({
      next_finish: null,
      rides_to_next: 0,
    });
  });
});
