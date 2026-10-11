import { AppError, toAppError, type ErrorCode } from '../errors.ts';
import type { CampusClient } from './client.ts';

// Every wrapper goes through these (03 §1): a supabase-js `error` becomes an AppError, and so does a
// rider RPC that answers `{ ok: false, code, data }` instead of raising.

interface Result<T> {
  data: T | null;
  error: unknown;
}

export function unwrap<T>(res: Result<T>): T {
  if (res.error) throw toAppError(res.error);
  const data = res.data as { ok?: unknown } | null;
  if (data !== null && typeof data === 'object' && data.ok === false) throw toAppError(data);
  return res.data as T;
}

// For RPCs that return jsonb: the generated type is `Json`, the real shape is in types.ts.
export function unwrapAs<T>(res: Result<unknown>): T {
  return unwrap(res) as T;
}

export async function requireUid(db: CampusClient): Promise<string> {
  const { data, error } = await db.auth.getSession();
  if (error) throw toAppError(error);
  const uid = data.session?.user.id;
  if (!uid) throw new AppError('CC_NOT_SIGNED_IN');
  return uid;
}

// Edge Functions answer errors as JSON `{ code, message, data? }` (03 §4.2). supabase-js hands the
// Response back in `error.context`; a network failure puts the fetch error there instead.
export async function invoke<T>(db: CampusClient, name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.functions.invoke<T>(name, body ? { body } : undefined);
  if (error) throw await functionError(error);
  return data as T;
}

async function functionError(error: unknown): Promise<AppError> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof TypeError) return toAppError(context);
  if (context && typeof (context as Response).json === 'function') {
    try {
      const body = (await (context as Response).json()) as { code?: unknown; data?: unknown };
      if (typeof body.code === 'string' && /^CC_[A-Z0-9_]+$/.test(body.code)) {
        const data = body.data && typeof body.data === 'object' ? body.data : {};
        return new AppError(body.code as ErrorCode, data as Record<string, unknown>);
      }
    } catch {
      // not JSON: fall through to CC_UNKNOWN
    }
  }
  return toAppError(error);
}
