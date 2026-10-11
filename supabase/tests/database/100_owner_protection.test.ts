import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  demoSession,
  must,
  promote,
  raised,
  row,
  type TestUser,
} from './helpers';

describe('100: Owner & Protected Profile Guards', () => {
  let superAdmin: TestUser;
  let owner: { id: string; email: string };

  beforeAll(async () => {
    // No owner means private.app_config.owner_email was not set before the owner signed up
    // (scripts/db.mjs reset does it). Nothing below is meaningful without one, so fail here.
    owner = must(
      await adminClient.from('profiles').select('id, email').eq('is_owner', true).maybeSingle(),
      'the owner profile',
    );
    superAdmin = await createTestUser(null, { name: 'Second Super Admin' });
    await promote(superAdmin.id, 'super_admin');
  });

  afterAll(async () => {
    if (superAdmin) await deleteTestUser(superAdmin.id);
  });

  it('made the account with the configured owner email an approved super admin', async () => {
    if (process.env.OWNER_EMAIL) expect(owner.email).toBe(process.env.OWNER_EMAIL.toLowerCase());
    expect(await row('profiles', owner.id)).toMatchObject({
      role: 'super_admin',
      status: 'approved',
      is_owner: true,
      is_demo: false,
      college_id: null,
    });
  });

  it('refuses another super admin who tries to suspend or demote the owner', async () => {
    const suspend = await superAdmin.client.rpc('suspend_rider', {
      p_user_id: owner.id,
      p_reason: 'Hostile takeover',
    });
    expect(raised(suspend)).toBe('CC_OWNER_PROTECTED');
    for (const role of ['rider', 'college_admin']) {
      const demote = await superAdmin.client.rpc('set_user_role', { p_user_id: owner.id, p_role: role });
      expect(raised(demote), role).toBe('CC_OWNER_PROTECTED');
    }
    expect(await row('profiles', owner.id)).toMatchObject({
      role: 'super_admin',
      status: 'approved',
      is_owner: true,
    });
  });

  it('refuses every direct change to the owner row, even with the service key', async () => {
    const changes = [
      { status: 'suspended' },
      { status: 'rejected' },
      { status: 'pending' },
      { role: 'rider' },
      { role: 'college_admin' },
      { is_owner: false },
    ];
    for (const change of changes) {
      const { error } = await adminClient.from('profiles').update(change).eq('id', owner.id);
      expect(error?.message, JSON.stringify(change)).toBe('CC_OWNER_PROTECTED');
    }
    const { error } = await adminClient.from('profiles').delete().eq('id', owner.id);
    expect(error?.message).toBe('CC_OWNER_PROTECTED');

    expect(await row('profiles', owner.id)).toMatchObject({
      role: 'super_admin',
      status: 'approved',
      is_owner: true,
    });
  });

  it('allows only one owner', async () => {
    const { error } = await adminClient.from('profiles').update({ is_owner: true }).eq('id', superAdmin.id);
    expect(error?.code).toBe('23505');
    expect((await row('profiles', superAdmin.id)).is_owner).toBe(false);
  });

  it('refuses to suspend, reject or demote a protected demo login', async () => {
    const demoAdmin = await demoSession('admin');

    const suspend = await superAdmin.client.rpc('suspend_rider', {
      p_user_id: demoAdmin.id,
      p_reason: 'Testing',
    });
    expect(raised(suspend)).toBe('CC_DEMO_PROTECTED');
    const demote = await superAdmin.client.rpc('set_user_role', { p_user_id: demoAdmin.id, p_role: 'rider' });
    expect(raised(demote)).toBe('CC_DEMO_PROTECTED');

    for (const change of [{ status: 'suspended' }, { status: 'rejected' }, { role: 'rider' }]) {
      const { error } = await adminClient.from('profiles').update(change).eq('id', demoAdmin.id);
      expect(error?.message, JSON.stringify(change)).toBe('CC_DEMO_PROTECTED');
    }
    expect(await row('profiles', demoAdmin.id)).toMatchObject({ role: 'college_admin', status: 'approved' });
  });
});
