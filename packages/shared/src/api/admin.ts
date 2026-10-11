import type { CampusClient } from './client.ts';
import { invoke, unwrap, unwrapAs } from './call.ts';
import { toAppError } from '../errors.ts';
import type { Role, ScanBikeResult, ScanPassResult, StandCheckResult } from '../types.ts';
import type { Database, Json } from '../database.types.ts';

type IssueStatus = Database['public']['Enums']['issue_status'];
type AiInsightStatus = Database['public']['Enums']['ai_insight_status'];

export interface UpsertStandInput {
  id?: string | null;
  college_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m?: number;
  capacity?: number;
  active?: boolean;
}

export interface UpdateCollegeSettingsInput {
  college_id: string;
  name: string;
  max_ride_minutes: number;
  strike_limit: number;
  default_geofence_m: number;
  email_domains: string[];
  center_lat?: number | null;
  center_lng?: number | null;
  rules_text?: string | null;
}

export interface CreateCollegeInput {
  name: string;
  short_code: string;
  time_zone: string;
  email_domains: string[];
  bike_prefix?: string;
  center_lat?: number | null;
  center_lng?: number | null;
}

export interface UpdateIssueInput {
  status?: IssueStatus | null;
  note?: string;
  assign_to_me?: boolean;
  bike_maintenance?: boolean | null;
}

// The generated types mark an argument without a SQL default as non-null even where the function
// accepts null (a new stand's id, a college without a centre, the global AI settings row).
// PostgREST needs the key present, so these are sent as an explicit null.
const sqlNull = null as unknown as string & number;

export async function dashboardStats(db: CampusClient, collegeId: string) {
  return unwrap(await db.rpc('dashboard_stats', { p_college_id: collegeId }));
}

export async function ridesPerDay(db: CampusClient, collegeId: string, days = 30) {
  return unwrap(await db.rpc('rides_per_day', { p_college_id: collegeId, p_days: days })) ?? [];
}

export async function approveRider(db: CampusClient, userId: string) {
  return unwrapAs<{ pass_label: string }>(await db.rpc('approve_rider', { p_user_id: userId }));
}

export async function approveRiders(db: CampusClient, ids: string[]) {
  return unwrapAs<{ approved: number; failed: { user_id: string; code: string }[] }>(
    await db.rpc('approve_riders', { p_user_ids: ids }),
  );
}

export async function rejectRider(db: CampusClient, userId: string, reason: string): Promise<void> {
  unwrap(await db.rpc('reject_rider', { p_user_id: userId, p_reason: reason }));
}

export async function suspendRider(db: CampusClient, userId: string, reason: string): Promise<void> {
  unwrap(await db.rpc('suspend_rider', { p_user_id: userId, p_reason: reason }));
}

export async function reinstateRider(db: CampusClient, userId: string): Promise<void> {
  unwrap(await db.rpc('reinstate_rider', { p_user_id: userId }));
}

export async function resetStrikes(db: CampusClient, userId: string): Promise<void> {
  unwrap(await db.rpc('reset_strikes', { p_user_id: userId }));
}

export async function setUserRole(
  db: CampusClient,
  userId: string,
  role: Role,
  collegeId?: string | null,
): Promise<void> {
  unwrap(
    await db.rpc('set_user_role', {
      p_user_id: userId,
      p_role: role as Database['public']['Enums']['user_role'],
      p_college_id: collegeId ?? undefined,
    }),
  );
}

export async function resetPassword(db: CampusClient, userId: string): Promise<{ temp_password: string }> {
  return invoke<{ temp_password: string }>(db, 'admin-reset-password', { user_id: userId });
}

export async function forceReturn(
  db: CampusClient,
  rideId: string,
  standId: string,
  note: string,
  addStrike = false,
): Promise<void> {
  unwrap(
    await db.rpc('force_return', {
      p_ride_id: rideId,
      p_stand_id: standId,
      p_note: note,
      p_add_strike: addStrike,
    }),
  );
}

export async function markBikeMissing(
  db: CampusClient,
  bikeId: string,
  note: string,
  addStrike = false,
): Promise<void> {
  unwrap(await db.rpc('mark_bike_missing', { p_bike_id: bikeId, p_note: note, p_add_strike: addStrike }));
}

export async function setBikeMaintenance(db: CampusClient, bikeId: string, on: boolean, note = '') {
  return unwrapAs<{ result: 'now' | 'after_return' | 'available' | 'unchanged' }>(
    await db.rpc('set_bike_maintenance', { p_bike_id: bikeId, p_on: on, p_note: note }),
  );
}

export async function moveBike(db: CampusClient, bikeId: string, standId: string): Promise<void> {
  unwrap(await db.rpc('move_bike', { p_bike_id: bikeId, p_stand_id: standId }));
}

export async function moveBikes(db: CampusClient, moves: { bike_code: string; stand_id: string }[]) {
  return unwrapAs<{ moved: number }>(await db.rpc('move_bikes', { p_moves: moves }));
}

export async function createBikes(
  db: CampusClient,
  collegeId: string,
  standId: string,
  count: number,
  notes = '',
) {
  return unwrapAs<{ codes: string[] }>(
    await db.rpc('create_bikes', {
      p_college_id: collegeId,
      p_stand_id: standId,
      p_count: count,
      p_notes: notes,
    }),
  );
}

