import { handleOptions, json } from '../_shared/http.ts';
import { requireInternal } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const authErr = requireInternal(req);
  if (authErr) return authErr;

  let body: { notification_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: 'CC_INVALID_INPUT', message: 'Invalid JSON body.' });
  }

  const { notification_id } = body;
  if (!notification_id) {
    return json(400, { code: 'CC_INVALID_INPUT', message: 'notification_id is required.' });
  }

  const db = serviceDb();
  const { data: notif, error: notifErr } = await db
    .from('notifications')
    .select('id, user_id, title, body, data')
    .eq('id', notification_id)
    .single();

  if (notifErr || !notif) {
    return json(404, { code: 'CC_NOT_FOUND', message: 'Notification not found.' });
  }

  const { data: profile } = await db.from('profiles').select('push_token').eq('id', notif.user_id).single();

  if (!profile?.push_token) {
    await db.from('notifications').update({ push_error: 'no_token' }).eq('id', notification_id);
    return json(200, { ok: true, skipped: 'no_token' });
  }

  const pushPayload = {
    to: profile.push_token,
    title: notif.title,
    body: notif.body,
    sound: 'default',
    priority: 'high',
    channelId: 'default',
    data: {
      notification_id: notif.id,
      ...(typeof notif.data === 'object' && notif.data !== null ? notif.data : {}),
    },
  };

  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pushPayload),
    });

    const resJson = await res.json();
    const ticket = resJson?.data;

    if (ticket?.status === 'ok') {
      await db
        .from('notifications')
        .update({ pushed_at: new Date().toISOString() })
        .eq('id', notification_id);
      return json(200, { ok: true });
    }

    if (ticket?.details?.error === 'DeviceNotRegistered') {
      await db.from('profiles').update({ push_token: null }).eq('id', notif.user_id);
      await db.from('notifications').update({ push_error: 'DeviceNotRegistered' }).eq('id', notification_id);
      return json(200, { ok: true, cleared_token: true });
    }

    const errMsg = (ticket?.message || ticket?.details?.error || 'Push error').slice(0, 200);
    await db.from('notifications').update({ push_error: errMsg }).eq('id', notification_id);
    return json(200, { ok: false, error: errMsg });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown push failure';
    await db
      .from('notifications')
      .update({ push_error: message.slice(0, 200) })
      .eq('id', notification_id);
    return json(500, { code: 'CC_UNKNOWN', message });
  }
});
