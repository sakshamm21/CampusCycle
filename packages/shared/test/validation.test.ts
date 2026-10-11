import { describe, it, expect } from 'vitest';
import {
  SignInSchema,
  SignUpStep1Schema,
  SignUpStep2Schema,
  SignUpSchema,
  UpdateApplicationSchema,
  ReportIssueSchema,
  CollegeSettingsSchema,
  UpsertStandSchema,
  ModelRoutesSchema,
  AiSettingsSchema,
} from '../src/validation.ts';

const UUID = '11111111-1111-4111-8111-111111111111';

interface Case {
  name: string;
  schema: { safeParse: (v: unknown) => { success: boolean } };
  valid: Record<string, unknown>;
  invalid: [why: string, patch: Record<string, unknown>][];
}

const routes = { router: ['a/b:free'], chat: ['a/b:free'], vision: ['a/b:free'], summary: ['a/b:free'] };

const cases: Case[] = [
  {
    name: 'SignInSchema',
    schema: SignInSchema,
    valid: { email: 'aanya@iitk.ac.in', password: 'x' },
    invalid: [
      ['email not valid', { email: 'aanya' }],
      ['password empty', { password: '' }],
    ],
  },
  {
    name: 'SignUpStep1Schema',
    schema: SignUpStep1Schema,
    valid: { full_name: 'Aanya Sharma', phone: '+91 90000 00421', roll_number: '230421' },
    invalid: [
      ['name under 2 chars', { full_name: 'A' }],
      ['name over 120 chars', { full_name: 'A'.repeat(121) }],
      ['phone with letters', { phone: '90000 abcde' }],
      ['phone under 8 chars', { phone: '1234567' }],
      ['roll number under 2 chars', { roll_number: '2' }],
      ['roll number over 40 chars', { roll_number: '2'.repeat(41) }],
    ],
  },
  {
    name: 'SignUpStep2Schema',
    schema: SignUpStep2Schema,
    valid: { email: 'aanya@iitk.ac.in', password: 'long-enough', confirmPassword: 'long-enough' },
    invalid: [
      ['email not valid', { email: 'aanya@' }],
      ['password under 8 chars', { password: 'short', confirmPassword: 'short' }],
      ['confirm differs', { confirmPassword: 'something-else' }],
    ],
  },
  {
    name: 'SignUpSchema',
    schema: SignUpSchema,
    valid: {
      full_name: 'Aanya Sharma',
      phone: '+91 90000 00421',
      roll_number: '230421',
      email: 'aanya@iitk.ac.in',
      password: 'long-enough',
      college_id: UUID,
      id_check_consent: false,
      rules_accepted: true,
    },
    invalid: [
      ['college not a uuid', { college_id: 'iitk' }],
      ['rules not accepted', { rules_accepted: false }],
      ['password under 8 chars', { password: 'short' }],
    ],
  },
  {
    name: 'UpdateApplicationSchema',
    schema: UpdateApplicationSchema,
    valid: { full_name: 'Aanya Sharma', phone: '9000000421', roll_number: '230421', college_id: UUID },
    invalid: [
      ['name under 2 chars', { full_name: 'A' }],
      ['college not a uuid', { college_id: '' }],
    ],
  },
  {
    name: 'ReportIssueSchema',
    schema: ReportIssueSchema,
    valid: { type: 'flat_tyre', note: 'Rear tyre flat', bike_code: 'K-004' },
    invalid: [
      ['unknown type', { type: 'stolen' }],
      ['note over 1000 chars', { note: 'x'.repeat(1001) }],
      ['ride id not a uuid', { ride_id: 'r1' }],
    ],
  },
  {
    name: 'CollegeSettingsSchema',
    schema: CollegeSettingsSchema,
    valid: {
      name: 'IIT Kanpur',
      max_ride_minutes: 240,
      strike_limit: 3,
      default_geofence_m: 40,
      email_domains: ['iitk.ac.in'],
      rules_text: 'Ride on the left.',
    },
    invalid: [
      ['name under 2 chars', { name: 'I' }],
      ['ride time under 15 minutes', { max_ride_minutes: 14 }],
      ['ride time over 1440 minutes', { max_ride_minutes: 1441 }],
      ['strike limit 0', { strike_limit: 0 }],
      ['strike limit over 10', { strike_limit: 11 }],
      ['geofence under 10 m', { default_geofence_m: 9 }],
      ['geofence over 300 m', { default_geofence_m: 301 }],
      ['email domain without a dot', { email_domains: ['iitk'] }],
      ['rules over 8000 chars', { rules_text: 'x'.repeat(8001) }],
    ],
  },
  {
    name: 'UpsertStandSchema',
    schema: UpsertStandSchema,
    valid: { college_id: UUID, name: 'Library', lat: 26.511, lng: 80.2341, radius_m: 40, capacity: 8 },
    invalid: [
      ['name empty', { name: ' ' }],
      ['radius under 10 m', { radius_m: 9 }],
      ['radius over 300 m', { radius_m: 301 }],
      ['capacity 0', { capacity: 0 }],
      ['capacity over 200', { capacity: 201 }],
    ],
  },
  {
    name: 'ModelRoutesSchema',
    schema: ModelRoutesSchema,
    valid: routes,
    invalid: [
      ['a job with no model', { chat: [] }],
      ['a job with more than 5 models', { vision: ['a/b', 'a/c', 'a/d', 'a/e', 'a/f', 'a/g'] }],
      ['a model id under 3 chars', { router: ['ab'] }],
    ],
  },
  {
    name: 'AiSettingsSchema',
    schema: AiSettingsSchema,
    valid: { monthly_cap_usd: 4.5, free_only: true, model_routes: routes },
    invalid: [
      ['cap over US$5', { monthly_cap_usd: 5.5 }],
      ['cap below 0', { monthly_cap_usd: -1 }],
    ],
  },
];

describe.each(cases)('$name', ({ schema, valid, invalid }) => {
  it('accepts the sample valid input', () => {
    expect(schema.safeParse(valid).success).toBe(true);
  });

  it.each(invalid)('rejects %s', (_why, patch) => {
    expect(schema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });
});
