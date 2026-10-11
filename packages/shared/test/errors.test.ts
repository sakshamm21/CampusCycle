import { describe, it, expect, vi } from 'vitest';
import { AppError, toAppError, messageFor } from '../src/errors.ts';
import { en } from '../src/strings/en.ts';

describe('toAppError', () => {
  it('returns AppError directly if already an instance', () => {
    const err = new AppError('CC_BAD_CODE', { code: '123' });
    expect(toAppError(err)).toBe(err);
  });

  it('converts rider RPC failure return { ok: false, code, data }', () => {
    const res = { ok: false, code: 'CC_BIKE_NOT_AVAILABLE', data: { code: 'K-042' } };
    const err = toAppError(res);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('CC_BIKE_NOT_AVAILABLE');
    expect(err.data).toEqual({ code: 'K-042' });
  });

  it('converts PostgREST RPC error with CC_* message and JSON hint', () => {
    const rpcError = {
      message: 'CC_NOT_AT_STAND',
      hint: JSON.stringify({ nearest_stand: 'Hall 5', distance_m: 120 }),
    };
    const err = toAppError(rpcError);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('CC_NOT_AT_STAND');
    expect(err.data).toEqual({ nearest_stand: 'Hall 5', distance_m: 120 });
  });

  it('maps Supabase Auth errors', () => {
    expect(toAppError({ message: 'Invalid login credentials' }).code).toBe('CC_AUTH_INVALID');
    expect(toAppError({ message: 'User already registered' }).code).toBe('CC_EMAIL_TAKEN');
    expect(toAppError({ message: 'Password should be at least 8 characters' }).code).toBe('CC_WEAK_PASSWORD');
    expect(toAppError({ message: 'CC_DEMO_PROTECTED' }).code).toBe('CC_DEMO_PROTECTED');
  });

  it('maps Network TypeError to CC_NETWORK', () => {
    const netErr = new TypeError('Network request failed');
    expect(toAppError(netErr).code).toBe('CC_NETWORK');

    const fetchErr = new TypeError('Failed to fetch');
    expect(toAppError(fetchErr).code).toBe('CC_NETWORK');
  });

  it('falls back to CC_UNKNOWN for unexpected errors', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = toAppError(new Error('Random unexpected crash'));
    expect(err.code).toBe('CC_UNKNOWN');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('messageFor', () => {
  it('returns standard error message without data', () => {
    expect(messageFor('CC_NOT_SIGNED_IN')).toBe(en.errors.CC_NOT_SIGNED_IN);
  });

  it('interpolates variables into error message', () => {
    const msg = messageFor('CC_BIKE_NOT_FOUND', { code: 'K-042' });
    expect(msg).toBe("We couldn't find bike K-042 at your college.");
  });

  it('automatically formats {distance} from distance_m', () => {
    const msg = messageFor('CC_NOT_AT_STAND', { nearest_stand: 'Hall 1', distance_m: 120 });
    expect(msg).toBe("You're not inside a stand. Nearest is Hall 1, 120 m away.");
  });

  it('falls back to CC_UNKNOWN when code is unrecognized', () => {
    const msg = messageFor('CC_NONEXISTENT_CODE');
    expect(msg).toBe(en.errors.CC_UNKNOWN);
  });
});
