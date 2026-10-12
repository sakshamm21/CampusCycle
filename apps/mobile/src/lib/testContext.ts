import type { MyContext } from '@campuscycle/shared';

type Overrides = {
  profile?: Partial<MyContext['profile']>;
  college?: MyContext['college'];
  pass?: Partial<MyContext['pass']>;
  ride?: MyContext['ride'];
};

/** An approved rider with a ready pass and no ride; tests override what they need. */
export function makeContext(o: Overrides = {}): MyContext {
  const college: MyContext['college'] = {
    id: 'c1',
    name: 'Test College',
    short_code: 'TC',
    time_zone: 'Asia/Kolkata',
    max_ride_minutes: 120,
    strike_limit: 3,
    default_geofence_m: 40,
    rules_text: '',
    center_lat: null,
    center_lng: null,
  };
  return {
    profile: {
      id: 'u1',
      email: 'rider@example.com',
      full_name: 'Test Rider',
      phone: '+91 90000 00000',
      roll_number: '1',
      role: 'rider',
      status: 'approved',
      strikes: 0,
      is_demo: false,
      demo_role: null,
      is_owner: false,
      theme: 'system',
      notif_prefs: { approval: true, reminders: true, issues: true },
      applied_at: '2026-10-01T00:00:00Z',
      approved_at: '2026-10-01T01:00:00Z',
      rejection_reason: null,
      suspended_reason: null,
      id_photo_path: null,
      id_check_consent: false,
      email_domain_match: false,
      college_id: 'c1',
      ...o.profile,
    },
    college: o.college === undefined ? college : o.college,
    pass: {
      id: 'p1',
      status: 'ready',
      pass_number: 1,
      label: 'TC · 0001',
      total_rides: 0,
      total_minutes: 0,
      finish: 'graphite',
      issued_at: '2026-10-01T01:00:00Z',
      minted_seen_at: '2026-10-01T02:00:00Z',
      borrowed_at: null,
      ...o.pass,
    },
    ride: o.ride ?? null,
  };
}

export const ACTIVE_RIDE: NonNullable<MyContext['ride']> = {
  id: 'r1',
  bike_code: 'K-004',
  bike_id: 'b1',
  start_stand_id: 's1',
  start_stand_name: 'Library',
  started_at: '2026-10-12T10:00:00Z',
  due_at: '2026-10-12T12:00:00Z',
  is_overdue: false,
};
