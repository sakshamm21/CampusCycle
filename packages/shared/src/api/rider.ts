import type { CampusClient } from './client.ts';
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

export async function getMyContext(db: CampusClient): Promise<MyContext | null> {
  const { data, error } = await db.rpc('get_my_context');
  if (error) throw error;
  return data as unknown as MyContext | null;
}

export async function listColleges(db: CampusClient) {
  const { data, error } = await db.rpc('list_colleges_public');
  if (error) throw error;
  return data;
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
  if (error) throw error;
  return data;
}

export async function signIn(db: CampusClient, email: string, password: string) {
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut(db: CampusClient): Promise<void> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (user) {
    await db.from('profiles').update({ push_token: null }).eq('id', user.id);
  }
  const { error } = await db.auth.signOut();
  if (error) throw error;
}

export async function requestPasswordReset(db: CampusClient, email: string): Promise<void> {
  const { error } = await db.rpc('request_password_reset', { p_email: email });
  if (error) throw error;
}

export async function updateApplication(db: CampusClient, i: UpdateApplicationInput): Promise<void> {
  const { error } = await db.rpc('update_application', {
    p_full_name: i.full_name,
    p_phone: i.phone,
    p_roll_number: i.roll_number,
    p_college_id: i.college_id,
  });
  if (error) throw error;
}

export async function setIdPhoto(db: CampusClient, path: string, consent: boolean): Promise<void> {
  const { error } = await db.rpc('set_id_photo', { p_path: path, p_consent: consent });
  if (error) throw error;
}

export async function getStands(db: CampusClient, fix?: GeoFix | null): Promise<StandWithCounts[]> {
  const { data, error } = await db.rpc('get_stands_with_counts', {
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
  });
  if (error) throw error;
  return (data ?? []) as unknown as StandWithCounts[];
}

export async function getStandDetail(db: CampusClient, id: string) {
  const { data, error } = await db.rpc('get_stand_detail', { p_stand_id: id });
  if (error) throw error;
  return data;
}

export async function listPickableBikes(db: CampusClient) {
  const { data, error } = await db.rpc('list_pickable_bikes');
  if (error) throw error;
  return data ?? [];
}

export async function previewBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<BorrowPreview> {
  const { data, error } = await db.rpc('preview_bike', {
    p_code: code,
    p_sig: sig,
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
    p_accuracy: fix?.accuracy ?? undefined,
    p_is_mock: fix?.isMock ?? false,
    p_demo_stand_id: demoStandId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as BorrowPreview;
}

export async function borrowBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<BorrowResult> {
  const { data, error } = await db.rpc('borrow_bike', {
    p_code: code,
    p_sig: sig,
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
    p_accuracy: fix?.accuracy ?? undefined,
    p_is_mock: fix?.isMock ?? false,
    p_demo_stand_id: demoStandId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as BorrowResult;
}

export async function checkReturnLocation(
  db: CampusClient,
  fix?: GeoFix | null,
  demoStandId?: string | null,
): Promise<ReturnCheck> {
  const { data, error } = await db.rpc('check_return_location', {
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
    p_accuracy: fix?.accuracy ?? undefined,
    p_is_mock: fix?.isMock ?? false,
    p_demo_stand_id: demoStandId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ReturnCheck;
}

export async function returnBike(
  db: CampusClient,
  code: string,
  sig: string,
  fix?: GeoFix | null,
  photoPath?: string | null,
  demoStandId?: string | null,
): Promise<ReturnResult> {
  const { data, error } = await db.rpc('return_bike', {
    p_code: code,
    p_sig: sig,
    p_lat: fix?.lat ?? undefined,
    p_lng: fix?.lng ?? undefined,
    p_accuracy: fix?.accuracy ?? undefined,
    p_is_mock: fix?.isMock ?? false,
    p_photo_path: photoPath ?? undefined,
    p_demo_stand_id: demoStandId ?? undefined,
  });
  if (error) throw error;
  return data as unknown as ReturnResult;
}

export async function attachReturnPhoto(db: CampusClient, rideId: string, path: string): Promise<void> {
  const { error } = await db.rpc('attach_return_photo', {
    p_ride_id: rideId,
    p_path: path,
  });
  if (error) throw error;
}

export async function getMyPassQr(db: CampusClient) {
  const { data, error } = await db.rpc('get_my_pass_qr');
  if (error) throw error;
  return data as { payload: string; window: number; expires_at: string };
}

export async function markPassMintedSeen(db: CampusClient): Promise<void> {
  const { error } = await db.rpc('mark_pass_minted_seen');
  if (error) throw error;
}

export async function getPassStats(db: CampusClient): Promise<PassStats> {
  const { data, error } = await db.rpc('get_pass_stats');
  if (error) throw error;
  return data as unknown as PassStats;
}

export async function reportIssue(db: CampusClient, i: ReportIssueInput): Promise<{ issue_id: string }> {
  const { data, error } = await db.rpc('report_issue', {
    p_type: i.type as Database['public']['Enums']['issue_type'],
    p_note: i.note ?? undefined,
    p_bike_code: i.bike_code ?? undefined,
    p_ride_id: i.ride_id ?? undefined,
    p_stand_id: i.stand_id ?? undefined,
    p_photo_path: i.photo_path ?? undefined,
    p_ai_suggested_type: (i.ai_suggested_type ?? undefined) as
      Database['public']['Enums']['issue_type'] | undefined,
  });
  if (error) throw error;
  return data as { issue_id: string };
}

export async function requestRideClose(db: CampusClient, note: string): Promise<{ issue_id: string }> {
  const { data, error } = await db.rpc('request_ride_close', { p_note: note });
  if (error) throw error;
  return data as { issue_id: string };
}

export async function listMyRides(db: CampusClient, page = 0) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('rides')
    .select(
      'id, started_at, ended_at, status, late, flags, bike:bikes(short_code), start:stands!rides_start_stand_id_fkey(name), end:stands!rides_end_stand_id_fkey(name)',
    )
    .eq('rider_id', user.id)
    .neq('status', 'active')
    .order('started_at', { ascending: false })
    .range(page * 20, page * 20 + 19);

  if (error) throw error;
  return data;
}

export async function getRide(db: CampusClient, id: string) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('rides')
    .select(
      'id, started_at, ended_at, status, late, flags, bike:bikes(short_code), start:stands!rides_start_stand_id_fkey(name), end:stands!rides_end_stand_id_fkey(name), photo_check, return_photo_path, force_note',
    )
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function listMyReports(db: CampusClient) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('issue_reports')
    .select('id, type, note, status, created_at, resolution_note, bike:bikes(short_code)')
    .eq('reporter_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data;
}

export async function listNotifications(db: CampusClient) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}

export async function markNotificationsRead(db: CampusClient, ids?: string[]): Promise<void> {
  const { error } = await db.rpc('mark_notifications_read', { p_ids: ids ?? undefined });
  if (error) throw error;
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
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await db.from('profiles').update(patch).eq('id', user.id);
  if (error) throw error;
}

export async function changePassword(db: CampusClient, pw: string): Promise<void> {
  const { error } = await db.auth.updateUser({ password: pw });
  if (error) throw error;
}

export async function clearMyAiMemory(db: CampusClient): Promise<{ deleted: number }> {
  const { data, error } = await db.rpc('clear_my_ai_memory');
  if (error) throw error;
  return data as { deleted: number };
}

export async function deleteMyAccount(db: CampusClient): Promise<void> {
  const { error } = await db.functions.invoke('delete-account');
  if (error) throw error;
}
