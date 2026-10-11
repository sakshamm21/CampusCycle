import { handleOptions, json } from '../_shared/http.ts';
import { requireInternal } from '../_shared/auth.ts';
import { serviceDb } from '../_shared/clients.ts';

const MAX_PER_RUN = 500;
const BATCH = 100;

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const authErr = requireInternal(req);
  if (authErr) return authErr;

  const db = serviceDb();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let removed = 0;

  // Removes the files, then clears the column only for rows whose file is really gone,
  // so a failed delete is retried on the next run instead of leaving an orphan.
  async function purge(
    bucket: string,
    table: 'rides' | 'issue_reports',
    column: 'return_photo_path' | 'photo_path',
    rows: { id: string; path: string }[],
  ) {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await db.storage.from(bucket).remove(batch.map((r) => r.path));
      if (error) {
        console.error(`[cleanup-photos] ${bucket}: ${error.message}`);
        continue;
      }
      const { error: updateErr } = await db
        .from(table)
        .update({ [column]: null })
        .in(
          'id',
          batch.map((r) => r.id),
        );
      if (updateErr) {
        console.error(`[cleanup-photos] ${table}: ${updateErr.message}`);
        continue;
      }
      removed += batch.length;
    }
  }

  // 1. Return photos of rides that ended more than 30 days ago
  const { data: rides, error: ridesErr } = await db
    .from('rides')
    .select('id, return_photo_path')
    .not('return_photo_path', 'is', null)
    .lt('ended_at', cutoff)
    .limit(MAX_PER_RUN);
  if (ridesErr) return json(500, { code: 'CC_UNKNOWN', message: ridesErr.message });
  await purge(
    'return-photos',
    'rides',
    'return_photo_path',
    (rides ?? []).map((r) => ({ id: r.id, path: r.return_photo_path as string })),
  );

  // 2. Photos of issues resolved more than 30 days ago
  const { data: issues, error: issuesErr } = await db
    .from('issue_reports')
    .select('id, photo_path')
    .not('photo_path', 'is', null)
    .eq('status', 'resolved')
    .lt('resolved_at', cutoff)
    .limit(MAX_PER_RUN);
  if (issuesErr) return json(500, { code: 'CC_UNKNOWN', message: issuesErr.message });
  await purge(
    'issue-photos',
    'issue_reports',
    'photo_path',
    (issues ?? []).map((r) => ({ id: r.id, path: r.photo_path as string })),
  );

  // 3. TORQ chat photos older than 30 days. No table points at them, so list each user's folder.
  const stale: string[] = [];
  const { data: folders, error: foldersErr } = await db.storage.from('torq-photos').list('', { limit: 1000 });
  if (foldersErr) return json(500, { code: 'CC_UNKNOWN', message: foldersErr.message });
  for (const folder of folders ?? []) {
    if (stale.length >= MAX_PER_RUN) break;
    const { data: files, error: filesErr } = await db.storage
      .from('torq-photos')
      .list(folder.name, { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
    if (filesErr) {
      console.error(`[cleanup-photos] torq-photos/${folder.name}: ${filesErr.message}`);
      continue;
    }
    for (const file of files ?? []) {
      if (stale.length >= MAX_PER_RUN) break;
      if (file.created_at && file.created_at < cutoff) stale.push(`${folder.name}/${file.name}`);
    }
  }
  for (let i = 0; i < stale.length; i += BATCH) {
    const batch = stale.slice(i, i + BATCH);
    const { error } = await db.storage.from('torq-photos').remove(batch);
    if (error) {
      console.error(`[cleanup-photos] torq-photos: ${error.message}`);
      continue;
    }
    removed += batch.length;
  }

  return json(200, { ok: true, removed });
});
