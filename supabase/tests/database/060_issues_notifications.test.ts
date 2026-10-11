import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { adminClient, createAuthenticatedClient, type SupabaseClient } from './helpers';

describe('060: Issues & Notifications Suite', () => {
  let demoRiderClient: SupabaseClient;
  let demoRiderId: string;

  beforeAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
    demoRiderClient = await createAuthenticatedClient('demo-rider@example.com');

    const { data: user } = await demoRiderClient.auth.getUser();
    demoRiderId = user.user!.id;
  });

  afterAll(async () => {
    await adminClient.rpc('admin_run_demo_reset');
  });

  it('report_issue creates an issue successfully', async () => {
    const { data, error } = await demoRiderClient.rpc('report_issue', {
      p_type: 'flat_tyre',
      p_note: 'Front tyre is completely flat',
      p_bike_code: 'K-001',
    });
    expect(error).toBeNull();
    expect(data?.ok).toBe(true);
    expect(data?.issue_id).toBeDefined();

    // Check issue row in DB
    const { data: issue } = await adminClient
      .from('issue_reports')
      .select('*')
      .eq('id', data.issue_id)
      .single();
    expect(issue?.type).toBe('flat_tyre');
    expect(issue?.status).toBe('open');
  });

  it('mark_notifications_read updates read_at timestamp', async () => {
    // Insert a test notification for demo rider
    const { data: notif } = await adminClient
      .from('notifications')
      .insert({
        user_id: demoRiderId,
        kind: 'admin_alert',
        title: 'Test Notification',
        body: 'Testing mark as read',
      })
      .select('id')
      .single();

    // Mark as read
    const { error } = await demoRiderClient.rpc('mark_notifications_read', {
      p_ids: [notif!.id],
    });
    expect(error).toBeNull();

    const { data: readNotif } = await adminClient
      .from('notifications')
      .select('read_at')
      .eq('id', notif!.id)
      .single();
    expect(readNotif?.read_at).not.toBeNull();
  });
});
