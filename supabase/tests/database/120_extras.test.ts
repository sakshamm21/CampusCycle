import { describe, it, expect, beforeAll } from 'vitest';
import { adminClient, createAnonClient, demoSession, IITK_ID, must, ok, raised, resetDemo } from './helpers';

describe('120: Extras and Public RPCs', () => {
  beforeAll(async () => {
    ok(await resetDemo());
  });

  it('gives anon signed QR samples of exactly the available demo bikes', async () => {
    const samples: { code: string; stand_name: string; payload: string }[] = ok(
      await createAnonClient().rpc('demo_qr_samples'),
    );
    const available = must(
      await adminClient
        .from('bikes')
        .select('short_code')
        .eq('is_demo', true)
        .eq('status', 'available')
        .order('short_code'),
      'available demo bikes',
    ).map((b) => b.short_code);

    // 30 seeded demo bikes, one of them (K-023) in maintenance
    expect(available).toHaveLength(29);
    expect(samples.map((s) => s.code).sort()).toEqual(available);
    expect(samples.map((s) => s.code)).not.toContain('K-023');
    for (const sample of samples) {
      expect(sample.payload).toMatch(new RegExp(`^campuscycle://b/${sample.code}\\?s=[A-Za-z0-9_-]{22}$`));
    }

    // a sample really is a working QR for a demo account
    const demoAdmin = await demoSession('admin');
    const scan = ok(await demoAdmin.client.rpc('admin_scan_bike', { p_payload: samples[0].payload }));
    expect(scan).toMatchObject({
      signed: true,
      bike: { code: samples[0].code, stand_name: samples[0].stand_name },
    });
  });

  it('refuses the colleges overview to anyone but a super admin', async () => {
    for (const role of ['admin', 'rider'] as const) {
      const session = await demoSession(role);
      expect(raised(await session.client.rpc('colleges_overview')), role).toBe('CC_FORBIDDEN');
    }
    expect(raised(await createAnonClient().rpc('colleges_overview'))).toBe('CC_FORBIDDEN');
  });

  it('gives a super admin one overview row per college', async () => {
    const demoSuper = await demoSession('super');
    const rows: {
      id: string;
      short_code: string;
      stands: number;
      bikes: number;
      riders: number;
      pending: number;
      admins: number;
    }[] = ok(await demoSuper.client.rpc('colleges_overview'));
    const colleges = must(await adminClient.from('colleges').select('id'), 'colleges');

    expect(rows.map((r) => r.id).sort()).toEqual(colleges.map((c) => c.id).sort());
    // the demo super admin counts demo rows only: 21 approved demo riders, 4 applicants, 1 demo admin
    expect(rows.find((r) => r.id === IITK_ID)).toMatchObject({
      short_code: 'IITK',
      stands: 10,
      bikes: 30,
      riders: 21,
      pending: 4,
      admins: 1,
    });
  });
});
