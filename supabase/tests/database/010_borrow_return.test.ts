import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  at,
  createWorld,
  FAR_AWAY,
  ok,
  passOf,
  refused,
  row,
  type TestUser,
  type World,
} from './helpers';

// Real (non-demo) riders, so the location checks that demo accounts skip are exercised.
describe('010: Borrow and Return RPCs', () => {
  let world: World;
  let rider: TestUser;
  let other: TestUser;
  let rideId: string;

  const borrow = (who: TestUser, bike: { code: string; sig: string }, where: object) =>
    who.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...where });
  const giveBack = (who: TestUser, bike: { code: string; sig: string }, where: object) =>
    who.client.rpc('return_bike', { p_code: bike.code, p_sig: bike.sig, ...where });

  async function freeBikes(standId: string): Promise<number> {
    const stands: { id: string; free_bikes: number }[] = ok(await rider.client.rpc('get_stands_with_counts'));
    return stands.find((s) => s.id === standId)!.free_bikes;
  }

  beforeAll(async () => {
    world = await createWorld({ riders: 2, bikes: 3 });
    [rider, other] = world.riders;
  });

  afterAll(async () => {
    await world?.destroy();
  });

  it('refuses a forged QR signature', async () => {
    const res = await borrow(
      rider,
      { code: world.bikes[0].code, sig: 'forged_signature_00000' },
      at(world.standA),
    );
    expect(refused(res)).toBe('CC_BAD_QR');
  });

  it('refuses a borrow from outside every stand and names the nearest one', async () => {
    const res = await borrow(rider, world.bikes[0], FAR_AWAY);
    expect(refused(res)).toBe('CC_NOT_AT_STAND');
    expect(['Stand A', 'Stand B']).toContain(res.data.data.nearest_stand);
    expect(res.data.data.distance_m).toBeGreaterThan(1000);
  });

  it('refuses a fix rougher than 50 m', async () => {
    const res = await borrow(rider, world.bikes[0], at(world.standA, 80));
    expect(refused(res)).toBe('CC_POOR_ACCURACY');
    expect(res.data.data.accuracy_m).toBe(80);
  });

  it('refuses a mock location', async () => {
    const res = await borrow(rider, world.bikes[0], { ...at(world.standA), p_is_mock: true });
    expect(refused(res)).toBe('CC_MOCK_LOCATION');
  });

  it('refuses a bike that is recorded at another stand', async () => {
    const res = await borrow(rider, world.bikes[0], at(world.standB));
    expect(refused(res)).toBe('CC_BIKE_NOT_AT_THIS_STAND');
    expect(res.data.data).toEqual({ code: world.bikes[0].code, bike_stand: 'Stand A', here: 'Stand B' });
  });

  it('previews a borrow without starting a ride', async () => {
    const preview = ok(
      await rider.client.rpc('preview_bike', {
        p_code: world.bikes[0].code,
        p_sig: world.bikes[0].sig,
        ...at(world.standA),
      }),
    );
    expect(preview.stand).toEqual({ id: world.standA.id, name: 'Stand A' });
    expect(preview.manual).toBe(false);
    expect((await passOf(rider.id)).status).toBe('ready');
    expect((await row('bikes', world.bikes[0].id)).status).toBe('available');
  });

  it('borrows at the stand and links the bike and the pass to each other', async () => {
    expect(await freeBikes(world.standA.id)).toBe(3);

    const res = ok(await borrow(rider, world.bikes[0], at(world.standA)));
    rideId = res.ride_id;
    expect(res.bike_code).toBe(world.bikes[0].code);
    expect(res.stand_name).toBe('Stand A');
    // the college default: 240 minutes
    expect(Date.parse(res.due_at) - Date.parse(res.started_at)).toBe(240 * 60_000);

    const pass = await passOf(rider.id);
    expect(pass).toMatchObject({
      status: 'riding',
      current_bike_id: world.bikes[0].id,
      current_ride_id: rideId,
    });
    const bike = await row('bikes', world.bikes[0].id);
    expect(bike).toMatchObject({ status: 'borrowed', current_pass_id: pass.id, current_stand_id: null });
    const ride = await row('rides', rideId);
    expect(ride).toMatchObject({
      status: 'active',
      rider_id: rider.id,
      start_stand_id: world.standA.id,
      flags: [],
    });

    expect(await freeBikes(world.standA.id)).toBe(2);
  });

  it('refuses a second bike on the same pass', async () => {
    const res = await borrow(rider, world.bikes[1], at(world.standA));
    expect(refused(res)).toBe('CC_PASS_HAS_BIKE');
    expect(res.data.data.bike).toBe(world.bikes[0].code);
  });

  it('refuses the same bike to another rider', async () => {
    const res = await borrow(other, world.bikes[0], at(world.standA));
    expect(refused(res)).toBe('CC_BIKE_NOT_AVAILABLE');
    expect((await passOf(other.id)).status).toBe('ready');
  });

  it('refuses to return a different bike than the one on the pass', async () => {
    const res = await giveBack(rider, world.bikes[1], at(world.standB));
    expect(refused(res)).toBe('CC_WRONG_BIKE');
    expect(res.data.data).toEqual({ pass_bike: world.bikes[0].code, scanned: world.bikes[1].code });
  });

  it('refuses a return away from every stand', async () => {
    expect(refused(await giveBack(rider, world.bikes[0], FAR_AWAY))).toBe('CC_NOT_AT_STAND');
    expect((await passOf(rider.id)).status).toBe('riding');
  });

  it('returns at another stand and updates the pass, the bike, the ride and the counts', async () => {
    const check = ok(await rider.client.rpc('check_return_location', at(world.standB)));
    expect(check).toMatchObject({ stand_name: 'Stand B', stand_full: false, bike_code: world.bikes[0].code });

    const res = ok(await giveBack(rider, world.bikes[0], at(world.standB)));
    expect(res).toMatchObject({
      ride_id: rideId,
      start_stand_name: 'Stand A',
      end_stand_name: 'Stand B',
      late: false,
      stand_full: false,
      strikes: null,
      suspended: false,
      total_rides: 1,
      finish_before: 'graphite',
      finish_after: 'graphite',
      photo_pending: true,
    });
    expect(res.minutes).toBeGreaterThanOrEqual(1);

    expect(await passOf(rider.id)).toMatchObject({
      status: 'ready',
      current_bike_id: null,
      current_ride_id: null,
      total_rides: 1,
    });
    expect(await row('bikes', world.bikes[0].id)).toMatchObject({
      status: 'available',
      current_pass_id: null,
      current_stand_id: world.standB.id,
    });
    expect(await row('rides', rideId)).toMatchObject({
      status: 'returned',
      end_stand_id: world.standB.id,
      late: false,
    });

    expect(await freeBikes(world.standA.id)).toBe(2);
    expect(await freeBikes(world.standB.id)).toBe(1);
  });

  it('refuses a return when the pass holds no bike', async () => {
    expect(refused(await giveBack(rider, world.bikes[0], at(world.standB)))).toBe('CC_NO_BIKE_ON_PASS');
  });

  it('blocks a bike marked borrowed whose pass does not point back at it', async () => {
    const pass = await passOf(other.id);
    const { error } = await adminClient
      .from('bikes')
      .update({ status: 'borrowed', current_pass_id: pass.id, current_stand_id: null })
      .eq('id', world.bikes[1].id);
    expect(error?.message).toBe('CC_INTEGRITY_BIKE_PASS');
    expect((await row('bikes', world.bikes[1].id)).status).toBe('available');
  });
});
