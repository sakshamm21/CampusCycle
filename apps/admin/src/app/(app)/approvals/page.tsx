'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import {
  approveRider,
  approveRiders,
  rejectRider,
  relativeTime,
  toAppError,
  messageFor,
  t,
  en,
} from '@campuscycle/shared';

import { PageHeader } from '@/components/common/PageHeader';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ReasonDialog } from '@/components/common/ReasonDialog';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

type FilterType = 'all' | 'id_matches' | 'id_mismatch' | 'no_id' | 'domain_match';

interface IdCheckResult {
  match?: 'yes' | 'no';
  name_ok?: boolean;
  roll_ok?: boolean;
  college_ok?: boolean;
  notes?: string;
  note?: string;
}

interface ApplicantRow {
  id: string;
  college_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  roll_number: string | null;
  status: string | null;
  applied_at: string | null;
  id_photo_path: string | null;
  id_check_consent: boolean | null;
  id_check_result: IdCheckResult | null;
  email_domain_match: boolean | null;
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient();
  const { collegeId } = useCollege();

  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approveSelectedOpen, setApproveSelectedOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ApplicantRow | null>(null);

  // Q5: Applicants with status = pending, ordered by applied_at asc
  const {
    data: applicants = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['users', collegeId, { status: 'pending' }],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('admin_users_v')
        .select('*')
        .eq('college_id', collegeId)
        .eq('status', 'pending')
        .order('applied_at', { ascending: true });

      if (error) throw toAppError(error);
      return (data ?? []) as unknown as ApplicantRow[];
    },
    enabled: Boolean(collegeId),
  });

  if (error) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  // Filter applicants based on active filter chip
  const filteredApplicants = applicants.filter((a) => {
    const res = a.id_check_result;
    if (activeFilter === 'id_matches') return res?.match === 'yes';
    if (activeFilter === 'id_mismatch') return res?.match === 'no';
    if (activeFilter === 'no_id') return !a.id_photo_path;
    if (activeFilter === 'domain_match') return a.email_domain_match === true;
    return true;
  });

  // Toggle selection
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 50 ? [...prev, id] : prev,
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filteredApplicants.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredApplicants.slice(0, 50).map((a) => a.id));
    }
  };

  // Actions
  const handleApproveSingle = async (applicant: ApplicantRow) => {
    try {
      await approveRider(supabase, applicant.id);
      toast.success(en.common.done);
      setSelectedIds((prev) => prev.filter((id) => id !== applicant.id));
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleApproveSelectedConfirm = async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await approveRiders(supabase, selectedIds);
      toast.success(t('a03.approved_n', { n: result.approved }));
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectTarget) return;
    try {
      await rejectRider(supabase, rejectTarget.id, reason);
      toast.success(en.common.done);
      setSelectedIds((prev) => prev.filter((id) => id !== rejectTarget.id));
      setRejectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['users', collegeId] });
      queryClient.invalidateQueries({ queryKey: ['stats', collegeId] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  const filterChips: { id: FilterType; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'id_matches', label: 'ID matches' },
    { id: 'id_mismatch', label: 'ID mismatch' },
    { id: 'no_id', label: 'No ID' },
    { id: 'domain_match', label: 'Domain match' },
  ];

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <PageHeader
        title={en.a03.title}
        lede={t('a03.lede', { n: applicants.length })}
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={selectedIds.length === 0}
            onClick={() => setApproveSelectedOpen(true)}
            className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer transition-colors"
          >
            {en.a03.approve_selected} ({selectedIds.length})
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {filterChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setActiveFilter(chip.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-mono transition-colors cursor-pointer',
                activeFilter === chip.id
                  ? 'bg-fg text-bg font-bold'
                  : 'bg-surface border border-border text-muted hover:text-fg hover:bg-surface2',
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {filteredApplicants.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="text-xs font-mono text-muted hover:text-fg transition-colors cursor-pointer select-none"
          >
            {selectedIds.length === filteredApplicants.length ? 'Deselect all' : 'Select all visible'}
          </button>
        )}
      </div>

      {/* Applicant Cards List */}
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
        </div>
      ) : filteredApplicants.length === 0 ? (
        <EmptyState
          stickerText="inbox zero"
          stickerColor="mint"
          title="all clear"
          description={en.a03.empty}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filteredApplicants.map((applicant) => {
            const isSelected = selectedIds.includes(applicant.id);
            const idRes = applicant.id_check_result;
            const mismatchNote = idRes?.notes || idRes?.note;

            return (
              <div
                key={applicant.id}
                className={cn(
                  'p-5 rounded-card border bg-surface transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs',
                  isSelected
                    ? 'border-primary ring-1 ring-primary'
                    : 'border-border hover:border-borderStrong',
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Selection checkbox */}
                  <div className="pt-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleSelect(applicant.id)}
                      aria-label={`Select ${applicant.full_name || 'applicant'}`}
                      className="cursor-pointer"
                    />
                  </div>

                  {/* ID Photo Thumbnail or Dashed Placeholder */}
                  <div className="shrink-0">
                    {applicant.id_photo_path ? (
                      <PhotoThumb
                        bucket="id-cards"
                        path={applicant.id_photo_path}
                        width={120}
                        height={76}
                        alt={`ID card of ${applicant.full_name || ''}`}
                        className="rounded-lg shadow-xs"
                      />
                    ) : (
                      <div className="w-[120px] h-[76px] rounded-lg border border-dashed border-border bg-surface2/40 flex items-center justify-center text-center p-2">
                        <span className="text-[10px] font-mono text-muted/70 uppercase">{en.a03.no_id}</span>
                      </div>
                    )}
                  </div>

                  {/* Middle Info */}
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-black text-lg tracking-tight text-fg lowercase truncate">
                        {applicant.full_name || 'Anonymous'}
                      </span>
                      {applicant.applied_at && (
                        <span className="text-xs font-mono text-muted/80 shrink-0">
                          · {relativeTime(applicant.applied_at)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                      <span>{applicant.email}</span>
                      {applicant.phone && (
                        <>
                          <span>·</span>
                          <span className="font-mono">{applicant.phone}</span>
                        </>
                      )}
                      {applicant.roll_number && (
                        <>
                          <span>·</span>
                          <span className="font-mono font-bold text-fg/80">{applicant.roll_number}</span>
                        </>
                      )}
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {applicant.email_domain_match && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-ok/15 text-ok border border-ok/30 font-bold">
                          DOMAIN MATCH
                        </span>
                      )}

                      {/* ID Result Chips */}
                      {idRes?.match === 'yes' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-ok/15 text-ok border border-ok/30 font-bold">
                          ID MATCH
                        </span>
                      )}

                      {idRes?.match === 'no' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-warn/15 text-warn border border-warn/30 font-bold">
                          ID MISMATCH
                        </span>
                      )}

                      {applicant.id_check_consent && applicant.id_photo_path && !idRes && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-surface2 text-muted border border-border font-bold">
                          ID CHECK PENDING
                        </span>
                      )}

                      {applicant.id_photo_path && !applicant.id_check_consent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-surface2 text-muted border border-border font-bold">
                          NO CONSENT
                        </span>
                      )}
                    </div>

                    {/* Mismatch note */}
                    {idRes?.match === 'no' && mismatchNote && (
                      <span className="text-xs text-warn/90 font-mono mt-0.5 leading-relaxed">
                        {mismatchNote}
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0 pt-2 md:pt-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRejectTarget(applicant)}
                    className="h-9 px-4 rounded-full text-xs font-mono text-muted hover:text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    {en.a03.reject}
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleApproveSingle(applicant)}
                    className="h-9 px-5 rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                  >
                    {en.a03.approve}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Approve selected confirm dialog */}
      <ConfirmDialog
        open={approveSelectedOpen}
        onOpenChange={setApproveSelectedOpen}
        title={en.a03.approve_selected}
        description={`Approve ${selectedIds.length} applicants? Their passes will be issued immediately.`}
        targetName={
          applicants
            .filter((a) => selectedIds.includes(a.id))
            .map((a) => a.full_name)
            .join(', ') || undefined
        }
        confirmLabel="Approve"
        onConfirm={handleApproveSelectedConfirm}
      />

      {/* Reject Reason Dialog */}
      <ReasonDialog
        open={Boolean(rejectTarget)}
        onOpenChange={(open) => !open && setRejectTarget(null)}
        title={t('a03.reject_title', { name: rejectTarget?.full_name || 'applicant' })}
        reasonLabel={en.a03.reason_label}
        quickPickChips={[...en.a03.reasons]}
        destructive={true}
        confirmLabel={en.a03.reject}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
