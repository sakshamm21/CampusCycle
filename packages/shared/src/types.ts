export type Role = 'rider' | 'college_admin' | 'super_admin';
export type ProfileStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
export type PassStatus = 'pending' | 'ready' | 'riding' | 'overdue' | 'suspended';
export type Finish = 'graphite' | 'chrome' | 'holo';
export type IssueType =
  | 'flat_tyre'
  | 'brakes'
  | 'chain'
  | 'damaged_qr'
  | 'bike_missing'
  | 'accident'
  | 'ride_close_request'
  | 'other';

export interface MyContext {
  profile: {
    id: string;
    email: string;
    full_name: string;
    phone: string;
    roll_number: string;
    role: Role;
    status: ProfileStatus;
    strikes: number;
    is_demo: boolean;
    demo_role: Role | null;
    is_owner: boolean;
    theme: 'system' | 'dark' | 'day';
    notif_prefs: { approval: boolean; reminders: boolean; issues: boolean };
    applied_at: string;
    approved_at: string | null;
    rejection_reason: string | null;
    suspended_reason: string | null;
    id_photo_path: string | null;
    id_check_consent: boolean;
    email_domain_match: boolean;
    college_id: string | null;
  };
  college: {
    id: string;
    name: string;
    short_code: string;
    time_zone: string;
    max_ride_minutes: number;
    strike_limit: number;
    default_geofence_m: number;
    rules_text: string;
    center_lat: number | null;
    center_lng: number | null;
  } | null;
  pass: {
    id: string;
    status: PassStatus;
    pass_number: number | null;
    label: string | null;
    total_rides: number;
    total_minutes: number;
    finish: Finish;
    issued_at: string | null;
    minted_seen_at: string | null;
    borrowed_at: string | null;
  };
  ride: {
    id: string;
    bike_code: string;
    bike_id: string;
    start_stand_id: string;
    start_stand_name: string;
    started_at: string;
    due_at: string;
    is_overdue: boolean;
  } | null;
}

export interface StandWithCounts {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  active: boolean;
  free_bikes: number;
  maintenance_bikes: number;
  total_bikes: number;
  distance_m: number | null;
}

export interface GeoFix {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  isMock: boolean;
}

export interface BorrowPreview {
  bike: { id: string; code: string; last_seen_at: string | null; notes: string };
  stand: { id: string; name: string };
  max_ride_minutes: number;
  due_at: string;
  manual: boolean;
}

export interface BorrowResult {
  ride_id: string;
  bike_code: string;
  stand_id: string;
  stand_name: string;
  started_at: string;
  due_at: string;
}

export interface ReturnCheck {
  stand_id: string;
  stand_name: string;
  distance_m?: number;
  demo?: boolean;
  stand_full: boolean;
  bike_code: string;
}

export interface ReturnResult {
  ride_id: string;
  bike_code: string;
  start_stand_name: string;
  end_stand_name: string;
  started_at: string;
  ended_at: string;
  minutes: number;
  late: boolean;
  stand_full: boolean;
  strikes: number | null;
  suspended: boolean;
  total_rides: number;
  finish_before: Finish;
  finish_after: Finish;
  photo_pending: boolean;
}

export interface PassStats {
  rides: number;
  minutes: number;
  fave_stand: string | null;
  strikes: number;
  finish: Finish;
  next_finish: Finish | null;
  rides_to_next: number;
}

export interface IdCheckResult {
  match: 'yes' | 'no' | 'unsure';
  name_ok: boolean;
  roll_ok: boolean;
  college_ok: boolean;
  notes: string;
  model: string;
  checked_at: string;
}

export interface ScanPassResult {
  holder: {
    user_id: string;
    name: string;
    roll_number: string;
    status: ProfileStatus;
    strikes: number;
    id_photo_path: string | null;
    pass_label: string;
    pass_status: PassStatus;
  };
  bike: {
    code: string;
    since: string;
    from_stand: string | null;
    ride_id: string;
    due_at: string;
    is_overdue: boolean;
  } | null;
}

export interface ScanBikeResult {
  signed: boolean;
  bike: {
    id: string;
    code: string;
    status: string;
    stand_id: string | null;
    stand_name: string | null;
    last_seen_at: string | null;
    ai_flag: string | null;
    notes: string;
  };
  holder: {
    user_id: string;
    name: string;
    pass_label: string;
    since: string;
    ride_id: string;
    from_stand: string | null;
    due_at: string;
    is_overdue: boolean;
  } | null;
}

export interface StandCheckResult {
  stand: string;
  seen: string[];
  missing: { code: string; last_seen_at: string | null }[];
  unexpected: { code: string; status: string; recorded_stand: string | null }[];
}
