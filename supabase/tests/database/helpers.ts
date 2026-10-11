import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile(path.join(rootDir, '.env'));
  } catch (err) {
    console.warn('Could not load .env:', err);
  }
}

const API_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false } };

export const IITK_ID = '11111111-1111-4111-8111-111111111111';
export const DEMO_PASSWORD = 'ride-the-demo-2026';
export const DEMO = {
  rider: 'demo-rider@example.com',
  admin: 'demo-admin@example.com',
  super: 'demo-super@example.com',
} as const;
// Every account the tests create uses this domain, so leftovers of a crashed run can be found.
export const TEST_DOMAIN = 'cctest.example.com';
const TEST_PASSWORD = 'cc-test-password-2026';

export const adminClient: SupabaseClient = createClient(
  API_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  NO_SESSION,
);

export function createAnonClient(): SupabaseClient {
  return createClient(API_URL, ANON_KEY, NO_SESSION);
}

// ---------- result helpers ----------

interface Res {
  // The clients are untyped here: an RPC answers jsonb and each test knows its shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  error: { message: string; code?: string } | null;
}

/** Setup steps: fail loudly instead of carrying an undefined into the next step. */
export function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  if (res.data === null) throw new Error(`${what}: no data`);
  return res.data;
}

/** A call that must succeed. RPCs that answer `{ ok }` must say true. Returns the data. */
export function ok(res: Res) {
  expect(res.error).toBeNull();
  if (res.data !== null && typeof res.data === 'object' && 'ok' in res.data) expect(res.data.ok).toBe(true);
  return res.data;
}

/** The code of a rider RPC that answered `{ ok: false, code }` (03 §1). */
export function refused(res: Res): string | undefined {
  expect(res.error).toBeNull();
  expect(res.data?.ok).toBe(false);
  return res.data?.code;
}

/** The code of an RPC that raised. */
export function raised(res: Res): string | undefined {
  expect(res.error).not.toBeNull();
  return res.error?.message;
}

/** Postgres refused the statement outright (no privilege), as opposed to RLS hiding rows. */
export function denied(res: Res): boolean {
  return res.error?.code === '42501';
}

// ---------- sessions ----------

interface Session {
  id: string;
  email: string;
  client: SupabaseClient;
}

// Password sign-ins are rate limited per IP (30 per 5 minutes on the hosted project),
// so a login is reused within a run and a 429 is waited out instead of failing the suite.
const sessions = new Map<string, Promise<Session>>();

async function signIn(email: string, password: string): Promise<Session> {
  for (let attempt = 0; ; attempt++) {
    const client = createClient(API_URL, ANON_KEY, NO_SESSION);
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (!error && data.user) return { id: data.user.id, email, client };
    if (error?.status !== 429 || attempt >= 12) throw new Error(`sign in ${email}: ${error?.message}`);
    await sleep(11_000);
  }
}

export function demoSession(role: keyof typeof DEMO): Promise<Session> {
  const email = DEMO[role];
  let session = sessions.get(email);
  if (!session) {
    session = signIn(email, DEMO_PASSWORD);
    sessions.set(email, session);
  }
  return session;
}

/** A fresh, uncached login (for tests that change the session itself). */
export function freshSession(email: string, password = DEMO_PASSWORD): Promise<Session> {
  return signIn(email, password);
}

// ---------- test accounts ----------

export interface TestUser extends Session {
  passId: string;
}

function tag(bytes = 5): string {
  return randomBytes(bytes).toString('hex');
}

function letters(n: number): string {
  return Array.from(randomBytes(n), (b) => String.fromCharCode(65 + (b % 26))).join('');
}

