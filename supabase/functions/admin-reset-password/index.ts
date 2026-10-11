import { handleOptions, json } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';
import { generateTempPassword } from '../_shared/words.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const { error: authErr, user, userDb } = await requireUser(req);
  if (authErr || !user || !userDb) return authErr!;

  let body: { user_id?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { code: 'CC_INVALID_INPUT', message: 'Invalid JSON body.' });
  }

  const { user_id } = body;
  if (!user_id) {
    return json(400, { code: 'CC_INVALID_INPUT', message: 'user_id is required.' });
  }

  // 1. Caller verification with get_my_context
  const { data: callerCtx } = await userDb.rpc('get_my_context');
  const callerProfile = callerCtx?.profile;

  if (
    !callerProfile ||
    callerProfile.status !== 'approved' ||
    !['college_admin', 'super_admin'].includes(callerProfile.role)
  ) {
    return json(403, { code: 'CC_FORBIDDEN', message: 'Only approved admins can reset passwords.' });
  }

  const db = serviceDb();
  // 2. Load target profile
  const { data: targetProfile } = await db.from('profiles').select('*').eq('id', user_id).single();
  if (!targetProfile) {
    return json(404, { code: 'CC_USER_NOT_FOUND', message: 'User not found.' });
  }

  // Refusal rules
  if (targetProfile.is_owner) {
    return json(400, { code: 'CC_OWNER_PROTECTED', message: 'Owner password cannot be reset via admin.' });
  }
  if (targetProfile.demo_role) {
    return json(400, {
      code: 'CC_DEMO_PROTECTED',
      message: 'Protected demo accounts cannot have password reset.',
    });
  }
  if (callerProfile.is_demo && !targetProfile.is_demo) {
    return json(403, {
      code: 'CC_DEMO_FORBIDDEN',
      message: 'Demo accounts cannot reset real user accounts.',
    });
  }
  if (callerProfile.role === 'college_admin' && callerProfile.college_id !== targetProfile.college_id) {
    return json(403, { code: 'CC_FORBIDDEN', message: 'Cannot reset passwords for another college.' });
  }

  // 3. Generate temporary password
  const tempPassword = generateTempPassword();

  // 4. Update auth user password
  const { error: pwErr } = await db.auth.admin.updateUserById(user_id, { password: tempPassword });
  if (pwErr) {
    return json(500, { code: 'CC_SERVER_ERROR', message: pwErr.message });
  }

  await db.from('profiles').update({ password_reset_requested_at: null }).eq('id', user_id);

  // 5. Audit log
  await db.from('audit_log').insert({
    college_id: targetProfile.college_id,
    actor_id: user.id,
    action: 'user.reset_password',
    target_type: 'profile',
    target_id: user_id,
    via: 'admin',
    is_demo: targetProfile.is_demo,
  });

  // 6. Notification
  await db.from('notifications').insert({
    user_id,
    kind: 'password_reset',
    title: 'Password reset',
    body: 'Your college admin set a temporary password. Change it in Profile after you sign in.',
    data: { screen: 'profile' },
  });

  return json(200, { ok: true, temp_password: tempPassword });
});
