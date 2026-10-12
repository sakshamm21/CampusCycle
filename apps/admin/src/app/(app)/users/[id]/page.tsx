'use client';

import React, { useState, use } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Check,
  KeyRound,
  RotateCcw,
  UserCog,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { useMyContext } from '@/lib/providers';
import {
  approveRider,
  rejectRider,
  suspendRider,
  reinstateRider,
  resetStrikes,
  resetPassword,
  setUserRole,
  forceReturn,
  finishFor,
  toAppError,
  messageFor,
  t,
  en,
  type Role,
} from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { RiderPassWeb, type PassState } from '@/components/pass/RiderPassWeb';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function UserDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const userId = resolvedParams.id;

  const queryClient = useQueryClient();
  const { collegeId, colleges } = useCollege();
  const myCtx = useMyContext();

  const isViewerSuperAdmin = myCtx.profile.role === 'super_admin' || myCtx.profile.is_owner;

  // Dialog States
  const [rejectOpen, setRejectOpen] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [resetStrikesOpen, setResetStrikesOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copiedPw, setCopiedPw] = useState(false);

  // Role change dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [targetRole, setTargetRole] = useState<Role>('rider');
  const [targetCollegeId, setTargetCollegeId] = useState<string>(collegeId);

  // Force return dialog
  const [forceReturnOpen, setForceReturnOpen] = useState(false);
  const [forceStandId, setForceStandId] = useState<string>('');
  const [forceNote, setForceNote] = useState<string>('');
  const [forceAddStrike, setForceAddStrike] = useState<boolean>(false);
  const [forceLoading, setForceLoading] = useState<boolean>(false);

  // 1. Fetch user detail from admin_users_v
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => {
      const { data, error } = await supabase.from('admin_users_v').select('*').eq('id', userId).single();

      if (error) throw toAppError(error);
      return data;
    },
  });

  // 2. Fetch user's recent rides (last 20)
  const { data: rides = [] } = useQuery({
    queryKey: ['rides', 'user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_rides_v')
        .select('*')
        .eq('rider_id', userId)
        .order('started_at', { ascending: false })
        .limit(20);

      if (error) throw toAppError(error);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // 3. Fetch user's reported issues (last 20)
  const { data: reports = [] } = useQuery({
    queryKey: ['issues', 'reporter', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_issues_v')
        .select('*')
        .eq('reporter_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw toAppError(error);
      return data ?? [];
    },
    enabled: !!userId,
  });

  // 4. Fetch stands for force-return target
  const { data: stands = [] } = useQuery({
    queryKey: ['stands', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('stands')
        .select('id, name')
        .eq('college_id', collegeId)
        .eq('active', true)
        .order('name');
      if (error) throw toAppError(error);
      return data ?? [];
    },
    enabled: Boolean(collegeId),
  });

  if (userError) {
    return <ErrorState error={userError} onRetry={() => refetchUser()} />;
  }

  if (userLoading || !user) {
    return (
      <div className="flex flex-col gap-6 py-6">
        <Skeleton className="h-12 w-64 rounded-lg" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    );
  }

  const isOwnerTarget = Boolean(user.is_owner);
  const isDemoTarget = Boolean(user.is_demo);
  const userStatus = user.status || 'pending';
  const userRole = (user.role as Role) || 'rider';
  const totalRides = user.total_rides ?? 0;
  const finish = finishFor(totalRides);

  // Map pass state for RiderPassWeb
  const passStateMap: Record<string, PassState> = {
    pending: 'pending',
    approved: 'ready',
    riding: 'riding',
    overdue: 'overdue',
    returned: 'returned',
    suspended: 'suspended',
    ready: 'ready',
  };
  const resolvedPassState = passStateMap[user.pass_status || user.status || 'pending'] || 'ready';

  // Action handlers
  const handleApprove = async () => {
    try {
      await approveRider(supabase, userId);
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleReject = async (reason: string) => {
    try {
      await rejectRider(supabase, userId, reason);
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleSuspend = async (reason: string) => {
    try {
      await suspendRider(supabase, userId, reason);
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleReinstate = async () => {
    try {
      await reinstateRider(supabase, userId);
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleResetStrikes = async () => {
    try {
      await resetStrikes(supabase, userId);
      toast.success(en.common.done);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleResetPassword = async () => {
    try {
      const result = await resetPassword(supabase, userId);
      setTempPassword(result.temp_password);
      setResetPasswordOpen(true);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleChangeRole = async () => {
    try {
      const chosenCollege = targetRole === 'college_admin' ? targetCollegeId : null;
      await setUserRole(supabase, userId, targetRole, chosenCollege);
      toast.success(en.common.done);
      setRoleDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleForceReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.current_ride_id) return;
    if (forceNote.trim().length < 3) {
      toast.error('Note must be at least 3 characters');
      return;
    }
    const targetStand = forceStandId || (stands[0]?.id ?? '');
    if (!targetStand) {
      toast.error('Please select a stand');
      return;
    }

    try {
      setForceLoading(true);
      await forceReturn(supabase, user.current_ride_id, targetStand, forceNote.trim(), forceAddStrike);
      toast.success(en.common.done);
      setForceReturnOpen(false);
      setForceNote('');
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
      queryClient.invalidateQueries({ queryKey: ['rides', 'user', userId] });
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['bikes'] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setForceLoading(false);
    }
  };

  const idRes = user.id_check_result as {
    match?: 'yes' | 'no';
    notes?: string;
    note?: string;
  } | null;
  const mismatchNotes = idRes?.notes || idRes?.note;

  return (
    <div className="flex flex-col gap-8 pb-16">
      {/* Top back link & Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-fg transition-colors w-fit"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to riders</span>
        </Link>

        <PageHeader
          title={user.full_name || 'Rider details'}
          lede={user.email || ''}
          actions={
            <div className="flex items-center gap-2">
              <StatusPill status={user.status || 'pending'} />
              {isOwnerTarget && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary text-on-primary">
                  OWNER
                </span>
              )}
              {isDemoTarget && (
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-surface2 text-muted border border-border">
                  DEMO
                </span>
              )}
            </div>
          }
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (5 cols): RiderPassWeb, ID Card Photo, ID Check result */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col items-center gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-muted self-start">
              Digital Rider Pass
            </span>
            <div className="w-full max-w-[320px]">
              <RiderPassWeb
                holderName={user.full_name || 'Anonymous'}
                collegeName={user.college_name || 'Campus'}
                passLabel={user.pass_label || '—'}
                state={resolvedPassState}
                finish={finish}
                bikeCode={user.bike_code || undefined}
                rides={user.total_rides ?? 0}
                minutes={user.total_minutes ?? 0}
                strikes={user.strikes ?? 0}
                tiltOnHover={true}
                interactiveFlip={true}
              />
            </div>
          </div>

          {/* ID Photo & Verification Card */}
          <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-muted">Student ID Card</span>

            {user.id_photo_path ? (
              <div className="flex flex-col gap-3">
                <PhotoThumb
                  bucket="id-cards"
                  path={user.id_photo_path}
                  width={240}
                  height={152}
                  alt={`Student ID of ${user.full_name || ''}`}
                  className="rounded-lg shadow-xs"
                />
                {idRes ? (
                  <div
                    className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                      idRes.match === 'yes'
                        ? 'bg-ok/10 border-ok/30 text-ok'
                        : 'bg-warn/10 border-warn/30 text-warn'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-mono font-bold uppercase text-[11px]">
                      {idRes.match === 'yes' ? (
                        <>
                          <CheckCircle2 className="size-3.5" />
                          <span>ID Verified (Match)</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="size-3.5" />
                          <span>ID Mismatch Detected</span>
                        </>
                      )}
                    </div>
                    {mismatchNotes && (
                      <p className="text-fg/90 text-xs font-mono leading-relaxed">{mismatchNotes}</p>
                    )}
                  </div>
                ) : user.id_check_consent ? (
                  <span className="text-xs font-mono text-muted">ID check is pending analysis by TORQ.</span>
                ) : (
                  <span className="text-xs font-mono text-muted">
                    Uploaded without automated verification consent.
                  </span>
                )}
              </div>
            ) : (
              <div className="py-6 border border-dashed border-border rounded-lg text-center text-xs text-muted font-mono">
                {en.a03.no_id}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Details list & Actions card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* Details Card */}
          <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-muted">Account Metadata</span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="flex flex-col gap-1">
                <span className="text-muted">Email</span>
                <span className="text-fg font-medium">{user.email || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Phone</span>
                <span className="text-fg font-medium">{user.phone || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Roll Number</span>
                <span className="text-fg font-medium">{user.roll_number || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">College</span>
                <span className="text-fg font-medium">{user.college_name || '—'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Role</span>
                <span className="text-fg font-medium capitalize">{user.role || 'rider'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Status</span>
                <span className="text-fg font-medium capitalize">{user.status || 'pending'}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Applied Date</span>
                <span className="text-fg font-medium">
                  {user.applied_at ? format(new Date(user.applied_at), 'd MMM yyyy, h:mm a') : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Approved Date</span>
                <span className="text-fg font-medium">
                  {user.approved_at ? format(new Date(user.approved_at), 'd MMM yyyy, h:mm a') : '—'}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Strikes</span>
                <span className={`font-bold ${user.strikes && user.strikes > 0 ? 'text-bad' : 'text-fg'}`}>
                  {user.strikes ?? 0}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted">Reset Requested</span>
                <span className="text-fg font-medium">
                  {user.password_reset_requested_at
                    ? format(new Date(user.password_reset_requested_at), 'd MMM yyyy, h:mm a')
                    : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
            <span className="font-mono text-xs uppercase tracking-wider text-muted">
              Administrative Actions
            </span>

            {isOwnerTarget ? (
              <p className="text-xs font-mono text-muted italic">
                Owner account is protected and cannot be modified.
              </p>
            ) : isDemoTarget ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-muted mr-2">Demo account</span>
                {user.bike_code && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForceReturnOpen(true)}
                    className="h-9 rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    Force return {user.bike_code}
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Pending Actions */}
                {userStatus === 'pending' && (
                  <>
                    <Button
                      type="button"
                      onClick={handleApprove}
                      className="h-9 px-4 rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                    >
                      {en.a03.approve}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRejectOpen(true)}
                      className="h-9 px-4 rounded-full text-xs font-mono text-muted hover:text-bad hover:bg-bad/10 cursor-pointer"
                    >
                      {en.a03.reject}
                    </Button>
                  </>
                )}

                {/* Approved Actions */}
                {userStatus === 'approved' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setSuspendOpen(true)}
                    className="h-9 rounded-full text-xs font-mono border-bad/50 text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    Suspend Rider
                  </Button>
                )}

                {/* Suspended Actions */}
                {userStatus === 'suspended' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReinstateOpen(true)}
                    className="h-9 rounded-full text-xs font-mono border-ok text-ok hover:bg-ok/10 cursor-pointer"
                  >
                    Reinstate Rider
                  </Button>
                )}

                {/* Reset strikes */}
                {(user.strikes ?? 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setResetStrikesOpen(true)}
                    className="h-9 rounded-full text-xs font-mono border-border bg-surface2/60 hover:bg-surface2 cursor-pointer"
                  >
                    <RotateCcw className="size-3 mr-1.5" />
                    Reset Strikes
                  </Button>
                )}

                {/* Reset Password */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResetPassword}
                  className="h-9 rounded-full text-xs font-mono border-border bg-surface2/60 hover:bg-surface2 cursor-pointer"
                >
                  <KeyRound className="size-3 mr-1.5" />
                  Reset Password
                </Button>

                {/* Change Role (Super Admin only) */}
                {isViewerSuperAdmin && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTargetRole(userRole);
                      setTargetCollegeId(user.college_id || collegeId);
                      setRoleDialogOpen(true);
                    }}
                    className="h-9 rounded-full text-xs font-mono border-border bg-surface2/60 hover:bg-surface2 cursor-pointer"
                  >
                    <UserCog className="size-3 mr-1.5" />
                    {en.a04.role_title}
                  </Button>
                )}

                {/* Force Return Bike */}
                {user.bike_code && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setForceReturnOpen(true)}
                    className="h-9 rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    Force return {user.bike_code}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Rides Table (Q6 filtered by rider_id, last 20) */}
      <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-extrabold text-base tracking-tight text-fg lowercase">
            Recent rides
          </span>
          <span className="text-xs font-mono text-muted">{rides.length} rides shown</span>
        </div>

        {rides.length === 0 ? (
          <p className="text-xs font-mono text-muted italic py-4">No rides recorded for this rider.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted uppercase text-[10px]">
                  <th className="py-2.5 font-bold">Started</th>
                  <th className="py-2.5 font-bold">Bike</th>
                  <th className="py-2.5 font-bold">Route</th>
                  <th className="py-2.5 font-bold">Duration</th>
                  <th className="py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rides.map((ride) => (
                  <tr key={ride.id} className="hover:bg-surface2/40 transition-colors">
                    <td className="py-3 text-muted">
                      {ride.started_at ? format(new Date(ride.started_at), 'd MMM, h:mm a') : '—'}
                    </td>
                    <td className="py-3 font-bold text-fg">{ride.bike_code}</td>
                    <td className="py-3 text-muted">
                      {ride.start_stand_name || '—'} → {ride.end_stand_name || '—'}
                    </td>
                    <td className="py-3 text-fg">{ride.minutes ? `${ride.minutes} min` : '—'}</td>
                    <td className="py-3">
                      <StatusPill status={ride.status || 'active'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reported Issues (last 20) */}
      <div className="p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="font-display font-extrabold text-base tracking-tight text-fg lowercase">
            Reported issues
          </span>
          <span className="text-xs font-mono text-muted">{reports.length} reports shown</span>
        </div>

        {reports.length === 0 ? (
          <p className="text-xs font-mono text-muted italic py-4">No issue reports filed by this rider.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-border text-muted uppercase text-[10px]">
                  <th className="py-2.5 font-bold">Date</th>
                  <th className="py-2.5 font-bold">Type</th>
                  <th className="py-2.5 font-bold">Bike</th>
                  <th className="py-2.5 font-bold">Note</th>
                  <th className="py-2.5 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-surface2/40 transition-colors">
                    <td className="py-3 text-muted">
                      {report.created_at ? format(new Date(report.created_at), 'd MMM, h:mm a') : '—'}
                    </td>
                    <td className="py-3 font-bold text-fg uppercase">{report.type}</td>
                    <td className="py-3 text-primary font-bold">{report.bike_code || '—'}</td>
                    <td className="py-3 text-muted max-w-xs truncate">{report.note || '—'}</td>
                    <td className="py-3">
                      <StatusPill status={report.status || 'open'} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Reason Dialog */}
      <ReasonDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title={t('a03.reject_title', { name: user.full_name || 'applicant' })}
        reasonLabel={en.a03.reason_label}
        quickPickChips={[...en.a03.reasons]}
        destructive={true}
        confirmLabel={en.a03.reject}
        onConfirm={handleReject}
      />

      {/* Suspend Reason Dialog */}
      <ReasonDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={`Suspend pass for ${user.full_name || 'rider'}?`}
        reasonLabel="Reason for suspension"
        placeholder="State reason for suspending rider pass..."
        destructive={true}
        confirmLabel="Suspend"
        onConfirm={handleSuspend}
      />

      {/* Reinstate Confirm Dialog */}
      <ConfirmDialog
        open={reinstateOpen}
        onOpenChange={setReinstateOpen}
        title={`Reinstate ${user.full_name || 'rider'}?`}
        description="This will restore the rider pass to active standing."
        confirmLabel="Reinstate"
        onConfirm={handleReinstate}
      />

      {/* Reset Strikes Confirm Dialog */}
      <ConfirmDialog
        open={resetStrikesOpen}
        onOpenChange={setResetStrikesOpen}
        title={`Reset strikes for ${user.full_name || 'rider'}?`}
        description="This will clear all accumulated strikes to 0."
        confirmLabel="Reset strikes"
        onConfirm={handleResetStrikes}
      />

      {/* Password Reset Result Dialog */}
      <Dialog open={resetPasswordOpen} onOpenChange={setResetPasswordOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              Temporary password generated
            </DialogTitle>
            <DialogDescription className="text-muted text-xs leading-relaxed">
              {en.a04.temp_note}
            </DialogDescription>
          </DialogHeader>

          {tempPassword && (
            <div className="p-4 rounded-lg bg-surface2/60 border border-border flex items-center justify-between gap-3">
              <span className="font-mono text-base font-bold text-fg select-all">{tempPassword}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  setCopiedPw(true);
                  setTimeout(() => setCopiedPw(false), 2000);
                }}
                className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
              >
                {copiedPw ? <Check className="size-3 text-ok mr-1" /> : <Copy className="size-3 mr-1" />}
                {copiedPw ? 'Copied' : en.a04.copy}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              onClick={() => setResetPasswordOpen(false)}
              className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              {en.a04.role_title}
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Update access level for {user.full_name || 'user'}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-mono text-muted">Role</Label>
              <Select value={targetRole} onValueChange={(val) => setTargetRole(val as Role)}>
                <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface border-border text-xs font-mono">
                  <SelectItem value="rider">Rider</SelectItem>
                  <SelectItem value="college_admin">College Admin</SelectItem>
                  <SelectItem value="super_admin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetRole === 'college_admin' && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-mono text-muted">{en.a04.role_college}</Label>
                <Select value={targetCollegeId} onValueChange={(val) => setTargetCollegeId(val || '')}>
                  <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono">
                    <SelectValue placeholder="Select college" />
                  </SelectTrigger>
                  <SelectContent className="bg-surface border-border text-xs font-mono">
                    {colleges.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} ({c.short_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setRoleDialogOpen(false)}
              className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleChangeRole}
              className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
            >
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Force Return Dialog */}
      <Dialog open={forceReturnOpen} onOpenChange={setForceReturnOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              {t('a07.force_title', { bike: user.bike_code || 'bike' })}
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              End the active ride and return the bike to a designated campus stand.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForceReturn} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="force-stand" className="text-xs font-mono text-muted">
                {en.a07.force_stand}
              </Label>
              <Select
                value={forceStandId || (stands[0]?.id ?? '')}
                onValueChange={(val) => setForceStandId(val || '')}
              >
                <SelectTrigger id="force-stand" className="bg-surface2/60 border-border text-xs font-mono">
                  <SelectValue placeholder="Select target stand" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-border text-xs font-mono">
                  {stands.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="force-note" className="text-xs font-mono text-muted">
                {en.a07.force_note}
              </Label>
              <Textarea
                id="force-note"
                required
                value={forceNote}
                onChange={(e) => setForceNote(e.target.value)}
                placeholder="Reason for ending ride..."
                rows={3}
                className="text-xs bg-surface2/60 border-border resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="add-strike"
                checked={forceAddStrike}
                onCheckedChange={(checked) => setForceAddStrike(Boolean(checked))}
                className="cursor-pointer"
              />
              <Label htmlFor="add-strike" className="text-xs font-mono text-fg cursor-pointer select-none">
                {en.a07.add_strike}
              </Label>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={forceLoading}
                onClick={() => setForceReturnOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forceLoading || forceNote.trim().length < 3}
                className="rounded-full text-xs font-mono font-bold bg-bad text-white hover:bg-bad/90 cursor-pointer"
              >
                {forceLoading ? 'Processing...' : en.a07.force}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