/** Signs up a real (non-demo) person through the auth trigger. They start as a pending rider. */
export async function createTestUser(
  collegeId: string | null,
  opts: { name?: string; domain?: string; login?: boolean } = {},
): Promise<TestUser> {
  const email = `t-${tag()}@${opts.domain ?? TEST_DOMAIN}`;
  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: opts.name ?? 'Test Rider',
      college_id: collegeId ?? '',
      phone: '+91 90000 00000',
      roll_number: 'T-0001',
    },
  });
  if (error || !data.user) throw new Error(`create user: ${error?.message}`);
  const id = data.user.id;
  const pass = must(
    await adminClient.from('rider_passes').select('id').eq('rider_id', id).single(),
    'pass of new user',
  );
  const client = opts.login === false ? createAnonClient() : (await signIn(email, TEST_PASSWORD)).client;
  return { id, email, client, passId: pass.id };
}

/** Makes a test user an approved admin. Roles are never client-settable, so this needs the service key. */
export async function promote(userId: string, role: 'college_admin' | 'super_admin'): Promise<void> {
  must(
    await adminClient
      .from('profiles')
      .update({ role, status: 'approved', approved_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id')
      .single(),
    `promote to ${role}`,
  );
}

export async function deleteTestUser(userId: string): Promise<void> {
  // "New rider waiting" alerts sent to admins or the owner point at the user in `data`.
  await adminClient.from('notifications').delete().eq('data->>user_id', userId);
  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) throw new Error(`delete user: ${error.message}`);
}

// ---------- a real college to test in ----------

export interface Stand {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface Bike {
  id: string;
  code: string;
  sig: string;
  payload: string;
}

export interface World {
  collegeId: string;
  code: string;
  prefix: string;
  standA: Stand;
  standB: Stand;
  admin: TestUser;
  riders: TestUser[];
  /** All parked at stand A to begin with. */
  bikes: Bike[];
  /** A further approved rider of this college. */
  addRider(name?: string): Promise<TestUser>;
  addBikes(count: number, stand?: Stand): Promise<Bike[]>;
  destroy(): Promise<void>;
}

/** GPS arguments for standing exactly at a stand with a good fix. */
export function at(stand: Stand, accuracy = 10) {
  return { p_lat: stand.lat, p_lng: stand.lng, p_accuracy: accuracy, p_is_mock: false };
}

/** Somewhere well outside every test stand. */
export const FAR_AWAY = { p_lat: 26.6, p_lng: 80.3, p_accuracy: 10, p_is_mock: false };

export function sigOf(payload: string): string {
  return payload.split('?s=')[1] ?? '';
}

export async function createWorld(opts: { riders?: number; bikes?: number } = {}): Promise<World> {
  // short_code and bike_prefix are unique across colleges: retry on the rare clash
  let college: { id: string; short_code: string; bike_prefix: string } | null = null;
  for (let attempt = 0; attempt < 5 && !college; attempt++) {
    const code = `T${letters(4)}`;
    const { data, error } = await adminClient
      .from('colleges')
      .insert({
        name: `Test ${code}`,
        short_code: code,
        bike_prefix: `T${letters(2)}`,
        email_domains: [TEST_DOMAIN],
        center_lat: 26.505,
        center_lng: 80.205,
      })
      .select('id, short_code, bike_prefix')
      .single();
    if (data) college = data;
    else if (error?.code !== '23505') throw new Error(`create college: ${error?.message}`);
  }
  if (!college) throw new Error('create college: no free code');
  const collegeId = college.id;
  const users: string[] = [];

  async function stand(name: string, lat: number, lng: number): Promise<Stand> {
    const row = must(
      await adminClient
        .from('stands')
        .insert({ college_id: collegeId, name, lat, lng, radius_m: 40, capacity: 8 })
        .select('id')
        .single(),
      `create ${name}`,
    );
    return { id: row.id, name, lat, lng };
  }
  // About 1.5 km apart, so a fix at one stand is never inside the other
  const standA = await stand('Stand A', 26.5, 80.2);
  const standB = await stand('Stand B', 26.51, 80.21);

  const admin = await createTestUser(collegeId, { name: 'Test Admin' });
  users.push(admin.id);
  await promote(admin.id, 'college_admin');

  async function addRider(name = 'Test Rider'): Promise<TestUser> {
    const rider = await createTestUser(collegeId, { name });
    users.push(rider.id);
    ok(await admin.client.rpc('approve_rider', { p_user_id: rider.id }));
    return rider;
  }

  async function addBikes(count: number, where: Stand = standA): Promise<Bike[]> {
    const created = ok(
      await admin.client.rpc('create_bikes', {
        p_college_id: collegeId,
        p_stand_id: where.id,
        p_count: count,
      }),
    );
    const rows = must(
      await adminClient.from('bikes').select('id, short_code').in('short_code', created.codes),
      'new bikes',
    );
    const payloads: { bike_id: string; short_code: string; payload: string }[] = ok(
      await admin.client.rpc('admin_bike_qr_payloads', { p_bike_ids: rows.map((r) => r.id) }),
    );
    return payloads.map((p) => ({
      id: p.bike_id,
      code: p.short_code,
      payload: p.payload,
      sig: sigOf(p.payload),
    }));
  }

  const riders: TestUser[] = [];
  for (let i = 0; i < (opts.riders ?? 1); i++) riders.push(await addRider(`Test Rider ${i + 1}`));
  const bikes = await addBikes(opts.bikes ?? 2);

  return {
    collegeId,
    code: college.short_code,
    prefix: college.bike_prefix,
    standA,
    standB,
    admin,
    riders,
    bikes,
    addRider,
    addBikes,
    destroy: () => destroyCollege(collegeId, users),
  };
}

/** Removes a test college and everything that hangs off it. Safe to call on a half-built one. */
export async function destroyCollege(collegeId: string, userIds: string[] = []): Promise<void> {
  // A bike and a pass point at each other: release the pass first, then the bike
  await adminClient
    .from('rider_passes')
    .update({ status: 'ready', current_bike_id: null, current_ride_id: null, borrowed_at: null })
    .eq('college_id', collegeId)
    .not('current_bike_id', 'is', null);
  await adminClient
    .from('bikes')
    .update({ status: 'available', current_pass_id: null })
    .eq('college_id', collegeId)
    .eq('status', 'borrowed');

  const { data: members } = await adminClient.from('profiles').select('id').eq('college_id', collegeId);
  const ids = new Set([...userIds, ...(members ?? []).map((m) => m.id)]);
  for (const id of ids) await deleteTestUser(id);

  await adminClient.from('notifications').delete().eq('college_id', collegeId);
  await adminClient.from('audit_log').delete().eq('college_id', collegeId);
  const { error } = await adminClient.from('colleges').delete().eq('id', collegeId);
  if (error) throw new Error(`delete college: ${error.message}`);
}

/** Clears whatever an interrupted earlier run left behind. */
export async function purgeTestData(): Promise<void> {
  const { data: colleges } = await adminClient.from('colleges').select('id').like('name', 'Test T%');
  for (const c of colleges ?? []) await destroyCollege(c.id);
  const { data: strays } = await adminClient.from('profiles').select('id').like('email', `%@${TEST_DOMAIN}`);
  for (const p of strays ?? []) await deleteTestUser(p.id);
}

// ---------- small readers (service role) ----------

export async function row(table: string, id: string) {
  return must(await adminClient.from(table).select('*').eq('id', id).single(), `${table} ${id}`);
}

export async function passOf(userId: string) {
  return must(
    await adminClient.from('rider_passes').select('*').eq('rider_id', userId).single(),
    `pass of ${userId}`,
  );
}

export async function notificationsOf(
  userId: string,
  kind: string,
): Promise<{ title: string; body: string }[]> {
  return must(
    await adminClient
      .from('notifications')
      .select('title, body')
      .eq('user_id', userId)
      .eq('kind', kind)
      .order('created_at'),
    'notifications',
  );
}

export async function auditCount(collegeId: string, action: string, via = 'admin'): Promise<number> {
  const { count, error } = await adminClient
    .from('audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('college_id', collegeId)
    .eq('action', action)
    .eq('via', via);
  if (error) throw new Error(`audit count: ${error.message}`);
  return count ?? 0;
}

export function resetDemo() {
  return adminClient.rpc('admin_run_demo_reset');
}

export type { SupabaseClient };
