import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createAnonClient,
  createTestUser,
  createWorld,
  deleteTestUser,
  demoSession,
  denied,
  IITK_ID,
  must,
  ok,
  promote,
  raised,
  resetDemo,
  type SupabaseClient,
  type TestUser,
  type World,
} from './helpers';

const AI_TABLES = [
  'ai_threads',
  'ai_messages',
  'ai_runs',
  'ai_steps',
  'ai_actions',
  'ai_memories',
  'ai_knowledge',
  'ai_insights',
  'ai_usage',
  'ai_settings',
  'ai_evals',
];
const EMBEDDING = `[${Array(384).fill(0.05).join(',')}]`;

describe('080: AI Security and Settings', () => {
  let world: World;
  let rider: TestUser;
  let other: TestUser;
  let superAdmin: TestUser;
  let demoRider: { id: string; client: SupabaseClient };
  let demoAdmin: { id: string; client: SupabaseClient };

  beforeAll(async () => {
    // the demo reset seeds one rider thread, one admin thread and a run with steps for each
    ok(await resetDemo());
    world = await createWorld({ riders: 2, bikes: 1 });
    [rider, other] = world.riders;
    superAdmin = await createTestUser(null, { name: 'Test Super' });
    await promote(superAdmin.id, 'super_admin');
    demoRider = await demoSession('rider');
    demoAdmin = await demoSession('admin');
  });

  afterAll(async () => {
    if (superAdmin) await deleteTestUser(superAdmin.id);
    await world?.destroy();
  });

  it('shows users only their own threads, messages and actions', async () => {
    const thread = must(
      await adminClient.from('ai_threads').select('id').eq('user_id', demoRider.id).single(),
      'seeded rider thread',
    );
    must(
      await adminClient
        .from('ai_actions')
        .insert({
          thread_id: thread.id,
          user_id: demoRider.id,
          college_id: IITK_ID,
          tool: 'file_issue_report',
          args: {},
          preview: {},
          is_demo: true,
        })
        .select('id')
        .single(),
      'seed action',
    );

    const threads = ok(await demoRider.client.from('ai_threads').select('id, user_id'));
    expect(threads).toEqual([{ id: thread.id, user_id: demoRider.id }]);
    const messages = ok(await demoRider.client.from('ai_messages').select('thread_id'));
    expect(messages.length).toBeGreaterThan(0);
    expect(new Set(messages.map((m: { thread_id: string }) => m.thread_id))).toEqual(new Set([thread.id]));
    const actions = ok(await demoRider.client.from('ai_actions').select('user_id'));
    expect(actions).toEqual([{ user_id: demoRider.id }]);

    // the demo admin has a thread of their own and sees none of the rider's rows
    const adminThreads = ok(await demoAdmin.client.from('ai_threads').select('user_id'));
    expect(adminThreads).toEqual([{ user_id: demoAdmin.id }]);
    expect(ok(await demoAdmin.client.from('ai_messages').select('id').eq('thread_id', thread.id))).toEqual(
      [],
    );
    expect(ok(await demoAdmin.client.from('ai_actions').select('id'))).toEqual([]);

    for (const table of ['ai_threads', 'ai_messages', 'ai_actions']) {
      expect(ok(await rider.client.from(table).select('id')), table).toEqual([]);
    }
  });

  it('shows admins the runs, steps and insights of their own college only', async () => {
    for (const table of ['ai_runs', 'ai_insights']) {
      const rows = ok(await demoAdmin.client.from(table).select('college_id, is_demo'));
      expect(rows.length, table).toBeGreaterThan(0);
      expect(
        rows.every((r: { college_id: string; is_demo: boolean }) => r.college_id === IITK_ID && r.is_demo),
      ).toBe(true);
    }
    expect(ok(await demoAdmin.client.from('ai_steps').select('id')).length).toBeGreaterThan(0);

    for (const table of ['ai_runs', 'ai_steps', 'ai_insights']) {
      expect(ok(await world.admin.client.from(table).select('id')), `other college admin: ${table}`).toEqual(
        [],
      );
      expect(ok(await demoRider.client.from(table).select('id')), `rider: ${table}`).toEqual([]);
    }
  });

  it('lets nobody write to an ai_ table directly', async () => {
    const clients = {
      rider: rider.client,
      admin: world.admin.client,
      super: superAdmin.client,
      anon: createAnonClient(),
    };
    // 124 statements: sent together, since each one is a round trip to the hosted project
    const nobody = '00000000-0000-4000-8000-000000000000';
    const attempts: Promise<[string, boolean]>[] = [];
    const attempt = (label: string, statement: PromiseLike<Parameters<typeof denied>[0]>) =>
      attempts.push(Promise.resolve(statement).then((res) => [label, denied(res)]));

    for (const [who, client] of Object.entries(clients)) {
      for (const table of AI_TABLES) {
        attempt(`${who} insert ${table}`, client.from(table).insert({}));
      }
      // every table but ai_usage has an id to aim an update or a delete at
      for (const table of AI_TABLES.filter((t) => t !== 'ai_usage')) {
        attempt(`${who} update ${table}`, client.from(table).update({ id: nobody }).eq('id', nobody));
        attempt(`${who} delete ${table}`, client.from(table).delete().eq('id', nobody));
      }
    }
    const allowed = (await Promise.all(attempts))
      .filter(([, wasDenied]) => !wasDenied)
      .map(([label]) => label);
    expect(attempts).toHaveLength(124);
    expect(allowed).toEqual([]);
  });

  it('keeps memories, knowledge and usage unreadable through the API', async () => {
    for (const client of [rider.client, world.admin.client, superAdmin.client]) {
      for (const table of ['ai_memories', 'ai_knowledge', 'ai_usage']) {
        expect(denied(await client.from(table).select('*').limit(1)), table).toBe(true);
      }
    }
  });

  it('gives a college admin the usage summary of their college, never the global one', async () => {
    expect(raised(await world.admin.client.rpc('ai_usage_summary', { p_college_id: null }))).toBe(
      'CC_FORBIDDEN',
    );
    expect(raised(await world.admin.client.rpc('ai_usage_summary', { p_college_id: IITK_ID }))).toBe(
      'CC_FORBIDDEN',
    );
    expect(raised(await rider.client.rpc('ai_usage_summary', { p_college_id: world.collegeId }))).toBe(
      'CC_FORBIDDEN',
    );

    const own = ok(await world.admin.client.rpc('ai_usage_summary', { p_college_id: world.collegeId }));
    expect(Number(own.cap_usd)).toBeLessThanOrEqual(5);
    expect(own.per_day).toEqual([]);
    ok(await superAdmin.client.rpc('ai_usage_summary', { p_college_id: null }));
  });

  it('caps the monthly budget at US$5 and keeps the global settings for super admins', async () => {
    const globalRow = async () =>
      must(
        await adminClient.from('ai_settings').select('*').is('college_id', null).single(),
        'global ai_settings',
      );
    const before = await globalRow();

    const tooHigh = await superAdmin.client.rpc('update_ai_settings', {
      p_college_id: null,
      p_monthly_cap_usd: 5.5,
    });
    expect(raised(tooHigh)).toBe('CC_CAP_TOO_HIGH');
    const notSuper = await world.admin.client.rpc('update_ai_settings', {
      p_college_id: null,
      p_monthly_cap_usd: 1,
    });
    expect(raised(notSuper)).toBe('CC_FORBIDDEN');
    expect((await globalRow()).monthly_cap_usd).toBe(before.monthly_cap_usd);

    // a college admin switches features for their own college, and only that
    const features = { ...before.features, rider_assistant: false };
    ok(
      await world.admin.client.rpc('update_ai_settings', {
        p_college_id: world.collegeId,
        p_features: features,
      }),
    );
    const mine = must(
      await adminClient.from('ai_settings').select('features').eq('college_id', world.collegeId).single(),
      'college ai_settings',
    );
    expect(mine.features.rider_assistant).toBe(false);
    const foreign = await world.admin.client.rpc('update_ai_settings', {
      p_college_id: IITK_ID,
      p_features: features,
    });
    expect(raised(foreign)).toBe('CC_FORBIDDEN');
  });

  it("clears only the caller's AI memory", async () => {
    must(
      await adminClient
        .from('ai_memories')
        .insert([
          { user_id: rider.id, content: 'Usually rides from Stand A', embedding: EMBEDDING },
          { user_id: rider.id, content: 'Prefers mornings', embedding: EMBEDDING },
          { user_id: other.id, content: 'Usually rides from Stand B', embedding: EMBEDDING },
        ])
        .select('id'),
      'seed memories',
    );

    expect(ok(await rider.client.rpc('clear_my_ai_memory')).deleted).toBe(2);

    const { data: left } = await adminClient
      .from('ai_memories')
      .select('user_id')
      .in('user_id', [rider.id, other.id]);
    expect(left).toEqual([{ user_id: other.id }]);
  });

  it('keeps the service-only functions out of reach of signed-in users', async () => {
    const calls: [string, object][] = [
      ['admin_run_demo_reset', {}],
      ['admin_run_ride_timers', {}],
      ['admin_set_app_config', { p_key: 'owner_email', p_value: rider.email }],
      ['admin_setup_demo_account', { p_user: rider.id, p_kind: 'super_admin', p_college: world.collegeId }],
      [
        'ai_record_usage',
        {
          p_pool: 'demo',
          p_user: rider.id,
          p_college: world.collegeId,
          p_steps: 1,
          p_tokens_in: 1,
          p_tokens_out: 1,
          p_cost: 0,
        },
      ],
      ['ai_budget_state', { p_pool: 'demo' }],
      ['ai_forecast_inputs', { p_college: world.collegeId, p_demo: false }],
      ['ai_digest_inputs', { p_college: world.collegeId, p_demo: false }],
    ];
    for (const client of [rider.client, world.admin.client, superAdmin.client, createAnonClient()]) {
      for (const [fn, args] of calls) {
        expect(denied(await client.rpc(fn, args)), fn).toBe(true);
      }
    }
  });
});
