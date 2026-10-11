import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  at,
  auditCount,
  createWorld,
  IITK_ID,
  notificationsOf,
  ok,
  passOf,
  raised,
  refused,
  row,
  type Bike,
  type TestUser,
  type World,
} from './helpers';

describe('040: Admin Functions Suite', () => {
  let world: World;
  let rider: TestUser;
  let other: TestUser;
  let bikes: Bike[];

  const admin = (fn: string, args: object) => world.admin.client.rpc(fn, args);
  const borrow = async (who: TestUser, bike: Bike): Promise<string> =>
    ok(await who.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }))
      .ride_id;

  /** Runs one admin action and checks it wrote exactly one audit row with that action, via 'admin'. */
  async function audited<T>(action: string, run: () => Promise<T>): Promise<T> {
    const before = await auditCount(world.collegeId, action);
    const result = await run();
    expect(await auditCount(world.collegeId, action), `audit rows for ${action}`).toBe(before + 1);
    return result;
  }

  beforeAll(async () => {
    world = await createWorld({ riders: 2, bikes: 6 });
    [rider, other] = world.riders;
    bikes = world.bikes;
  });

  afterAll(async () => {
    await world?.destroy();
  });

  it('refuses to suspend a rider who holds a bike', async () => {
    await borrow(rider, bikes[0]);
    const res = await admin('suspend_rider', { p_user_id: rider.id, p_reason: 'Rode on the footpath' });
    expect(raised(res)).toBe('CC_PASS_HAS_BIKE');
    expect((await row('profiles', rider.id)).status).toBe('approved');
  });

  it('force-returns a ride: frees pass and bike, parks the bike, tells the rider, adds the strike', async () => {
    const pass = await passOf(rider.id);
    const rideId = pass.current_ride_id;

    const noNote = await admin('force_return', {
      p_ride_id: rideId,
      p_stand_id: world.standB.id,
      p_note: '',
    });
    expect(raised(noNote)).toBe('CC_REASON_REQUIRED');
    const wrongStand = await admin('force_return', {
      p_ride_id: rideId,
      p_stand_id: '22222222-0000-4000-8000-000000000001', // an IITK stand
      p_note: 'Found at the gate',
    });
    expect(raised(wrongStand)).toBe('CC_STAND_NOT_FOUND');

    await audited('ride.force_return', async () =>
      ok(
        await admin('force_return', {
          p_ride_id: rideId,
          p_stand_id: world.standB.id,
          p_note: 'Found at the gate',
          p_add_strike: true,
        }),
      ),
    );

    expect(await passOf(rider.id)).toMatchObject({ status: 'ready', current_bike_id: null, total_rides: 1 });
    expect(await row('bikes', bikes[0].id)).toMatchObject({
      status: 'available',
      current_pass_id: null,
      current_stand_id: world.standB.id,
    });
    const ride = await row('rides', rideId);
    expect(ride).toMatchObject({
      status: 'force_returned',
      end_stand_id: world.standB.id,
      force_note: 'Found at the gate',
      forced_by: world.admin.id,
      photo_check: 'skipped',
    });
    expect(ride.flags).toContain('force_returned');
    expect(await notificationsOf(rider.id, 'ride_closed')).toEqual([
      {
        title: 'Ride closed by an admin',
        body: `${bikes[0].code} was returned at Stand B. Note: Found at the gate`,
      },
    ]);
    expect((await row('profiles', rider.id)).strikes).toBe(1);
    expect(await notificationsOf(rider.id, 'strike')).toHaveLength(1);

    const again = await admin('force_return', {
      p_ride_id: rideId,
      p_stand_id: world.standB.id,
      p_note: 'Found at the gate',
    });
    expect(raised(again)).toBe('CC_RIDE_NOT_ACTIVE');
  });

  it('resets strikes', async () => {
    await audited('rider.reset_strikes', async () =>
      ok(await admin('reset_strikes', { p_user_id: rider.id })),
    );
    expect((await row('profiles', rider.id)).strikes).toBe(0);
  });

  it('suspends with a reason, blocks borrowing, then reinstates', async () => {
    expect(raised(await admin('suspend_rider', { p_user_id: other.id, p_reason: 'no' }))).toBe(
      'CC_REASON_REQUIRED',
    );

    await audited('rider.suspend', async () =>
      ok(await admin('suspend_rider', { p_user_id: other.id, p_reason: 'Lent the pass to a friend' })),
    );
    expect(await row('profiles', other.id)).toMatchObject({
      status: 'suspended',
      suspended_reason: 'Lent the pass to a friend',
    });
    expect((await passOf(other.id)).status).toBe('suspended');
    expect(await notificationsOf(other.id, 'suspension')).toEqual([
      { title: 'Pass suspended', body: 'Lent the pass to a friend' },
    ]);
    const blocked = await other.client.rpc('borrow_bike', {
      p_code: bikes[1].code,
      p_sig: bikes[1].sig,
      ...at(world.standA),
    });
    expect(refused(blocked)).toBe('CC_PASS_SUSPENDED');

    await audited('rider.reinstate', async () => ok(await admin('reinstate_rider', { p_user_id: other.id })));
    expect(await row('profiles', other.id)).toMatchObject({
      status: 'approved',
      strikes: 0,
      suspended_reason: null,
    });
    expect((await passOf(other.id)).status).toBe('ready');
    expect(await notificationsOf(other.id, 'reinstated')).toHaveLength(1);

    expect(raised(await admin('reinstate_rider', { p_user_id: other.id }))).toBe('CC_NOT_SUSPENDED');
  });

  it('marks a borrowed bike missing and releases the pass', async () => {
    const rideId = await borrow(rider, bikes[1]);

    await audited('bike.missing', async () =>
      ok(await admin('mark_bike_missing', { p_bike_id: bikes[1].id, p_note: 'Not seen for two days' })),
    );
    expect(await row('bikes', bikes[1].id)).toMatchObject({
      status: 'missing',
      current_pass_id: null,
      current_stand_id: null,
      notes: 'Not seen for two days',
    });
    expect(await passOf(rider.id)).toMatchObject({ status: 'ready', current_bike_id: null });
    const ride = await row('rides', rideId);
    expect(ride.status).toBe('force_returned');
    expect(ride.flags).toContain('bike_missing');
    expect((await notificationsOf(rider.id, 'ride_closed')).map((n) => n.title)).toContain('Pass released');
  });

  it('switches maintenance on and off, and needs a stand to switch it off', async () => {
    // an available bike goes into maintenance at once and cannot be borrowed
    const on = await audited('bike.maintenance_on', async () =>
      ok(await admin('set_bike_maintenance', { p_bike_id: bikes[2].id, p_on: true, p_note: 'Brake cable' })),
    );
    expect(on.result).toBe('now');
    expect(await row('bikes', bikes[2].id)).toMatchObject({ status: 'maintenance', notes: 'Brake cable' });
    const blocked = await rider.client.rpc('borrow_bike', {
      p_code: bikes[2].code,
      p_sig: bikes[2].sig,
      ...at(world.standA),
    });
    expect(refused(blocked)).toBe('CC_BIKE_IN_MAINTENANCE');

    const off = await audited('bike.maintenance_off', async () =>
      ok(await admin('set_bike_maintenance', { p_bike_id: bikes[2].id, p_on: false })),
    );
    expect(off.result).toBe('available');
    expect((await row('bikes', bikes[2].id)).status).toBe('available');

    // the missing bike has no stand: it can go into maintenance but not come out
    expect(ok(await admin('set_bike_maintenance', { p_bike_id: bikes[1].id, p_on: true })).result).toBe(
      'now',
    );
    const noStand = await admin('set_bike_maintenance', { p_bike_id: bikes[1].id, p_on: false });
    expect(raised(noStand)).toBe('CC_STAND_REQUIRED');

    // a borrowed bike goes into maintenance when it comes back
    await borrow(rider, bikes[3]);
    expect(ok(await admin('set_bike_maintenance', { p_bike_id: bikes[3].id, p_on: true })).result).toBe(
      'after_return',
    );
    expect((await row('bikes', bikes[3].id)).status).toBe('borrowed');
    ok(
      await rider.client.rpc('return_bike', {
        p_code: bikes[3].code,
        p_sig: bikes[3].sig,
        ...at(world.standA),
      }),
    );
    expect((await row('bikes', bikes[3].id)).status).toBe('maintenance');
  });

  it('moves bikes between stands of the same college only', async () => {
    await audited('bike.move', async () =>
      ok(await admin('move_bike', { p_bike_id: bikes[1].id, p_stand_id: world.standA.id })),
    );
    expect(await row('bikes', bikes[1].id)).toMatchObject({
      status: 'maintenance',
      current_stand_id: world.standA.id,
      last_seen_stand_id: world.standA.id,
    });
    // with a stand again, maintenance can be switched off
    expect(ok(await admin('set_bike_maintenance', { p_bike_id: bikes[1].id, p_on: false })).result).toBe(
      'available',
    );

    const elsewhere = await admin('move_bike', {
      p_bike_id: bikes[1].id,
      p_stand_id: '22222222-0000-4000-8000-000000000001',
    });
    expect(raised(elsewhere)).toBe('CC_STAND_NOT_FOUND');

    await borrow(rider, bikes[4]);
    const borrowed = await admin('move_bike', { p_bike_id: bikes[4].id, p_stand_id: world.standB.id });
    expect(raised(borrowed)).toBe('CC_BIKE_NOT_AVAILABLE');
    ok(
      await rider.client.rpc('return_bike', {
        p_code: bikes[4].code,
        p_sig: bikes[4].sig,
        ...at(world.standA),
      }),
    );

    const before = await auditCount(world.collegeId, 'bike.move');
    const moved = ok(
      await admin('move_bikes', {
        p_moves: [
          { bike_code: bikes[1].code, stand_id: world.standB.id },
          { bike_code: bikes[2].code, stand_id: world.standB.id },
        ],
      }),
    );
    expect(moved.moved).toBe(2);
    expect((await row('bikes', bikes[1].id)).current_stand_id).toBe(world.standB.id);
    expect((await row('bikes', bikes[2].id)).current_stand_id).toBe(world.standB.id);
    expect(await auditCount(world.collegeId, 'bike.move')).toBe(before + 2);

    const tooMany = Array.from({ length: 21 }, () => ({
      bike_code: bikes[1].code,
      stand_id: world.standB.id,
    }));
    expect(raised(await admin('move_bikes', { p_moves: tooMany }))).toBe('CC_TOO_MANY');
  });

  it('creates bikes with the college prefix, continuing the sequence', async () => {
    const created = await audited('bike.create', async () =>
      ok(
        await admin('create_bikes', {
          p_college_id: world.collegeId,
          p_stand_id: world.standB.id,
          p_count: 2,
        }),
      ),
    );
    expect(created.codes).toEqual([`${world.prefix}-007`, `${world.prefix}-008`]);

    const none = await admin('create_bikes', {
      p_college_id: world.collegeId,
      p_stand_id: world.standB.id,
      p_count: 0,
    });
    expect(raised(none)).toBe('CC_INVALID_INPUT');
    const foreign = await admin('create_bikes', {
      p_college_id: IITK_ID,
      p_stand_id: world.standB.id,
      p_count: 1,
    });
    expect(raised(foreign)).toBe('CC_FORBIDDEN');
  });

  it('retires a bike, but not one that is out on a ride', async () => {
    await borrow(rider, bikes[5]);
    expect(raised(await admin('retire_bike', { p_bike_id: bikes[5].id }))).toBe('CC_PASS_HAS_BIKE');
    ok(
      await rider.client.rpc('return_bike', {
        p_code: bikes[5].code,
        p_sig: bikes[5].sig,
        ...at(world.standA),
      }),
    );

    await audited('bike.retire', async () => ok(await admin('retire_bike', { p_bike_id: bikes[5].id })));
    expect(await row('bikes', bikes[5].id)).toMatchObject({ status: 'retired', current_stand_id: null });
  });

  it('inserts and updates a stand', async () => {
    const stand = { p_college_id: world.collegeId, p_name: 'Stand C', p_lat: 26.52, p_lng: 80.22 };

    const created = await audited('stand.create', async () =>
      ok(await admin('upsert_stand', { p_id: null, ...stand })),
    );
    // no radius given: the college default geofence
    expect(await row('stands', created.id)).toMatchObject({
      name: 'Stand C',
      radius_m: 40,
      capacity: 8,
      active: true,
    });

    await audited('stand.update', async () =>
      ok(
        await admin('upsert_stand', {
          p_id: created.id,
          ...stand,
          p_name: 'Stand C (gate)',
          p_radius_m: 60,
          p_capacity: 12,
        }),
      ),
    );
    expect(await row('stands', created.id)).toMatchObject({
      name: 'Stand C (gate)',
      radius_m: 60,
      capacity: 12,
    });

    const unknown = await admin('upsert_stand', { p_id: '00000000-0000-4000-8000-000000000000', ...stand });
    expect(raised(unknown)).toBe('CC_STAND_NOT_FOUND');
  });

  it('reconciles a stand check into seen, missing and unexpected', async () => {
    // Stand A holds bikes 3 (maintenance) and 4; bike 0 is recorded at stand B
    const check = await audited('stand.check', async () =>
      ok(
        await admin('stand_check_submit', {
          p_stand_id: world.standA.id,
          p_codes: [bikes[4].code.toLowerCase(), bikes[0].code],
        }),
      ),
    );
    expect(check.stand).toBe('Stand A');
    expect(check.seen).toEqual([bikes[4].code]);
    expect(check.missing.map((m: { code: string }) => m.code)).toEqual([bikes[3].code]);
    expect(check.unexpected).toEqual([
      { code: bikes[0].code, status: 'available', recorded_stand: 'Stand B' },
    ]);

    expect(await row('bikes', bikes[0].id)).toMatchObject({
      current_stand_id: world.standA.id,
      ai_flag: 'found_at_other_stand',
    });
    expect((await row('bikes', bikes[3].id)).ai_flag).toBe('not_seen_at_stand_check');
    expect((await row('bikes', bikes[4].id)).ai_flag).toBeNull();
  });

  it('updates an issue: a note to resolve, the reporter told, the bike into maintenance', async () => {
    const issueId = ok(
      await rider.client.rpc('report_issue', {
        p_type: 'flat_tyre',
        p_note: 'Rear tyre flat',
        p_bike_code: bikes[4].code,
      }),
    ).issue_id;

    const noNote = await admin('update_issue', { p_issue_id: issueId, p_status: 'resolved' });
    expect(raised(noNote)).toBe('CC_REASON_REQUIRED');

    await audited('issue.update', async () =>
      ok(await admin('update_issue', { p_issue_id: issueId, p_status: 'in_progress', p_assign_to_me: true })),
    );
    expect(await row('issue_reports', issueId)).toMatchObject({
      status: 'in_progress',
      assigned_to: world.admin.id,
    });

    ok(
      await admin('update_issue', {
        p_issue_id: issueId,
        p_status: 'resolved',
        p_note: 'Tube replaced',
        p_bike_maintenance: true,
      }),
    );
    expect(await row('issue_reports', issueId)).toMatchObject({
      status: 'resolved',
      resolution_note: 'Tube replaced',
      resolved_by: world.admin.id,
    });
    expect((await row('bikes', bikes[4].id)).status).toBe('maintenance');
    expect((await notificationsOf(rider.id, 'issue_update')).map((n) => n.title)).toEqual([
      'Your report is being handled',
      'Your report is resolved',
    ]);

    const unknown = await admin('update_issue', {
      p_issue_id: '00000000-0000-4000-8000-000000000000',
      p_status: 'open',
    });
    expect(raised(unknown)).toBe('CC_ISSUE_NOT_FOUND');
  });
});
