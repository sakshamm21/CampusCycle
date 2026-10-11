import type { CampusClient } from './client.ts';
import type { Role } from '../types.ts';
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
  center_lat?: number;
  center_lng?: number;
}

export interface UpdateIssueInput {
  status?: IssueStatus | null;
  note?: string;
  assign_to_me?: boolean;
  bike_maintenance?: boolean | null;
}

export async function dashboardStats(db: CampusClient, collegeId: string) {
  const { data, error } = await db.rpc('dashboard_stats', { p_college_id: collegeId });
  if (error) throw error;
  return data;
}

export async function ridesPerDay(db: CampusClient, collegeId: string, days = 30) {
  const { data, error } = await db.rpc('rides_per_day', { p_college_id: collegeId, p_days: days });
  if (error) throw error;
  return data;
}

export async function approveRider(db: CampusClient, userId: string) {
  const { data, error } = await db.rpc('approve_rider', { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function approveRiders(db: CampusClient, ids: string[]) {
  const { data, error } = await db.rpc('approve_riders', { p_user_ids: ids });
  if (error) throw error;
  return data;
}

export async function rejectRider(db: CampusClient, userId: string, reason: string) {
  const { data, error } = await db.rpc('reject_rider', { p_user_id: userId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function suspendRider(db: CampusClient, userId: string, reason: string) {
  const { data, error } = await db.rpc('suspend_rider', { p_user_id: userId, p_reason: reason });
  if (error) throw error;
  return data;
}

export async function reinstateRider(db: CampusClient, userId: string) {
  const { data, error } = await db.rpc('reinstate_rider', { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function resetStrikes(db: CampusClient, userId: string) {
  const { data, error } = await db.rpc('reset_strikes', { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function setUserRole(db: CampusClient, userId: string, role: Role, collegeId?: string | null) {
  const { data, error } = await db.rpc('set_user_role', {
    p_user_id: userId,
    p_role: role as Database['public']['Enums']['user_role'],
    p_college_id: collegeId ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(db: CampusClient, userId: string): Promise<{ temp_password: string }> {
  const { data, error } = await db.functions.invoke<{ temp_password: string }>('admin-reset-password', {
    body: { user_id: userId },
  });
  if (error) throw error;
  if (!data?.temp_password) throw new Error('No password returned');
  return data;
}

export async function forceReturn(
  db: CampusClient,
  rideId: string,
  standId: string,
  note = '',
  addStrike = false,
) {
  const { data, error } = await db.rpc('force_return', {
    p_ride_id: rideId,
    p_stand_id: standId,
    p_note: note,
    p_add_strike: addStrike,
  });
  if (error) throw error;
  return data;
}

export async function markBikeMissing(db: CampusClient, bikeId: string, note = '', addStrike = false) {
  const { data, error } = await db.rpc('mark_bike_missing', {
    p_bike_id: bikeId,
    p_note: note,
    p_add_strike: addStrike,
  });
  if (error) throw error;
  return data;
}

export async function setBikeMaintenance(db: CampusClient, bikeId: string, on: boolean, note = '') {
  const { data, error } = await db.rpc('set_bike_maintenance', {
    p_bike_id: bikeId,
    p_on: on,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function moveBike(db: CampusClient, bikeId: string, standId: string) {
  const { data, error } = await db.rpc('move_bike', { p_bike_id: bikeId, p_stand_id: standId });
  if (error) throw error;
  return data;
}

export async function moveBikes(db: CampusClient, moves: { bike_id: string; stand_id: string }[]) {
  const { data, error } = await db.rpc('move_bikes', { p_moves: moves as unknown as Json });
  if (error) throw error;
  return data;
}

export async function createBikes(
  db: CampusClient,
  collegeId: string,
  standId: string,
  count: number,
  notes = '',
) {
  const { data, error } = await db.rpc('create_bikes', {
    p_college_id: collegeId,
    p_stand_id: standId,
    p_count: count,
    p_notes: notes,
  });
  if (error) throw error;
  return data as unknown as { codes: string[] };
}

export async function updateBikeNotes(db: CampusClient, bikeId: string, notes: string) {
  const { data, error } = await db.rpc('update_bike_notes', { p_bike_id: bikeId, p_notes: notes });
  if (error) throw error;
  return data;
}

export async function retireBike(db: CampusClient, bikeId: string) {
  const { data, error } = await db.rpc('retire_bike', { p_bike_id: bikeId });
  if (error) throw error;
  return data;
}

export async function clearBikeFlag(db: CampusClient, bikeId: string) {
  const { data, error } = await db.rpc('clear_bike_flag', { p_bike_id: bikeId });
  if (error) throw error;
  return data;
}

export async function bikeQrPayloads(db: CampusClient, bikeIds: string[]) {
  const { data, error } = await db.rpc('admin_bike_qr_payloads', { p_bike_ids: bikeIds });
  if (error) throw error;
  return data;
}

export async function upsertStand(db: CampusClient, s: UpsertStandInput) {
  const { data, error } = await db.rpc('upsert_stand', {
    p_id: (s.id ?? undefined) as unknown as string,
    p_college_id: s.college_id,
    p_name: s.name,
    p_lat: s.lat,
    p_lng: s.lng,
    p_radius_m: s.radius_m ?? undefined,
    p_capacity: s.capacity ?? undefined,
    p_active: s.active ?? undefined,
  });
  if (error) throw error;
  return data as unknown as { id: string };
}

export async function scanPass(db: CampusClient, payload: string) {
  const { data, error } = await db.rpc('admin_scan_pass', { p_payload: payload });
  if (error) throw error;
  return data;
}

export async function scanBike(db: CampusClient, payload: string) {
  const { data, error } = await db.rpc('admin_scan_bike', { p_payload: payload });
  if (error) throw error;
  return data;
}

export async function standCheckSubmit(db: CampusClient, standId: string, codes: string[]) {
  const { data, error } = await db.rpc('stand_check_submit', { p_stand_id: standId, p_codes: codes });
  if (error) throw error;
  return data;
}

export async function updateIssue(db: CampusClient, issueId: string, patch: UpdateIssueInput) {
  const { data, error } = await db.rpc('update_issue', {
    p_issue_id: issueId,
    p_status: patch.status ?? undefined,
    p_note: patch.note ?? undefined,
    p_assign_to_me: patch.assign_to_me ?? false,
    p_bike_maintenance: patch.bike_maintenance ?? undefined,
  });
  if (error) throw error;
  return data;
}

export async function updateCollegeSettings(db: CampusClient, s: UpdateCollegeSettingsInput) {
  const { data, error } = await db.rpc('update_college_settings', {
    p_college_id: s.college_id,
    p_name: s.name,
    p_max_ride_minutes: s.max_ride_minutes,
    p_strike_limit: s.strike_limit,
    p_default_geofence_m: s.default_geofence_m,
    p_email_domains: s.email_domains,
    p_center_lat: s.center_lat ?? undefined,
    p_center_lng: s.center_lng ?? undefined,
    p_rules_text: s.rules_text ?? '',
  });
  if (error) throw error;
  return data;
}

export async function createCollege(db: CampusClient, c: CreateCollegeInput) {
  const { data, error } = await db.rpc('create_college', {
    p_name: c.name,
    p_short_code: c.short_code,
    p_time_zone: c.time_zone,
    p_email_domains: c.email_domains,
    p_bike_prefix: c.bike_prefix ?? c.short_code,
    p_center_lat: c.center_lat ?? 0,
    p_center_lng: c.center_lng ?? 0,
  });
  if (error) throw error;
  return data as unknown as { id: string };
}

export async function setCollegeActive(db: CampusClient, id: string, active: boolean) {
  const { data, error } = await db.rpc('set_college_active', { p_college_id: id, p_active: active });
  if (error) throw error;
  return data;
}

export async function collegesOverview(db: CampusClient) {
  const { data, error } = await db.rpc('colleges_overview');
  if (error) throw error;
  return data;
}

export async function aiUsageSummary(db: CampusClient, collegeId?: string | null) {
  const { data, error } = await db.rpc('ai_usage_summary', { p_college_id: collegeId ?? undefined });
  if (error) throw error;
  return data;
}

export async function updateAiSettings(
  db: CampusClient,
  collegeId: string,
  patch: {
    monthly_cap_usd?: number;
    daily_steps?: Json;
    free_only?: boolean;
    features?: Json;
    model_routes?: Json;
  },
) {
  const { data, error } = await db.rpc('update_ai_settings', {
    p_college_id: collegeId,
    p_monthly_cap_usd: patch.monthly_cap_usd,
    p_daily_steps: patch.daily_steps,
    p_free_only: patch.free_only,
    p_features: patch.features,
    p_model_routes: patch.model_routes,
  });
  if (error) throw error;
  return data;
}

export async function setInsightStatus(db: CampusClient, id: string, status: AiInsightStatus) {
  const { data, error } = await db.rpc('set_insight_status', { p_id: id, p_status: status });
  if (error) throw error;
  return data;
}

export async function signedPhotoUrl(db: CampusClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await db.storage.from(bucket).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
