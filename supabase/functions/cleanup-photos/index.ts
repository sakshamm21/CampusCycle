import { handleOptions, json } from '../_shared/http.ts';
import { requireInternal } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const authErr = requireInternal(req);
  if (authErr) return authErr;

  const db = serviceDb();
  let removedCount = 0;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Clean return photos
  const { data: rides } = await db
    .from('rides')
    .select('id, return_photo_path')
    .not('return_photo_path', 'is', null)
    .lt('ended_at', thirtyDaysAgo)
    .limit(500);

  if (rides && rides.length > 0) {
    const paths = rides.map((r) => r.return_photo_path).filter(Boolean) as string[];
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      await db.storage.from('return-photos').remove(batch);
    }
    const rideIds = rides.map((r) => r.id);
    await db.from('rides').update({ return_photo_path: null }).in('id', rideIds);
    removedCount += paths.length;
  }

  // 2. Clean issue photos of resolved issues older than 30 days
  const { data: issues } = await db
    .from('issue_reports')
    .select('id, photo_path')
    .not('photo_path', 'is', null)
    .eq('status', 'resolved')
    .lt('resolved_at', thirtyDaysAgo)
    .limit(500);

  if (issues && issues.length > 0) {
    const paths = issues.map((i) => i.photo_path).filter(Boolean) as string[];
    for (let i = 0; i < paths.length; i += 100) {
      const batch = paths.slice(i, i + 100);
      await db.storage.from('issue-photos').remove(batch);
    }
    const issueIds = issues.map((i) => i.id);
    await db.from('issue_reports').update({ photo_path: null }).in('id', issueIds);
    removedCount += paths.length;
  }

  return json(200, { ok: true, removed: removedCount });
});
