import { handleOptions, json } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const { error: authErr, user } = await requireUser(req);
  if (authErr || !user) return authErr!;

  const db = serviceDb();

  // 1. Load caller's profile and pass
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
  const { data: pass } = await db.from('rider_passes').select('*').eq('rider_id', user.id).single();

  if (!profile) {
    return json(404, { code: 'CC_USER_NOT_FOUND', message: 'Profile not found.' });
  }

  // 2. Refusal checks
  if (profile.is_owner) {
    return json(400, { code: 'CC_OWNER_PROTECTED', message: 'The owner account cannot be deleted.' });
  }
  if (profile.demo_role) {
    return json(400, { code: 'CC_DEMO_PROTECTED', message: 'Protected demo accounts cannot be deleted.' });
  }
  if (pass?.current_bike_id) {
    const { data: bike } = await db
      .from('bikes')
      .select('short_code')
      .eq('id', pass.current_bike_id)
      .single();
    return json(400, {
      code: 'CC_PASS_HAS_BIKE',
      message: 'Return your bike before deleting your account.',
      bike: bike?.short_code ?? '',
    });
  }

  // 3. Delete storage objects in caller's folder across all 4 buckets
  const buckets = ['id-cards', 'return-photos', 'issue-photos', 'torq-photos'];
  for (const bucket of buckets) {
    const { data: files } = await db.storage.from(bucket).list(user.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      await db.storage.from(bucket).remove(paths);
    }
  }

  // 4. Clean AI data
  await db.from('ai_threads').delete().eq('user_id', user.id);
  await db.from('ai_memories').delete().eq('user_id', user.id);
  await db.from('ai_usage').delete().eq('pool', `user:${user.id}`);

  // 5. Audit log
  if (profile.college_id) {
    await db.from('audit_log').insert({
      college_id: profile.college_id,
      actor_id: user.id,
      action: 'account.delete',
      target_type: 'profile',
      target_id: user.id,
      via: 'app',
    });
  }

  // 6. Delete user from auth
  const { error: delErr } = await db.auth.admin.deleteUser(user.id);
  if (delErr) {
    return json(500, { code: 'CC_SERVER_ERROR', message: delErr.message });
  }

  return json(200, { ok: true });
});
