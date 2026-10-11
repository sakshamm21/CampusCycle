import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  at,
  createTestUser,
  createWorld,
  must,
  notificationsOf,
  ok,
  passOf,
  refused,
  row,
  type TestUser,
  type World,
} from './helpers';

describe('060: Issues & Notifications Suite', () => {
  let world: World;
  let rider: TestUser;
  let other: TestUser;
  let rideId: string;

  const adminAlerts = async () => (await notificationsOf(world.admin.id, 'admin_alert')).map((n) => n.title);

  beforeAll(async () => {
    world = await createWorld({ riders: 2, bikes: 2 });
    [rider, other] = world.riders;
    const bike = world.bikes[0];
    rideId = ok(
      await rider.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }),
    ).ride_id;
  });

  afterAll(async () => {
    await world?.destroy();
  });

  it('links a report made during a ride to the ride and the bike', async () => {
    const res = ok(
      await rider.client.rpc('report_issue', {
        p_type: 'brakes',
        p_note: 'Front brake barely grips',
        p_bike_code: world.bikes[0].code.toLowerCase(),
        p_ride_id: rideId,
        p_stand_id: world.standA.id,
      }),
    );
    expect(await row('issue_reports', res.issue_id)).toMatchObject({
      college_id: world.collegeId,
      reporter_id: rider.id,
      bike_id: world.bikes[0].id,
      ride_id: rideId,
      stand_id: world.standA.id,
      type: 'brakes',
      note: 'Front brake barely grips',
      status: 'open',
      urgency: 4,
      source: 'app',
      is_demo: false,
    });
  });

  it('frees nothing when a rider reports the bike missing mid-ride, and alerts the admins', async () => {
    const res = ok(
      await rider.client.rpc('report_issue', {
        p_type: 'bike_missing',
        p_note: 'Gone from the rack',
        p_ride_id: rideId,
      }),
    );
    expect(await row('issue_reports', res.issue_id)).toMatchObject({
      bike_id: world.bikes[0].id,
      urgency: 5,
    });

    expect(await passOf(rider.id)).toMatchObject({ status: 'riding', current_bike_id: world.bikes[0].id });
    expect((await row('bikes', world.bikes[0].id)).status).toBe('borrowed');
    expect((await row('rides', rideId)).status).toBe('active');
    expect(await adminAlerts()).toContain('Bike reported missing');
  });

  it('refuses reports that point at nothing', async () => {
    const unknownBike = await rider.client.rpc('report_issue', {
      p_type: 'chain',
      p_bike_code: `${world.prefix}-999`,
    });
    expect(refused(unknownBike)).toBe('CC_BIKE_NOT_FOUND');
    expect(unknownBike.data.data.code).toBe(`${world.prefix}-999`);

    const foreignRide = await other.client.rpc('report_issue', { p_type: 'chain', p_ride_id: rideId });
    expect(refused(foreignRide)).toBe('CC_RIDE_NOT_FOUND');

    const foreignPhoto = await rider.client.rpc('report_issue', {
      p_type: 'chain',
      p_photo_path: `${other.id}/photo.jpg`,
    });
    expect(refused(foreignPhoto)).toBe('CC_BAD_PHOTO_PATH');

    const pending = await createTestUser(world.collegeId, { name: 'Pending Rider' });
    expect(refused(await pending.client.rpc('report_issue', { p_type: 'other' }))).toBe('CC_NOT_APPROVED');
  });

  it('turns a ride close request into an urgent issue and an admin alert', async () => {
    const noRide = await other.client.rpc('request_ride_close', { p_note: 'Nothing to close' });
    expect(refused(noRide)).toBe('CC_NO_BIKE_ON_PASS');

    const res = ok(await rider.client.rpc('request_ride_close', { p_note: 'Puncture far from any stand' }));
    expect(await row('issue_reports', res.issue_id)).toMatchObject({
      type: 'ride_close_request',
      ride_id: rideId,
      bike_id: world.bikes[0].id,
      urgency: 4,
      status: 'open',
    });
    expect(await adminAlerts()).toContain('Rider asks to close a ride');

    // closing the ride resolves the request
    ok(
      await world.admin.client.rpc('force_return', {
        p_ride_id: rideId,
        p_stand_id: world.standA.id,
        p_note: 'Collected by the van',
      }),
    );
    expect(await row('issue_reports', res.issue_id)).toMatchObject({
      status: 'resolved',
      resolution_note: 'Ride closed by admin',
      resolved_by: world.admin.id,
    });
  });

  it('tells the reporter when their report is resolved', async () => {
    const issueId = ok(
      await other.client.rpc('report_issue', {
        p_type: 'damaged_qr',
        p_note: 'Sticker torn',
        p_bike_code: world.bikes[1].code,
      }),
    ).issue_id;
    expect((await row('issue_reports', issueId)).urgency).toBeNull();

    ok(
      await world.admin.client.rpc('update_issue', {
        p_issue_id: issueId,
        p_status: 'resolved',
        p_note: 'New sticker on',
      }),
    );
    expect(await notificationsOf(other.id, 'issue_update')).toEqual([
      { title: 'Your report is resolved', body: 'New sticker on' },
    ]);
  });

  it("marks notifications read: the chosen ones, then all, and only the caller's", async () => {
    const unread = async (userId: string) =>
      must(
        await adminClient
          .from('notifications')
          .select('id')
          .eq('user_id', userId)
          .is('read_at', null)
          .order('created_at'),
        'unread',
      ).map((n) => n.id as string);

    const mine = await unread(rider.id);
    const theirs = await unread(other.id);
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(theirs.length).toBeGreaterThanOrEqual(1);

    // naming someone else's notification changes nothing for them
    ok(await rider.client.rpc('mark_notifications_read', { p_ids: [mine[0], theirs[0]] }));
    expect(await unread(rider.id)).toEqual(mine.slice(1));
    expect(await unread(other.id)).toEqual(theirs);

    ok(await rider.client.rpc('mark_notifications_read'));
    expect(await unread(rider.id)).toEqual([]);
    expect(await unread(other.id)).toEqual(theirs);
  });

  // Whether a notification is pushed is decided in private.on_notification_insert and leaves the
  // database through pg_net, which the API cannot observe. Covered by the push check in P5-T02.
  it.todo('suppresses pushes for switched-off categories but never approval, suspension or overdue');
});
