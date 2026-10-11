import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  auditCount,
  createAnonClient,
  createTestUser,
  createWorld,
  deleteTestUser,
  demoSession,
  notificationsOf,
  ok,
  passOf,
  raised,
  row,
  type TestUser,
  type World,
} from './helpers';

describe('020: Sign-up and Approval Lifecycle', () => {
  let world: World;
  let applicant: TestUser;
  const extras: string[] = [];

  beforeAll(async () => {
    world = await createWorld({ riders: 0, bikes: 1 });
  });

  afterAll(async () => {
    for (const id of extras) await deleteTestUser(id);
    await world?.destroy();
  });

  it('creates a pending profile and pass from the sign-up metadata and alerts the admins', async () => {
    applicant = await createTestUser(world.collegeId, { name: 'Asha Applicant' });

    expect(await row('profiles', applicant.id)).toMatchObject({
      college_id: world.collegeId,
      full_name: 'Asha Applicant',
      role: 'rider',
      status: 'pending',
      email_domain_match: true,
      is_demo: false,
      is_owner: false,
    });
    expect(await passOf(applicant.id)).toMatchObject({
      college_id: world.collegeId,
      status: 'pending',
      pass_number: null,
    });
    const alerts = await notificationsOf(world.admin.id, 'admin_alert');
    expect(alerts).toContainEqual({ title: 'New rider waiting', body: 'Asha Applicant asked to join.' });
  });

  it('never takes the role from sign-up metadata', async () => {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: `t-role-${Date.now()}@cctest.example.com`,
      password: 'cc-test-password-2026',
      email_confirm: true,
      user_metadata: {
        full_name: 'Sneaky',
        college_id: world.collegeId,
        role: 'super_admin',
        status: 'approved',
      },
    });
    expect(error).toBeNull();
    extras.push(data.user!.id);
    expect(await row('profiles', data.user!.id)).toMatchObject({ role: 'rider', status: 'pending' });
  });

  it('leaves email_domain_match false for a domain the college does not list', async () => {
    const outsider = await createTestUser(world.collegeId, { domain: 'elsewhere.example.com', login: false });
    extras.push(outsider.id);
    expect((await row('profiles', outsider.id)).email_domain_match).toBe(false);
  });

  it('lets a pending applicant edit their application', async () => {
    ok(
      await applicant.client.rpc('update_application', {
        p_full_name: 'Asha A. Applicant',
        p_phone: '+91 98765 43210',
        p_roll_number: '240123',
        p_college_id: world.collegeId,
      }),
    );
    expect(await row('profiles', applicant.id)).toMatchObject({
      full_name: 'Asha A. Applicant',
      phone: '+91 98765 43210',
      roll_number: '240123',
      status: 'pending',
    });
  });

  it('refuses a rejection without a reason', async () => {
    const res = await world.admin.client.rpc('reject_rider', { p_user_id: applicant.id, p_reason: ' ' });
    expect(raised(res)).toBe('CC_REASON_REQUIRED');
    expect((await row('profiles', applicant.id)).status).toBe('pending');
  });

  it('refuses an admin of another college', async () => {
    const demoAdmin = await demoSession('admin');
    const res = await demoAdmin.client.rpc('approve_rider', { p_user_id: applicant.id });
    expect(raised(res)).toBe('CC_FORBIDDEN');
    expect((await row('profiles', applicant.id)).status).toBe('pending');
  });

  it('rejects with a reason and tells the applicant', async () => {
    ok(
      await world.admin.client.rpc('reject_rider', {
        p_user_id: applicant.id,
        p_reason: 'Roll number does not match',
      }),
    );
    expect(await row('profiles', applicant.id)).toMatchObject({
      status: 'rejected',
      rejection_reason: 'Roll number does not match',
    });
    expect(await notificationsOf(applicant.id, 'rejection')).toEqual([
      { title: 'Application not approved', body: 'Roll number does not match' },
    ]);
    expect(await auditCount(world.collegeId, 'rider.reject')).toBe(1);
  });

  it('puts a rejected applicant back to pending when they re-apply', async () => {
    ok(
      await applicant.client.rpc('update_application', {
        p_full_name: 'Asha A. Applicant',
        p_phone: '+91 98765 43210',
        p_roll_number: '240124',
        p_college_id: world.collegeId,
      }),
    );
    expect(await row('profiles', applicant.id)).toMatchObject({
      status: 'pending',
      rejection_reason: null,
      roll_number: '240124',
    });
    const alerts = await notificationsOf(world.admin.id, 'admin_alert');
    expect(alerts.map((a) => a.title)).toContain('Rider re-applied');
  });

  it('approves with the next pass number of the college', async () => {
    const before = await row('colleges', world.collegeId);

    const res = ok(await world.admin.client.rpc('approve_rider', { p_user_id: applicant.id }));
    const label = `${world.code} · ${String(before.next_pass_no).padStart(4, '0')}`;
    expect(res.pass_label).toBe(label);

    expect(await row('profiles', applicant.id)).toMatchObject({
      status: 'approved',
      approved_by: world.admin.id,
    });
    expect(await passOf(applicant.id)).toMatchObject({ status: 'ready', pass_number: before.next_pass_no });
    expect((await row('colleges', world.collegeId)).next_pass_no).toBe(before.next_pass_no + 1);
    expect(await notificationsOf(applicant.id, 'approval')).toEqual([
      { title: "You're in", body: `Your Rider Pass ${label} is live. Go ride.` },
    ]);
    expect(await auditCount(world.collegeId, 'rider.approve')).toBe(1);
  });

  it('refuses to approve twice', async () => {
    const res = await world.admin.client.rpc('approve_rider', { p_user_id: applicant.id });
    expect(raised(res)).toBe('CC_NOT_PENDING');
  });

  it('refuses application edits once approved', async () => {
    const res = await applicant.client.rpc('update_application', {
      p_full_name: 'Someone Else',
      p_phone: '+91 98765 43210',
      p_roll_number: '240124',
      p_college_id: world.collegeId,
    });
    expect(raised(res)).toBe('CC_NOT_EDITABLE');
  });

  it('refuses a bulk approval of more than 50', async () => {
    const ids = Array.from({ length: 51 }, () => '00000000-0000-4000-8000-000000000000');
    expect(raised(await world.admin.client.rpc('approve_riders', { p_user_ids: ids }))).toBe('CC_TOO_MANY');
  });

  it('bulk approves the pending ones and reports the rest', async () => {
    const one = await createTestUser(world.collegeId, { login: false });
    const two = await createTestUser(world.collegeId, { login: false });
    extras.push(one.id, two.id);

    const res = ok(
      await world.admin.client.rpc('approve_riders', { p_user_ids: [one.id, applicant.id, two.id] }),
    );
    expect(res.approved).toBe(2);
    expect(res.failed).toEqual([{ user_id: applicant.id, code: 'CC_NOT_PENDING' }]);
    expect((await passOf(one.id)).status).toBe('ready');
    expect((await passOf(two.id)).status).toBe('ready');
  });

  it('records a password reset request and alerts the admins', async () => {
    const anon = createAnonClient();
    ok(await anon.rpc('request_password_reset', { p_email: applicant.email.toUpperCase() }));

    expect((await row('profiles', applicant.id)).password_reset_requested_at).not.toBeNull();
    const alerts = await notificationsOf(world.admin.id, 'admin_alert');
    expect(alerts).toContainEqual({
      title: 'Password reset requested',
      body: 'Asha A. Applicant asked for a new password.',
    });
  });

  it('answers ok for an unknown email and changes nothing', async () => {
    const requested = async () => {
      const { count } = await adminClient
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('password_reset_requested_at', 'is', null);
      return count;
    };
    const before = await requested();
    ok(
      await createAnonClient().rpc('request_password_reset', { p_email: `nobody-${Date.now()}@example.com` }),
    );
    expect(await requested()).toBe(before);
  });
});
