import { describe, it, expect, vi } from 'vitest';
import { AppError } from '../src/errors.ts';
import type { CampusClient } from '../src/api/client.ts';
import { borrowBike, deleteMyAccount, getMyContext, listMyRides, signIn } from '../src/api/rider.ts';
import { createCollege, moveBikes, scanPass, updateAiSettings, upsertStand } from '../src/api/admin.ts';

interface Fake {
  rpc?: (name: string, args?: unknown) => unknown;
  session?: { user: { id: string } } | null;
  invoke?: () => unknown;
  signIn?: () => unknown;
}

function fakeDb(fake: Fake) {
  const rpc = vi.fn(async (name: string, args?: unknown) => fake.rpc?.(name, args));
  const db = {
    rpc,
    auth: {
      getSession: async () => ({ data: { session: fake.session ?? null }, error: null }),
      signInWithPassword: async () => fake.signIn?.(),
    },
    functions: { invoke: async () => fake.invoke?.() },
  } as unknown as CampusClient;
  return { db, rpc };
}

async function caught(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(AppError);
    return e as AppError;
  }
  throw new Error('expected the wrapper to throw');
}

const FIX = { lat: 26.5, lng: 80.2, accuracy: 12, isMock: false };

describe('rider wrappers', () => {
  it('throws AppError when a rider RPC answers { ok: false }', async () => {
    const { db } = fakeDb({
      rpc: () => ({
        data: { ok: false, code: 'CC_NOT_AT_STAND', data: { nearest_stand: 'Hall 5', distance_m: 120 } },
        error: null,
      }),
    });
    const err = await caught(borrowBike(db, 'K-042', 'sig', FIX));
    expect(err.code).toBe('CC_NOT_AT_STAND');
    expect(err.data).toEqual({ nearest_stand: 'Hall 5', distance_m: 120 });
  });

  it('returns the result and maps the fix to RPC arguments when ok', async () => {
    const result = { ok: true, ride_id: 'r1', bike_code: 'K-042' };
    const { db, rpc } = fakeDb({ rpc: () => ({ data: result, error: null }) });
    await expect(borrowBike(db, 'K-042', 'sig', FIX)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('borrow_bike', {
      p_code: 'K-042',
      p_sig: 'sig',
      p_lat: 26.5,
      p_lng: 80.2,
      p_accuracy: 12,
      p_is_mock: false,
      p_demo_stand_id: undefined,
    });
  });

  it('throws AppError with the hint data when an RPC raises', async () => {
    const { db } = fakeDb({
      rpc: () => ({ data: null, error: { message: 'CC_NOT_EDITABLE', hint: '{}' } }),
    });
    expect((await caught(getMyContext(db))).code).toBe('CC_NOT_EDITABLE');
  });

  it('throws CC_NOT_SIGNED_IN for a direct read without a session', async () => {
    const { db } = fakeDb({ session: null });
    expect((await caught(listMyRides(db))).code).toBe('CC_NOT_SIGNED_IN');
  });

  it('maps a failed sign in to CC_AUTH_INVALID', async () => {
    const { db } = fakeDb({
      signIn: () => ({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      }),
    });
    expect((await caught(signIn(db, 'a@example.com', 'wrong-password'))).code).toBe('CC_AUTH_INVALID');
  });

  it('reads the code and data from an Edge Function error body', async () => {
    const body = JSON.stringify({ code: 'CC_PASS_HAS_BIKE', message: 'x', data: { bike: 'K-004' } });
    const { db } = fakeDb({
      invoke: () => ({ data: null, error: { context: new Response(body, { status: 400 }) } }),
    });
    const err = await caught(deleteMyAccount(db));
    expect(err.code).toBe('CC_PASS_HAS_BIKE');
    expect(err.data).toEqual({ bike: 'K-004' });
  });

  it('maps an Edge Function network failure to CC_NETWORK', async () => {
    const { db } = fakeDb({
      invoke: () => ({ data: null, error: { context: new TypeError('Failed to fetch') } }),
    });
    expect((await caught(deleteMyAccount(db))).code).toBe('CC_NETWORK');
  });
});

describe('admin wrappers', () => {
  const ok = () => ({ data: { ok: true }, error: null });

  it('throws AppError when a scan answers { ok: false }', async () => {
    const { db } = fakeDb({
      rpc: () => ({ data: { ok: false, code: 'CC_PASS_QR_EXPIRED', data: {} }, error: null }),
    });
    expect((await caught(scanPass(db, 'campuscycle://p/x'))).code).toBe('CC_PASS_QR_EXPIRED');
  });

  it('sends p_id null for a new stand', async () => {
    const { db, rpc } = fakeDb({ rpc: ok });
    await upsertStand(db, { college_id: 'c1', name: 'Library', lat: 26.5, lng: 80.2 });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_id: null, p_college_id: 'c1' });
  });

  it('sends bike codes to move_bikes', async () => {
    const { db, rpc } = fakeDb({ rpc: ok });
    await moveBikes(db, [{ bike_code: 'K-004', stand_id: 's1' }]);
    expect(rpc).toHaveBeenCalledWith('move_bikes', { p_moves: [{ bike_code: 'K-004', stand_id: 's1' }] });
  });

  it('sends p_college_id null for the global AI settings', async () => {
    const { db, rpc } = fakeDb({ rpc: ok });
    await updateAiSettings(db, null, { monthly_cap_usd: 4 });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_college_id: null, p_monthly_cap_usd: 4 });
  });

  it('sends a null centre when a new college has none', async () => {
    const { db, rpc } = fakeDb({ rpc: ok });
    await createCollege(db, {
      name: 'Test',
      short_code: 'TST',
      time_zone: 'Asia/Kolkata',
      email_domains: [],
    });
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({
      p_center_lat: null,
      p_center_lng: null,
      p_bike_prefix: 'TST',
    });
  });
});
