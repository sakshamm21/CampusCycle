import { handleOptions, json } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';

const BUCKETS = ['id-cards', 'return-photos', 'issue-photos', 'torq-photos'];

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const { error: authErr, user } = await requireUser(req);
  if (authErr || !user) return authErr!;

  const db = serviceDb();
  // Any failed step stops here with the account intact, so the rider can simply try again.
  const fail = (step: string, message: string) => {
    console.error(`[delete-account] ${step}: ${message}`);
    return json(500, { code: 'CC_UNKNOWN', message: 'Could not delete the account.' });
  };

  // 1. Load caller's profile and pass
  const { data: profile, error: profileErr } = await db
    .from('profiles')
    .select('college_id, is_owner, is_demo, demo_role')
    .eq('id', user.id)
    .maybeSingle();
  if (profileErr) return fail('profile', profileErr.message);
  if (!profile) return json(404, { code: 'CC_USER_NOT_FOUND', message: 'Profile not found.' });

  const { data: pass, error: passErr } = await db
    .from('rider_passes')
    .select('current_bike_id')
    .eq('rider_id', user.id)
    .maybeSingle();
  if (passErr) return fail('pass', passErr.message);

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
      .maybeSingle();
    return json(400, {
      code: 'CC_PASS_HAS_BIKE',
      message: 'Return your bike before deleting your account.',
      data: { bike: bike?.short_code ?? '' },
    });
  }

  // 3. Delete storage objects in caller's folder across all 4 buckets
  for (const bucket of BUCKETS) {
    for (let page = 0; page < 20; page++) {
      const { data: files, error: listErr } = await db.storage.from(bucket).list(user.id, { limit: 1000 });
      if (listErr) return fail(`list ${bucket}`, listErr.message);
      if (!files || files.length === 0) break;
      const { error: removeErr } = await db.storage
        .from(bucket)
        .remove(files.map((f) => `${user.id}/${f.name}`));
      if (removeErr) return fail(`remove ${bucket}`, removeErr.message);
    }
  }

  // 4. Clean AI data (threads cascade to messages and actions)
  const { error: threadsErr } = await db.from('ai_threads').delete().eq('user_id', user.id);
  if (threadsErr) return fail('ai_threads', threadsErr.message);
  const { error: memoriesErr } = await db.from('ai_memories').delete().eq('user_id', user.id);
  if (memoriesErr) return fail('ai_memories', memoriesErr.message);
  const { error: usageErr } = await db.from('ai_usage').delete().eq('pool', `user:${user.id}`);
  if (usageErr) return fail('ai_usage', usageErr.message);

  // 5. Audit log
  const { error: auditErr } = await db.from('audit_log').insert({
    college_id: profile.college_id,
    actor_id: user.id,
    action: 'account.delete',
    target_type: 'profile',
    target_id: user.id,
    via: 'app',
    is_demo: profile.is_demo,
  });
  if (auditErr) return fail('audit_log', auditErr.message);

  // 6. Delete user from auth. The profile cascade removes the pass and notifications;
  //    rides, issues and audit rows stay with the user reference set to null.
  const { error: delErr } = await db.auth.admin.deleteUser(user.id);
  if (delErr) return fail('auth', delErr.message);

  return json(200, { ok: true });
});
