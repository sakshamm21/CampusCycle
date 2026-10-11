import { setTimeout as sleep } from 'node:timers/promises';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  at,
  auditCount,
  createAnonClient,
  createTestUser,
  createWorld,
  demoSession,
  ok,
  refused,
  row,
  type Bike,
  type TestUser,
  type World,
} from './helpers';

const BIKE_PAYLOAD = /^campuscycle:\/\/b\/([A-Z]{1,3}-[0-9]{3,4})\?s=[A-Za-z0-9_-]{22}$/;
const PASS_PAYLOAD = /^campuscycle:\/\/p\/[0-9a-f-]{36}\?t=[0-9]{1,12}&s=[A-Za-z0-9_-]{22}$/;

describe('110: QR Code Generation & Validation', () => {
  let world: World;
  let rider: TestUser;
  let bike: Bike;
  let spare: Bike;

  const scanPass = (payload: string) => world.admin.client.rpc('admin_scan_pass', { p_payload: payload });
  const scanBike = (payload: string) => world.admin.client.rpc('admin_scan_bike', { p_payload: payload });

  beforeAll(async () => {
    world = await createWorld({ riders: 1, bikes: 2 });
    rider = world.riders[0];
    [bike, spare] = world.bikes;
  });

  afterAll(async () => {
    await world?.destroy();
  });

  it('signs a bike payload that borrow_bike accepts', async () => {
    expect(bike.payload).toMatch(BIKE_PAYLOAD);
    expect(bike.payload.match(BIKE_PAYLOAD)![1]).toBe(bike.code);

    const borrowed = ok(
      await rider.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }),
    );
    expect((await row('rides', borrowed.ride_id)).flags).toEqual([]);
  });

  it('refuses a tampered signature, and a signature lifted from another bike', async () => {
    const tampered = bike.sig.slice(0, -1) + (bike.sig.endsWith('A') ? 'B' : 'A');
    for (const sig of [tampered, spare.sig]) {
      const res = await rider.client.rpc('return_bike', {
        p_code: bike.code,
        p_sig: sig,
        ...at(world.standA),
      });
      expect(refused(res)).toBe('CC_BAD_QR');
    }
    ok(await rider.client.rpc('return_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }));
  });

  it('accepts a typed code without a signature and records it as manual', async () => {
    const typed = ` ${spare.code.toLowerCase()} `;
    const borrowed = ok(
      await rider.client.rpc('borrow_bike', { p_code: typed, p_sig: '', ...at(world.standA) }),
    );
    expect(borrowed.bike_code).toBe(spare.code);
    expect((await row('rides', borrowed.ride_id)).flags).toEqual(['manual_code']);

    ok(await rider.client.rpc('return_bike', { p_code: spare.code, ...at(world.standA) }));
    expect((await row('rides', borrowed.ride_id)).flags).toEqual(['manual_code', 'manual_code_return']);
  });

  it('refuses a code that is not a bike code', async () => {
    for (const code of ['K042', 'KANPUR-042', 'K-42', '']) {
      const res = await rider.client.rpc('borrow_bike', {
        p_code: code,
        p_sig: bike.sig,
        ...at(world.standA),
      });
      expect(refused(res), code).toBe('CC_BAD_CODE');
    }
  });

  it('reads a bike from its QR or its bare code, for admins only', async () => {
    const signed = ok(await scanBike(bike.payload));
    expect(signed).toMatchObject({ signed: true, holder: null });
    expect(signed.bike).toMatchObject({
      id: bike.id,
      code: bike.code,
      status: 'available',
      stand_name: 'Stand A',
    });
    expect(ok(await scanBike(bike.code.toLowerCase())).signed).toBe(false);

    expect(refused(await scanBike(bike.payload.slice(0, -1) + '!'))).toBe('CC_BAD_CODE');
    expect(refused(await scanBike(`campuscycle://b/${bike.code}?s=${spare.sig}`))).toBe('CC_BAD_QR');
    expect(refused(await rider.client.rpc('admin_scan_bike', { p_payload: bike.payload }))).toBe(
      'CC_FORBIDDEN',
    );
    // another college's admin is told the bike does not exist
    const demoAdmin = await demoSession('admin');
    expect(refused(await demoAdmin.client.rpc('admin_scan_bike', { p_payload: bike.payload }))).toBe(
      'CC_BIKE_NOT_FOUND',
    );
  });

  it('issues a pass QR only to a rider with a live pass', async () => {
    const pending = await createTestUser(world.collegeId, { name: 'Pending Rider' });
    expect(refused(await pending.client.rpc('get_my_pass_qr'))).toBe('CC_NOT_APPROVED');
    expect(refused(await createAnonClient().rpc('get_my_pass_qr'))).toBe('CC_NOT_APPROVED');
  });

  it('scans a fresh pass QR, shows the bike on it, and expires it two windows later', async () => {
    ok(await rider.client.rpc('borrow_bike', { p_code: bike.code, p_sig: bike.sig, ...at(world.standA) }));
    const qr = ok(await rider.client.rpc('get_my_pass_qr'));
    expect(qr.payload).toMatch(PASS_PAYLOAD);
    expect(Date.parse(qr.expires_at)).toBe((qr.window + 1) * 30_000);

    const before = await auditCount(world.collegeId, 'pass.scan');
    const scan = ok(await scanPass(qr.payload));
    expect(scan.holder).toMatchObject({
      user_id: rider.id,
      name: 'Test Rider 1',
      status: 'approved',
      pass_status: 'riding',
      pass_label: `${world.code} · 1001`,
    });
    expect(scan.bike).toMatchObject({ code: bike.code, from_stand: 'Stand A', is_overdue: false });
    expect(await auditCount(world.collegeId, 'pass.scan')).toBe(before + 1);

    // a wrong signature, a rider, and an admin of another college all get nothing
    const forged = qr.payload.slice(0, -1) + (qr.payload.endsWith('A') ? 'B' : 'A');
    expect(refused(await scanPass(forged))).toBe('CC_BAD_QR');
    expect(refused(await scanPass(qr.payload.replace(`t=${qr.window}`, `t=${qr.window + 1}`)))).toBe(
      'CC_BAD_QR',
    );
    expect(refused(await rider.client.rpc('admin_scan_pass', { p_payload: qr.payload }))).toBe(
      'CC_FORBIDDEN',
    );
    const demoAdmin = await demoSession('admin');
    expect(refused(await demoAdmin.client.rpc('admin_scan_pass', { p_payload: qr.payload }))).toBe(
      'CC_FORBIDDEN',
    );

    // The QR is good for its own 30 s window and the one after. Wait, by the server's clock,
    // until the window after that has begun.
    const serverNow = Date.parse(ok(await createAnonClient().rpc('health')).time);
    await sleep((qr.window + 2) * 30_000 - serverNow + 2_000);
    expect(refused(await scanPass(qr.payload))).toBe('CC_PASS_QR_EXPIRED');
  }, 120_000);
});
