import type { CampusClient } from './client.ts';
import { invoke, requireUid, unwrap, unwrapAs } from './call.ts';
import { AppError, toAppError } from '../errors.ts';
import type { Database } from '../database.types.ts';
import type {
  MyContext,
  StandWithCounts,
  GeoFix,
  BorrowPreview,
  BorrowResult,
  ReturnCheck,
  ReturnResult,
  PassStats,
  IssueType,
  IdCheckResult,
} from '../types.ts';

export interface SignUpInput {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  roll_number: string;
  college_id: string;
  id_check_consent?: boolean;
}

export interface UpdateApplicationInput {
  full_name: string;
  phone: string;
  roll_number: string;
  college_id: string;
}

export interface ReportIssueInput {
  type: IssueType;
  note?: string | null;
  bike_code?: string | null;
  ride_id?: string | null;
  stand_id?: string | null;
  photo_path?: string | null;
  ai_suggested_type?: IssueType | null;
}

export interface StandDetail {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  active: boolean;
  bikes: { id: string; code: string; status: string; last_seen_at: string | null }[];
}

// Rider RPCs take the fix as four arguments. Demo accounts send a fix with null coordinates.
function fixArgs(fix?: GeoFix | null) {
  return {
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
    p_accuracy: fix?.accuracy ?? undefined,
    p_is_mock: fix?.isMock ?? false,
  };
}

export async function getMyContext(db: CampusClient): Promise<MyContext | null> {
  return unwrapAs<MyContext | null>(await db.rpc('get_my_context'));
}

export async function listColleges(db: CampusClient) {
  return unwrap(await db.rpc('list_colleges_public')) ?? [];
}

export async function signUp(db: CampusClient, input: SignUpInput) {
  const { data, error } = await db.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.full_name,
        phone: input.phone,
        roll_number: input.roll_number,
        college_id: input.college_id,
        id_check_consent: input.id_check_consent ?? false,
        rules_accepted: 'true',
      },
    },
  });
  if (error) throw toAppError(error);
  return data;
}

export async function signIn(db: CampusClient, email: string, password: string) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw toAppError(error);
  return data;
}

export async function signOut(db: CampusClient): Promise<void> {
  const { data } = await db.auth.getSession();
  const uid = data.session?.user.id;
  if (uid) {
    // Best effort: an offline sign-out must still sign out.
    await db.from('profiles').update({ push_token: null }).eq('id', uid);
  }
  const { error } = await db.auth.signOut();
  if (error) throw toAppError(error);
}

export async function requestPasswordReset(db: CampusClient, email: string): Promise<void> {
  unwrap(await db.rpc('request_password_reset', { p_email: email }));
}

export async function updateApplication(db: CampusClient, i: UpdateApplicationInput): Promise<void> {
  unwrap(
    await db.rpc('update_application', {
      p_full_name: i.full_name,
      p_phone: i.phone,
      p_roll_number: i.roll_number,
      p_college_id: i.college_id,
    }),
  );
}

export async function setIdPhoto(db: CampusClient, path: string, consent: boolean): Promise<void> {
  unwrap(await db.rpc('set_id_photo', { p_path: path, p_consent: consent }));
}

export async function getStands(db: CampusClient, fix?: GeoFix | null): Promise<StandWithCounts[]> {
  const rows = unwrap(
    await db.rpc('get_stands_with_counts', { p_lat: fix?.lat ?? undefined, p_lng: fix?.lng ?? undefined }),
  );
  return rows ?? [];
}

export async function getStandDetail(db: CampusClient, id: string): Promise<StandDetail> {
  return unwrapAs<StandDetail>(await db.rpc('get_stand_detail', { p_stand_id: id }));
}

export async function listPickableBikes(db: CampusClient) {
  return unwrap(await db.rpc('list_pickable_bikes')) ?? [];
}

export async function previewBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<BorrowPreview> {
  return unwrapAs<BorrowPreview>(
    await db.rpc('preview_bike', {
      p_code: code,
      p_sig: sig,
      ...fixArgs(fix),
      p_demo_stand_id: demoStandId ?? undefined,
    }),
  );
}

export async function borrowBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<BorrowResult> {
  return unwrapAs<BorrowResult>(
    await db.rpc('borrow_bike', {
      p_code: code,
      p_sig: sig,
      ...fixArgs(fix),
      p_demo_stand_id: demoStandId ?? undefined,
    }),
  );
}

export async function checkReturnLocation(
  db: CampusClient,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<ReturnCheck> {
  return unwrapAs<ReturnCheck>(
    await db.rpc('check_return_location', { ...fixArgs(fix), p_demo_stand_id: demoStandId ?? undefined }),
  );
}

export async function returnBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  photoPath?: string | null,
  demoStandId?: string | null,
): Promise<ReturnResult> {
  return unwrapAs<ReturnResult>(
    await db.rpc('return_bike', {
      p_code: code,
      p_sig: sig,
      ...fixArgs(fix),
      p_photo_path: photoPath ?? undefined,
      p_demo_stand_id: demoStandId ?? undefined,
    }),
  );
}

