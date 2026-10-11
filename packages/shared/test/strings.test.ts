import { describe, it, expect } from 'vitest';
import { en, t } from '../src/strings/en.ts';

const REQUIRED_ERROR_CODES = [
  'CC_NOT_SIGNED_IN',
  'CC_NOT_APPROVED',
  'CC_PASS_SUSPENDED',
  'CC_RATE_LIMITED',
  'CC_BAD_CODE',
  'CC_BAD_QR',
  'CC_BIKE_NOT_FOUND',
  'CC_PASS_HAS_BIKE',
  'CC_BIKE_IN_MAINTENANCE',
  'CC_BIKE_NOT_AVAILABLE',
  'CC_BIKE_NOT_AT_THIS_STAND',
  'CC_MOCK_LOCATION',
  'CC_NO_LOCATION',
  'CC_POOR_ACCURACY',
  'CC_NOT_AT_STAND',
  'CC_NO_BIKE_ON_PASS',
  'CC_WRONG_BIKE',
  'CC_BAD_PHOTO_PATH',
  'CC_RIDE_NOT_FOUND',
  'CC_RIDE_NOT_ACTIVE',
  'CC_INVALID_INPUT',
  'CC_COLLEGE_NOT_FOUND',
  'CC_NOT_EDITABLE',
  'CC_FORBIDDEN',
  'CC_STAND_NOT_FOUND',
  'CC_USER_NOT_FOUND',
  'CC_NOT_PENDING',
  'CC_REASON_REQUIRED',
  'CC_TOO_MANY',
  'CC_OWNER_PROTECTED',
  'CC_DEMO_PROTECTED',
  'CC_DEMO_FORBIDDEN',
  'CC_DEMO_READONLY',
  'CC_NOT_SUSPENDED',
  'CC_COLLEGE_REQUIRED',
  'CC_STAND_REQUIRED',
  'CC_ISSUE_NOT_FOUND',
  'CC_NOT_FOUND',
  'CC_PASS_QR_EXPIRED',
  'CC_DUPLICATE',
  'CC_CAP_TOO_HIGH',
  'CC_INTEGRITY_BIKE_PASS',
  'CC_NETWORK',
  'CC_UNKNOWN',
  'CC_AUTH_INVALID',
  'CC_EMAIL_TAKEN',
  'CC_WEAK_PASSWORD',
  'CC_NOT_ADMIN',
  'CC_CAMERA_DENIED',
  'CC_LOCATION_DENIED',
  'CC_LOCATION_TIMEOUT',
  'CC_UPLOAD_FAILED',
  'CC_AI_UNAVAILABLE',
  'CC_AI_DAILY_LIMIT',
  'CC_AI_DEMO_POOL_EMPTY',
  'CC_AI_GUARDRAIL',
  'CC_AI_MESSAGE_TOO_LONG',
  'CC_AI_FEATURE_OFF',
  'CC_ACTION_EXPIRED',
  'CC_ACTION_NOT_FOUND',
];

describe('strings and translations', () => {
  it('has copy for every documented error code', () => {
    for (const code of REQUIRED_ERROR_CODES) {
      expect(en.errors).toHaveProperty(code);
      expect((en.errors as Record<string, string>)[code]?.length).toBeGreaterThan(0);
    }
  });

  it('translates nested paths and replaces variables', () => {
    expect(t('common.cancel')).toBe('Cancel');
    expect(t('errors.CC_BIKE_NOT_FOUND', { code: 'K-001' })).toBe(
      "We couldn't find bike K-001 at your college.",
    );
    expect(t('nonexistent.path')).toBe('nonexistent.path');
  });
});
