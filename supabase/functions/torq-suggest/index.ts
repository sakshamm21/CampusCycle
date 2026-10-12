import { handleOptions, json } from '../_shared/http.ts';
import { requireUser } from '../_shared/auth.ts';

// Snap-to-report (03 §4.5). Until the Inspector job arrives in Phase 4 (07 §9.3) this answers the same
// way as when the feature is off or AI is unavailable: no suggestion, so the report form stays empty.
Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;

  const { error: authErr, user } = await requireUser(req);
  if (authErr || !user) return authErr!;

  return json(200, { type: null, note: '', confidence: 0 });
});
