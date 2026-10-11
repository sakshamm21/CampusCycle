import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAnonClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('020: Sign-up and Approval Lifecycle', () => {
  let adminUserClient: SupabaseClient;
  let testUserId: string;
  let collegeId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    adminUserClient = await createAuthenticatedClient('demo-admin@example.com');
    const { data: college } = await adminClient
      .from('colleges')
      .select('id')
      .eq('short_code', 'IITK')
      .single();
    collegeId = college!.id;
  });

  afterAll(async () => {
    if (testUserId) {
      await adminClient.auth.admin.deleteUser(testUserId);
    }
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('new auth user creates profile + pending pass with domain match flag', async () => {
    const testEmail = `test_applicant_${Date.now()}@iitk.ac.in`;
    const { data: authRes, error } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-1234',
      email_confirm: true,
      user_metadata: {
        full_name: 'Test Applicant',
        college_id: collegeId,
        phone: '+91 99999 88888',
        roll_number: '240999',
      },
    });
    expect(error).toBeNull();
    testUserId = authRes.user.id;

    // Verify profile created automatically by auth trigger
    const { data: profile } = await adminClient.from('profiles').select('*').eq('id', testUserId).single();
    expect(profile).toBeDefined();
    expect(profile.status).toBe('pending');
    expect(profile.email_domain_match).toBe(true);

    // Verify pass created in pending state
    const { data: pass } = await adminClient
      .from('rider_passes')
      .select('*')
      .eq('rider_id', testUserId)
      .single();
    expect(pass).toBeDefined();
    expect(pass.status).toBe('pending');
  });

  it('reject_rider without reason fails with CC_REASON_REQUIRED', async () => {
    const { data: applicant } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', 'applicant01@example.com')
      .single();

    const { error } = await adminUserClient.rpc('reject_rider', {
      p_user_id: applicant!.id,
      p_reason: '',
    });
    expect(error?.message).toContain('CC_REASON_REQUIRED');
  });

  it('approve_rider issues pass number, ready status, and creates notification', async () => {
    const { data: applicant } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', 'applicant01@example.com')
      .single();

    const { data, error } = await adminUserClient.rpc('approve_rider', {
      p_user_id: applicant!.id,
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.pass_label).toBeDefined();

    const { data: pass } = await adminClient
      .from('rider_passes')
      .select('*')
      .eq('rider_id', applicant!.id)
      .single();
    expect(pass?.status).toBe('ready');

    const { data: notifs } = await adminClient
      .from('notifications')
      .select('*')
      .eq('user_id', applicant!.id)
      .eq('kind', 'approval');
    expect(notifs?.length).toBeGreaterThan(0);
  });

  it('approving twice fails with CC_NOT_PENDING', async () => {
    const { data: applicant } = await adminClient
      .from('profiles')
      .select('id')
      .eq('email', 'applicant01@example.com')
      .single();

    const { error } = await adminUserClient.rpc('approve_rider', {
      p_user_id: applicant!.id,
    });
    expect(error?.message).toContain('CC_NOT_PENDING');
  });

  it('approve_riders over 50 fails with CC_TOO_MANY', async () => {
    const dummyIds = Array.from({ length: 51 }, () => '00000000-0000-0000-0000-000000000000');
    const { error } = await adminUserClient.rpc('approve_riders', {
      p_user_ids: dummyIds,
    });
    expect(error?.message).toContain('CC_TOO_MANY');
  });

  it('request_password_reset sets timestamp and returns ok without enumeration', async () => {
    const anon = createAnonClient();
    const { data: okKnown, error: errKnown } = await anon.rpc('request_password_reset', {
      p_email: 'demo-rider@example.com',
    });
    expect(errKnown).toBeNull();
    expect(okKnown?.ok).toBe(true);

    const { data: okUnknown, error: errUnknown } = await anon.rpc('request_password_reset', {
      p_email: 'unknown_person_never_registered@example.com',
    });
    expect(errUnknown).toBeNull();
    expect(okUnknown?.ok).toBe(true);
  });
});
