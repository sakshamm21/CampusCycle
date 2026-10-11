import { describe, it, expect } from 'vitest';
import { parseQr, normalizeCode } from '../src/qr.ts';

describe('parseQr', () => {
  it('parses valid bike QR', () => {
    const raw = 'campuscycle://b/K-042?s=abc123DEF456ghi7890123';
    expect(parseQr(raw)).toEqual({
      kind: 'bike',
      code: 'K-042',
      sig: 'abc123DEF456ghi7890123',
    });
  });

  it('parses valid pass QR', () => {
    const raw = 'campuscycle://p/11111111-2222-3333-4444-555555555555?t=12345678&s=abc123DEF456ghi7890123';
    expect(parseQr(raw)).toEqual({
      kind: 'pass',
      payload: raw,
    });
  });

  it('returns unknown for wrong scheme or invalid payload', () => {
    expect(parseQr('https://example.com/b/K-042')).toEqual({ kind: 'unknown' });
    expect(parseQr('campuscycle://other/123')).toEqual({ kind: 'unknown' });
    expect(parseQr('garbage string')).toEqual({ kind: 'unknown' });
    expect(parseQr('')).toEqual({ kind: 'unknown' });
  });
});

describe('normalizeCode', () => {
  it('normalizes various input formats to standard prefix-number', () => {
    expect(normalizeCode('k042')).toBe('K-042');
    expect(normalizeCode('K 042')).toBe('K-042');
    expect(normalizeCode('K-042')).toBe('K-042');
    expect(normalizeCode('k-042')).toBe('K-042');
    expect(normalizeCode('K-0042')).toBe('K-0042');
    expect(normalizeCode('CC-123')).toBe('CC-123');
  });

  it('rejects invalid bike codes', () => {
    expect(normalizeCode('')).toBeNull();
    expect(normalizeCode('xyz')).toBeNull();
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('IITK 123')).toBeNull();
    expect(normalizeCode('TOOLONG-12345')).toBeNull();
  });
});
