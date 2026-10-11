import { en } from './strings/en.ts';
import { formatDistance } from './format.ts';

export type ErrorCode = keyof typeof en.errors;

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public data: Record<string, unknown> = {},
  ) {
    super(code);
    this.name = 'AppError';
  }
}

function safeJson(hint: unknown): Record<string, unknown> {
  if (!hint) return {};
  if (typeof hint === 'object' && !Array.isArray(hint)) {
    return hint as Record<string, unknown>;
  }
  if (typeof hint === 'string') {
    try {
      const parsed = JSON.parse(hint);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export function toAppError(e: unknown): AppError {
  if (e instanceof AppError) {
    return e;
  }

  if (e && typeof e === 'object') {
    const obj = e as Record<string, unknown>;

    // Rider RPC failure return pattern: { ok: false, code: 'CC_...', data?: {} }
    if (obj.ok === false && typeof obj.code === 'string' && /^CC_[A-Z0-9_]+$/.test(obj.code)) {
      const data = (obj.data && typeof obj.data === 'object' ? obj.data : {}) as Record<string, unknown>;
      return new AppError(obj.code as ErrorCode, data);
    }

    // PostgREST RPC error pattern: error.message = 'CC_...' and error.hint = '{...}'
    if (typeof obj.message === 'string' && /^CC_[A-Z0-9_]+$/.test(obj.message)) {
      return new AppError(obj.message as ErrorCode, safeJson(obj.hint));
    }

    // Auth error handling
    const msg = typeof obj.message === 'string' ? obj.message : '';
    if (msg.includes('CC_DEMO_PROTECTED') || (obj.status === 500 && msg.includes('demo'))) {
      return new AppError('CC_DEMO_PROTECTED');
    }
    if (msg.toLowerCase().includes('invalid login credentials')) {
      return new AppError('CC_AUTH_INVALID');
    }
    if (msg.toLowerCase().includes('already registered')) {
      return new AppError('CC_EMAIL_TAKEN');
    }
    if (msg.toLowerCase().includes('password should be') || msg.toLowerCase().includes('weak')) {
      return new AppError('CC_WEAK_PASSWORD');
    }
  }

  // Network error detection
  if (e instanceof TypeError) {
    const msg = e.message.toLowerCase();
    if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
      return new AppError('CC_NETWORK');
    }
  }

  // Unknown fallback
  console.error('[CampusCycle] Unhandled error converted to AppError:', e);
  return new AppError('CC_UNKNOWN');
}

export function messageFor(code: string, data?: Record<string, unknown>): string {
  const template = (en.errors as Record<string, string>)[code] ?? en.errors.CC_UNKNOWN;
  if (!data) return template;

  const vars: Record<string, unknown> = { ...data };
  if ('distance_m' in vars && typeof vars.distance_m === 'number') {
    vars.distance = formatDistance(vars.distance_m);
  }

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined && value !== null) {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
    }
  }

  return result;
}