export async function updateBikeNotes(db: CampusClient, bikeId: string, notes: string): Promise<void> {
  unwrap(await db.rpc('update_bike_notes', { p_bike_id: bikeId, p_notes: notes }));
}

export async function retireBike(db: CampusClient, bikeId: string): Promise<void> {
  unwrap(await db.rpc('retire_bike', { p_bike_id: bikeId }));
}

export async function clearBikeFlag(db: CampusClient, bikeId: string): Promise<void> {
  unwrap(await db.rpc('clear_bike_flag', { p_bike_id: bikeId }));
}

export async function bikeQrPayloads(db: CampusClient, bikeIds: string[]) {
  return unwrap(await db.rpc('admin_bike_qr_payloads', { p_bike_ids: bikeIds })) ?? [];
}

export async function upsertStand(db: CampusClient, s: UpsertStandInput) {
  return unwrapAs<{ id: string }>(
    await db.rpc('upsert_stand', {
      p_id: s.id ?? sqlNull,
      p_college_id: s.college_id,
      p_name: s.name,
      p_lat: s.lat,
      p_lng: s.lng,
      p_radius_m: s.radius_m ?? undefined,
      p_capacity: s.capacity ?? undefined,
      p_active: s.active ?? undefined,
    }),
  );
}

export async function scanPass(db: CampusClient, payload: string) {
  return unwrapAs<ScanPassResult>(await db.rpc('admin_scan_pass', { p_payload: payload }));
}

export async function scanBike(db: CampusClient, payload: string) {
  return unwrapAs<ScanBikeResult>(await db.rpc('admin_scan_bike', { p_payload: payload }));
}

export async function standCheckSubmit(db: CampusClient, standId: string, codes: string[]) {
  return unwrapAs<StandCheckResult>(
    await db.rpc('stand_check_submit', { p_stand_id: standId, p_codes: codes }),
  );
}

export async function updateIssue(db: CampusClient, issueId: string, patch: UpdateIssueInput): Promise<void> {
  unwrap(
    await db.rpc('update_issue', {
      p_issue_id: issueId,
      p_status: patch.status ?? undefined,
      p_note: patch.note ?? undefined,
      p_assign_to_me: patch.assign_to_me ?? false,
      p_bike_maintenance: patch.bike_maintenance ?? undefined,
    }),
  );
}

export async function updateCollegeSettings(db: CampusClient, s: UpdateCollegeSettingsInput): Promise<void> {
  unwrap(
    await db.rpc('update_college_settings', {
      p_college_id: s.college_id,
      p_name: s.name,
      p_max_ride_minutes: s.max_ride_minutes,
      p_strike_limit: s.strike_limit,
      p_default_geofence_m: s.default_geofence_m,
      p_email_domains: s.email_domains,
      p_center_lat: s.center_lat ?? undefined,
      p_center_lng: s.center_lng ?? undefined,
      p_rules_text: s.rules_text ?? '',
    }),
  );
}

export async function createCollege(db: CampusClient, c: CreateCollegeInput) {
  return unwrapAs<{ id: string }>(
    await db.rpc('create_college', {
      p_name: c.name,
      p_short_code: c.short_code,
      p_time_zone: c.time_zone,
      p_email_domains: c.email_domains,
      p_bike_prefix: c.bike_prefix ?? c.short_code,
      p_center_lat: c.center_lat ?? sqlNull,
      p_center_lng: c.center_lng ?? sqlNull,
    }),
  );
}

export async function setCollegeActive(db: CampusClient, id: string, active: boolean): Promise<void> {
  unwrap(await db.rpc('set_college_active', { p_college_id: id, p_active: active }));
}

export async function collegesOverview(db: CampusClient) {
  return unwrap(await db.rpc('colleges_overview')) ?? [];
}

// collegeId null = every college (super admin only)
export async function aiUsageSummary(db: CampusClient, collegeId: string | null) {
  return unwrap(await db.rpc('ai_usage_summary', { p_college_id: collegeId ?? undefined }));
}

// collegeId null = the global row: cap, daily steps, routes, free-only (super admin only).
// A college row holds only its feature switches.
export async function updateAiSettings(
  db: CampusClient,
  collegeId: string | null,
  patch: {
    monthly_cap_usd?: number;
    daily_steps?: Json;
    free_only?: boolean;
    features?: Json;
    model_routes?: Json;
  },
): Promise<void> {
  unwrap(
    await db.rpc('update_ai_settings', {
      p_college_id: collegeId ?? sqlNull,
      p_monthly_cap_usd: patch.monthly_cap_usd,
      p_daily_steps: patch.daily_steps,
      p_free_only: patch.free_only,
      p_features: patch.features,
      p_model_routes: patch.model_routes,
    }),
  );
}

export async function setInsightStatus(db: CampusClient, id: string, status: AiInsightStatus): Promise<void> {
  unwrap(await db.rpc('set_insight_status', { p_id: id, p_status: status }));
}

export async function signedPhotoUrl(db: CampusClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 600);
  if (error) throw toAppError(error);
  return data.signedUrl;
}