export async function attachReturnPhoto(db: CampusClient, rideId: string, path: string): Promise<void> {
  unwrap(await db.rpc('attach_return_photo', { p_ride_id: rideId, p_path: path }));
}

export async function getMyPassQr(db: CampusClient) {
  return unwrapAs<{ payload: string; window: number; expires_at: string }>(await db.rpc('get_my_pass_qr'));
}

export async function markPassMintedSeen(db: CampusClient): Promise<void> {
  unwrap(await db.rpc('mark_pass_minted_seen'));
}

export async function getPassStats(db: CampusClient): Promise<PassStats> {
  return unwrapAs<PassStats>(await db.rpc('get_pass_stats'));
}

export async function reportIssue(db: CampusClient, i: ReportIssueInput): Promise<{ issue_id: string }> {
  return unwrapAs<{ issue_id: string }>(
    await db.rpc('report_issue', {
      p_type: i.type as Database['public']['Enums']['issue_type'],
      p_note: i.note ?? undefined,
      p_bike_code: i.bike_code ?? undefined,
      p_ride_id: i.ride_id ?? undefined,
      p_stand_id: i.stand_id ?? undefined,
      p_photo_path: i.photo_path ?? undefined,
      p_ai_suggested_type: (i.ai_suggested_type ?? undefined) as
        Database['public']['Enums']['issue_type'] | undefined,
    }),
  );
}

export async function requestRideClose(db: CampusClient, note: string): Promise<{ issue_id: string }> {
  return unwrapAs<{ issue_id: string }>(await db.rpc('request_ride_close', { p_note: note }));
}

const RIDE_COLUMNS =
  'id, started_at, ended_at, status, late, flags, bike:bikes(short_code), start:stands!rides_start_stand_id_fkey(name), end:stands!rides_end_stand_id_fkey(name)';

export async function listMyRides(db: CampusClient, page = 0) {
  const uid = await requireUid(db);
  return unwrap(
    await db
      .from('rides')
      .select(RIDE_COLUMNS)
      .eq('rider_id', uid)
      .neq('status', 'active')
      .order('started_at', { ascending: false })
      .range(page * 20, page * 20 + 19),
  );
}

// Written out in full: supabase-js infers the row type from a literal select string only.
const RIDE_DETAIL_COLUMNS =
  'id, started_at, ended_at, status, late, flags, bike:bikes(short_code), start:stands!rides_start_stand_id_fkey(name), end:stands!rides_end_stand_id_fkey(name), photo_check, return_photo_path, force_note';

export async function getRide(db: CampusClient, id: string) {
  // Not through unwrap(): its row type is inferred for lists, and a single row needs its own null check.
  const { data, error } = await db.from('rides').select(RIDE_DETAIL_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw toAppError(error);
  if (!data) throw new AppError('CC_RIDE_NOT_FOUND');
  return data;
}

export async function listMyReports(db: CampusClient) {
  const uid = await requireUid(db);
  return unwrap(
    await db
      .from('issue_reports')
      .select('id, type, note, status, created_at, resolution_note, bike:bikes(short_code)')
      .eq('reporter_id', uid)
      .order('created_at', { ascending: false })
      .limit(50),
  );
}

export async function listNotifications(db: CampusClient) {
  const uid = await requireUid(db);
  return unwrap(
    await db
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100),
  );
}

export async function markNotificationsRead(db: CampusClient, ids?: string[]): Promise<void> {
  unwrap(await db.rpc('mark_notifications_read', { p_ids: ids ?? undefined }));
}

export async function updateMyProfile(
  db: CampusClient,
  patch: {
    phone?: string;
    push_token?: string | null;
    notif_prefs?: { approval: boolean; reminders: boolean; issues: boolean };
    theme?: 'system' | 'dark' | 'day';
  },
): Promise<void> {
  const uid = await requireUid(db);
  unwrap(await db.from('profiles').update(patch).eq('id', uid));
}

export async function changePassword(db: CampusClient, pw: string): Promise<void> {
  const { error } = await db.auth.updateUser({ password: pw });
  if (error) throw toAppError(error);
}

export async function clearMyAiMemory(db: CampusClient): Promise<{ deleted: number }> {
  return unwrapAs<{ deleted: number }>(await db.rpc('clear_my_ai_memory'));
}

export async function deleteMyAccount(db: CampusClient): Promise<void> {
  await invoke(db, 'delete-account');
}

// R06: the result of TORQ's ID check, once it has run. RLS limits the read to the rider's own row.
export async function getMyIdCheck(db: CampusClient): Promise<IdCheckResult | null> {
  const uid = await requireUid(db);
  const { data, error } = await db.from('profiles').select('id_check_result').eq('id', uid).maybeSingle();
  if (error) throw toAppError(error);
  return (data?.id_check_result as IdCheckResult | null | undefined) ?? null;
}

export interface IssueSuggestion {
  type: IssueType | null;
  note: string;
  confidence: number;
}

// R16 snap-to-report: TORQ looks at an uploaded issue photo. `type: null` means no suggestion (03 §4.5).
export async function suggestIssue(db: CampusClient, photoPath: string): Promise<IssueSuggestion> {
  return invoke<IssueSuggestion>(db, 'torq-suggest', { photo_path: photoPath });
}
