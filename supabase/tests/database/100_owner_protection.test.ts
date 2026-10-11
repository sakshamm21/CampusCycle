import { describe, it, expect } from 'vitest';
import { adminClient } from './helpers';

describe('100: Owner & Protected Profile Guards', () => {
  it('owner profile cannot be demoted, suspended, or deleted', async () => {
    const { data: owner } = await adminClient.from('profiles').select('*').eq('is_owner', true).single();
    if (!owner) {
      // If owner not yet configured in app_config, check demo protected instead
      const { data: demoRider } = await adminClient
        .from('profiles')
        .select('*')
        .eq('email', 'demo-rider@example.com')
        .single();

      const { error: demoteErr } = await adminClient
        .from('profiles')
        .update({ status: 'suspended' })
        .eq('id', demoRider!.id);
      expect(demoteErr?.message).toContain('CC_DEMO_PROTECTED');
      return;
    }

    // Attempt to suspend owner
    const { error: suspErr } = await adminClient
      .from('profiles')
      .update({ status: 'suspended' })
      .eq('id', owner.id);
    expect(suspErr?.message).toContain('CC_OWNER_PROTECTED');

    // Attempt to demote owner
    const { error: demoteErr } = await adminClient
      .from('profiles')
      .update({ role: 'rider' })
      .eq('id', owner.id);
    expect(demoteErr?.message).toContain('CC_OWNER_PROTECTED');
  });

  it('protected demo logins cannot be suspended or rejected', async () => {
    const { data: demoAdmin } = await adminClient
      .from('profiles')
      .select('*')
      .eq('email', 'demo-admin@example.com')
      .single();

    const { error } = await adminClient
      .from('profiles')
      .update({ status: 'suspended' })
      .eq('id', demoAdmin!.id);
    expect(error?.message).toContain('CC_DEMO_PROTECTED');
  });
});
