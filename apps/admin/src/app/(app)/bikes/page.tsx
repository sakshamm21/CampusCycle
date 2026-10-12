'use client';

import React, { useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Printer,
  Search,
  Sparkles,
  Wrench,
  AlertTriangle,
  MoveRight,
  Save,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusPill } from '@/components/common/StatusPill';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ForceReturnDialog } from '@/components/common/ForceReturnDialog';
import { ErrorState } from '@/components/common/ErrorState';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import {
  createBikes,
  moveBike,
  moveBikes,
  updateBikeNotes,
  retireBike,
  clearBikeFlag,
  setBikeMaintenance,
  markBikeMissing,
  messageFor,
  toAppError,
  en,
  t,
} from '@campuscycle/shared';

interface AdminBikeRow extends Record<string, unknown> {
  id: string;
  college_id: string;
  short_code: string;
  status: string;
  current_stand_id: string | null;
  stand_name: string | null;
  last_seen_at: string | null;
  last_seen_stand_id: string | null;
  last_seen_stand_name: string | null;
  maintenance_after_return: boolean;
  ai_flag: string | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
  pass_id: string | null;
  pass_label: string | null;
  holder_name: string | null;
  borrowed_at: string | null;
}

interface RecentRideRow {
  id: string;
  started_at: string;
  rider_name: string | null;
  start_stand_name: string | null;
  end_stand_name: string | null;
  status: string;
  minutes: number | null;
}

interface RecentIssueRow {
  id: string;
  type: string;
  note: string;
  status: string;
  urgency: number | null;
  created_at: string;
}

function BikesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { collegeId } = useCollege();

  // Search and filters
  const initialSearch = searchParams.get('search') || '';
  const [search, setSearch] = useState<string>(initialSearch);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [standFilter, setStandFilter] = useState<string>('all');
  const [aiFlaggedOnly, setAiFlaggedOnly] = useState<boolean>(false);

  // Bulk selection
  const [selectedBikeIds, setSelectedBikeIds] = useState<string[]>([]);

  // Add Bikes dialog state
  const [addDialogOpen, setAddDialogOpen] = useState<boolean>(false);
  const [addStandId, setAddStandId] = useState<string>('');
  const [addCount, setAddCount] = useState<number>(1);
  const [addNotes, setAddNotes] = useState<string>('');
  const [addLoading, setAddLoading] = useState<boolean>(false);

  // Bulk Move dialog state
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState<boolean>(false);
  const [bulkMoveStandId, setBulkMoveStandId] = useState<string>('');
  const [bulkMoveLoading, setBulkMoveLoading] = useState<boolean>(false);

  // Detail Sheet state
  const [detailBikeId, setDetailBikeId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [savingNotes, setSavingNotes] = useState<boolean>(false);

  // Move single bike dialog/input state
  const [moveStandTargetId, setMoveStandTargetId] = useState<string>('');
  const [moveSingleLoading, setMoveSingleLoading] = useState<boolean>(false);

  // Maintenance prompt dialog state
  const [maintDialogOpen, setMaintDialogOpen] = useState<boolean>(false);
  const [maintNote, setMaintNote] = useState<string>('');
  const [maintLoading, setMaintLoading] = useState<boolean>(false);

  // Mark Missing dialog state
  const [missingDialogOpen, setMissingDialogOpen] = useState<boolean>(false);
  const [missingNote, setMissingNote] = useState<string>('');
  const [missingAddStrike, setMissingAddStrike] = useState<boolean>(false);
  const [missingLoading, setMissingLoading] = useState<boolean>(false);

  // Retire confirm dialog state
  const [retireDialogOpen, setRetireDialogOpen] = useState<boolean>(false);
  const [retireLoading, setRetireLoading] = useState<boolean>(false);

  // Force return dialog state
  const [forceDialogOpen, setForceDialogOpen] = useState<boolean>(false);
  const [forceRideId, setForceRideId] = useState<string | null>(null);

  // Fetch stands for dropdowns
  const { data: stands = [] } = useQuery({
    queryKey: ['stands', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('stands')
        .select('id, name')
        .eq('college_id', collegeId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(collegeId),
  });

  // Fetch fleet from admin_bikes_v
  const {
    data: bikes = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['bikes', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('admin_bikes_v')
        .select('*')
        .eq('college_id', collegeId)
        .order('short_code', { ascending: true });

      if (error) throw error;
      return (data as AdminBikeRow[]) || [];
    },
    enabled: Boolean(collegeId),
    refetchInterval: 30000,
  });

  // Filtered bikes
  const filteredBikes = useMemo(() => {
    return bikes.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) {
        return false;
      }
      if (standFilter !== 'all' && b.current_stand_id !== standFilter) {
        return false;
      }
      if (aiFlaggedOnly && !b.ai_flag) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const codeMatch = b.short_code.toLowerCase().includes(q);
        const holderMatch = b.holder_name?.toLowerCase().includes(q);
        const standMatch = b.stand_name?.toLowerCase().includes(q);
        if (!codeMatch && !holderMatch && !standMatch) {
          return false;
        }
      }
      return true;
    });
  }, [bikes, statusFilter, standFilter, aiFlaggedOnly, search]);

  // Selected bike object for sheet
  const activeBike = useMemo(() => {
    if (!detailBikeId) return null;
    return bikes.find((b) => b.id === detailBikeId) || null;
  }, [detailBikeId, bikes]);

  // Sync edit notes when active bike changes
  React.useEffect(() => {
    if (activeBike) {
      setEditNotes(activeBike.notes || '');
      setMoveStandTargetId(activeBike.current_stand_id || (stands[0]?.id ?? ''));
    }
  }, [activeBike, stands]);

  // Fetch active ride ID if bike is borrowed
  const { data: activeRide } = useQuery<{ id: string; started_at: string; due_at: string } | null>({
    queryKey: ['bike-active-ride', activeBike?.id],
    queryFn: async () => {
      if (!activeBike || activeBike.status !== 'borrowed') return null;
      const { data } = await supabase
        .from('rides')
        .select('id, started_at, due_at')
        .eq('bike_id', activeBike.id)
        .eq('status', 'active')
        .maybeSingle();
      return data || null;
    },
    enabled: Boolean(activeBike && activeBike.status === 'borrowed'),
  });

  // Fetch recent rides for selected bike
  const { data: recentRides = [] } = useQuery<RecentRideRow[]>({
    queryKey: ['bike-recent-rides', activeBike?.id],
    queryFn: async () => {
      if (!activeBike) return [];
      const { data } = await supabase
        .from('admin_rides_v')
        .select('id, started_at, rider_name, start_stand_name, end_stand_name, status, minutes')
        .eq('bike_id', activeBike.id)
        .order('started_at', { ascending: false })
        .limit(10);
      return (data as RecentRideRow[]) || [];
    },
    enabled: Boolean(activeBike),
  });

  // Fetch recent issues for selected bike
  const { data: recentIssues = [] } = useQuery<RecentIssueRow[]>({
    queryKey: ['bike-recent-issues', activeBike?.id],
    queryFn: async () => {
      if (!activeBike) return [];
      const { data } = await supabase
        .from('admin_issues_v')
        .select('id, type, note, status, urgency, created_at')
        .eq('bike_id', activeBike.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return (data as RecentIssueRow[]) || [];
    },
    enabled: Boolean(activeBike),
  });

  // Toggle bike selection
  const toggleSelectBike = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBikeIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedBikeIds.length === filteredBikes.length) {
      setSelectedBikeIds([]);
    } else {
      setSelectedBikeIds(filteredBikes.map((b) => b.id));
    }
  };

  // 1. Add bikes handler
  const handleAddBikes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collegeId || !addStandId || addCount < 1 || addCount > 50) return;

    setAddLoading(true);
    try {
      const res = await createBikes(supabase, collegeId, addStandId, addCount, addNotes.trim());
      // The labels page takes bike ids (05 A09), the RPC answers codes
      const { data: created } = await supabase
        .from('bikes')
        .select('id')
        .eq('college_id', collegeId)
        .in('short_code', res.codes);
      const ids = (created ?? []).map((b) => b.id).join(',');
      toast.success(t('a08.added', { codes: res.codes.join(', ') }), {
        action: {
          label: en.a08.print,
          onClick: () => router.push(ids ? `/bikes/labels?ids=${ids}` : '/bikes/labels'),
        },
        duration: 8000,
      });
      setAddDialogOpen(false);
      setAddNotes('');
      setAddCount(1);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setAddLoading(false);
    }
  };

  // 2. Bulk move bikes handler
  const handleBulkMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMoveStandId || selectedBikeIds.length === 0) return;

    setBulkMoveLoading(true);
    try {
      const selectedBikes = bikes.filter((b) => selectedBikeIds.includes(b.id));
      const moves = selectedBikes.map((b) => ({
        bike_code: b.short_code,
        stand_id: bulkMoveStandId,
      }));

      await moveBikes(supabase, moves);
      toast.success(`Moved ${moves.length} bikes to selected stand`);
      setBulkMoveDialogOpen(false);
      setSelectedBikeIds([]);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setBulkMoveLoading(false);
    }
  };

  // 3. Update bike notes handler
  const handleSaveNotes = async () => {
    if (!activeBike) return;
    setSavingNotes(true);
    try {
      await updateBikeNotes(supabase, activeBike.id, editNotes.trim());
      toast.success('Notes updated');
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setSavingNotes(false);
    }
  };

  // 4. Move single bike handler
  const handleMoveSingle = async () => {
    if (!activeBike || !moveStandTargetId) return;
    setMoveSingleLoading(true);
    try {
      await moveBike(supabase, activeBike.id, moveStandTargetId);
      toast.success(`Bike ${activeBike.short_code} relocated`);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setMoveSingleLoading(false);
    }
  };

  // 5. Toggle maintenance handler
  const handleToggleMaintenance = async () => {
    if (!activeBike) return;
    const isCurrentlyMaint = activeBike.status === 'maintenance';

    if (!isCurrentlyMaint) {
      // Prompt for note
      setMaintNote('');
      setMaintDialogOpen(true);
    } else {
      // Exit maintenance directly
      setMaintLoading(true);
      try {
        await setBikeMaintenance(supabase, activeBike.id, false, 'Cleared by admin');
        toast.success(`Bike ${activeBike.short_code} returned to service`);
        refetch();
      } catch (err) {
        const appErr = toAppError(err);
        toast.error(messageFor(appErr.code, appErr.data));
      } finally {
        setMaintLoading(false);
      }
    }
  };

  const handleConfirmMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBike) return;
    setMaintLoading(true);
    try {
      await setBikeMaintenance(supabase, activeBike.id, true, maintNote.trim());
      toast.success(`Bike ${activeBike.short_code} moved to maintenance`);
      setMaintDialogOpen(false);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setMaintLoading(false);
    }
  };

  // 6. Clear AI flag handler
  const handleClearFlag = async () => {
    if (!activeBike) return;
    try {
      await clearBikeFlag(supabase, activeBike.id);
      toast.success('AI flag cleared');
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  // 7. Mark missing handler
  const handleMarkMissing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBike || missingNote.trim().length < 3) return;

    setMissingLoading(true);
    try {
      await markBikeMissing(supabase, activeBike.id, missingNote.trim(), missingAddStrike);
      toast.success(`Bike ${activeBike.short_code} marked missing`);
      setMissingDialogOpen(false);
      setDetailBikeId(null);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setMissingLoading(false);
    }
  };

  // 8. Retire bike handler
  const handleRetireBike = async () => {
    if (!activeBike) return;
    setRetireLoading(true);
    try {
      await retireBike(supabase, activeBike.id);
      toast.success(`Bike ${activeBike.short_code} retired`);
      setRetireDialogOpen(false);
      setDetailBikeId(null);
      refetch();
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setRetireLoading(false);
    }
  };

  // Columns definition
  const columns: Column<AdminBikeRow>[] = [
    {
      key: 'select',
      header: (
        <button type="button" onClick={toggleSelectAll} className="text-muted hover:text-fg cursor-pointer">
          {selectedBikeIds.length > 0 && selectedBikeIds.length === filteredBikes.length ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4" />
          )}
        </button>
      ),
      render: (row) => (
        <button
          type="button"
          onClick={(e) => toggleSelectBike(row.id, e)}
          className="text-muted hover:text-fg cursor-pointer"
        >
          {selectedBikeIds.includes(row.id) ? (
            <CheckSquare className="size-4 text-primary" />
          ) : (
            <Square className="size-4" />
          )}
        </button>
      ),
      className: 'w-10',
    },
    {
      key: 'short_code',
      header: 'Code',
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-xs text-fg">{row.short_code}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: 'location',
      header: 'Location / Holder',
      render: (row) => (
        <div className="flex flex-col text-xs font-mono">
          {row.holder_name ? (
            <>
              <span className="text-fg font-medium truncate max-w-[150px]">{row.holder_name}</span>
              <span className="text-muted text-[11px]">On pass {row.pass_label}</span>
            </>
          ) : (
            <span className="text-muted">{row.stand_name || 'No stand'}</span>
          )}
        </div>
      ),
    },
    {
      key: 'borrowed_at',
      header: 'Since',
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.borrowed_at ? formatDistanceToNow(new Date(row.borrowed_at), { addSuffix: true }) : '—'}
        </span>
      ),
    },
    {
      key: 'last_seen_at',
      header: 'Last Seen',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-muted whitespace-nowrap">
          {row.last_seen_at
            ? `${formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true })}${
                row.last_seen_stand_name ? ` · ${row.last_seen_stand_name}` : ''
              }`
            : 'Never'}
        </span>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (row) => (
        <span className="text-xs font-mono text-muted truncate max-w-[140px] block">{row.notes || '—'}</span>
      ),
    },
    {
      key: 'ai_flag',
      header: 'Flag',
      render: (row) =>
        row.ai_flag ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-warn/15 text-warn border border-warn/30 whitespace-nowrap">
            {row.ai_flag}
          </span>
        ) : null,
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <PageHeader title={en.a08.title} />
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Page Header */}
      <PageHeader
        title={en.a08.title}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/bikes/labels')}
              className="h-10 px-4 rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer shadow-2xs"
            >
              <Printer className="size-3.5 mr-1.5" />
              {en.a08.print}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAddStandId(stands[0]?.id || '');
                setAddCount(1);
                setAddNotes('');
                setAddDialogOpen(true);
              }}
              className="h-10 px-4 rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer shadow-2xs"
            >
              <Plus className="size-3.5 mr-1.5" />
              {en.a08.add}
            </Button>
          </div>
        }
      />

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code, stand, or rider..."
              className="pl-8 text-xs font-mono bg-surface2/60 border-border h-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono h-10">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="borrowed">Borrowed</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>

          <Select value={standFilter} onValueChange={(val) => setStandFilter(val || 'all')}>
            <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono h-10">
              <SelectValue placeholder="All stands" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="all">All stands</SelectItem>
              {stands.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setAiFlaggedOnly((prev) => !prev)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              aiFlaggedOnly
                ? 'bg-warn text-on-primary font-bold'
                : 'bg-surface2 text-muted hover:text-fg border border-border'
            }`}
          >
            {en.a08.ai_flagged}
          </button>

          <span className="ml-auto text-xs font-mono text-muted">
            Showing {filteredBikes.length} of {bikes.length} bikes
          </span>
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {selectedBikeIds.length > 0 && (
        <div className="p-3 px-4 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-3 text-xs font-mono animate-in fade-in">
          <span className="font-bold text-fg">
            {selectedBikeIds.length} {selectedBikeIds.length === 1 ? 'bike' : 'bikes'} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setBulkMoveStandId(stands[0]?.id || '');
                setBulkMoveDialogOpen(true);
              }}
              className="h-8 rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
            >
              <MoveRight className="size-3 mr-1" />
              {en.a08.move}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => router.push(`/bikes/labels?ids=${selectedBikeIds.join(',')}`)}
              className="h-8 rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
            >
              <Printer className="size-3 mr-1" />
              {en.a08.print}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setSelectedBikeIds([])}
              className="h-8 rounded-full text-xs font-mono cursor-pointer"
            >
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Bikes Data Table */}
      <DataTable
        columns={columns}
        data={filteredBikes}
        loading={isLoading}
        onRowClick={(row) => setDetailBikeId(row.id)}
        emptyTitle="no bikes *found*"
        emptyDescription="No bicycles match the current search or filters."
      />

      {/* Bike Detail Sheet */}
      <Sheet open={Boolean(detailBikeId)} onOpenChange={(open) => !open && setDetailBikeId(null)}>
        <SheetContent
          side="right"
          className="bg-surface border-border w-full sm:max-w-md p-6 overflow-y-auto"
        >
          {activeBike && (
            <div className="flex flex-col gap-6">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-2xl text-fg">{activeBike.short_code}</span>
                  <StatusPill status={activeBike.status} />
                  {activeBike.ai_flag && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-warn/15 text-warn border border-warn/30">
                      {activeBike.ai_flag}
                    </span>
                  )}
                </div>
                <SheetTitle className="font-display font-bold text-lg text-fg lowercase">
                  bike details
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-muted">
                  ID: {activeBike.id}
                </SheetDescription>
              </SheetHeader>

              {/* Holder Card (if currently borrowed) */}
              {activeBike.status === 'borrowed' && activeBike.holder_name && (
                <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-col gap-3">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                    Current Rider
                  </span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-bold text-base text-fg">{activeBike.holder_name}</span>
                    <span className="font-mono text-xs text-muted">{activeBike.pass_label}</span>
                  </div>
                  {activeRide && (
                    <div className="text-xs font-mono text-muted">
                      Borrowed {format(new Date(activeRide.started_at), 'h:mm a')} · Due{' '}
                      {format(new Date(activeRide.due_at), 'h:mm a')}
                    </div>
                  )}
                  {activeRide && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setForceRideId(activeRide.id);
                        setForceDialogOpen(true);
                      }}
                      className="rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer self-start mt-1"
                    >
                      Force return
                    </Button>
                  )}
                </div>
              )}

              {/* Maintenance Toggle */}
              <div className="p-4 rounded-xl bg-surface2/50 border border-border flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                    <Wrench className="size-3.5 text-primary" />
                    {en.a08.maintenance}
                  </span>
                  <span className="text-[11px] font-mono text-muted">
                    Take bike out of active service for repair
                  </span>
                </div>
                <Switch
                  checked={activeBike.status === 'maintenance'}
                  onCheckedChange={handleToggleMaintenance}
                  disabled={maintLoading}
                  className="cursor-pointer"
                />
              </div>

              {/* Move to Stand Select */}
              <div className="p-4 rounded-xl bg-surface2/50 border border-border flex flex-col gap-2.5">
                <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                  <MoveRight className="size-3.5 text-primary" />
                  {en.a08.move}
                </span>
                <div className="flex items-center gap-2">
                  <Select value={moveStandTargetId} onValueChange={(val) => setMoveStandTargetId(val || '')}>
                    <SelectTrigger className="bg-surface border-border text-xs font-mono flex-1 h-9">
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
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleMoveSingle}
                    disabled={moveSingleLoading || !moveStandTargetId}
                    className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer h-9 px-3"
                  >
                    Move
                  </Button>
                </div>
              </div>

              {/* AI Flag Action */}
              {activeBike.ai_flag && (
                <div className="p-4 rounded-xl bg-warn/10 border border-warn/30 flex items-center justify-between gap-3">
                  <div className="flex flex-col text-xs font-mono">
                    <span className="font-bold text-warn flex items-center gap-1">
                      <Sparkles className="size-3.5" />
                      Flagged: {activeBike.ai_flag}
                    </span>
                    <span className="text-muted text-[11px]">Flagged by automated inspection</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleClearFlag}
                    className="rounded-full text-xs font-mono border-warn/40 text-warn hover:bg-warn/15 cursor-pointer h-8"
                  >
                    {en.a08.clear_flag}
                  </Button>
                </div>
              )}

              {/* Notes Textarea */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="bike-notes" className="text-xs font-mono text-muted">
                  {en.a08.notes}
                </Label>
                <Textarea
                  id="bike-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Service history, frame notes..."
                  rows={3}
                  className="text-xs bg-surface2/60 border-border resize-none"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="self-end rounded-full text-xs font-mono border-border bg-surface cursor-pointer h-8 px-3"
                >
                  <Save className="size-3 mr-1" />
                  Save notes
                </Button>
              </div>

              {/* Recent Rides Table (last 10) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <span className="text-xs font-mono font-bold text-fg">Recent Rides (Last 10)</span>
                {recentRides.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">No rides recorded.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {recentRides.map((ride) => (
                      <div
                        key={ride.id}
                        className="p-2.5 rounded-lg bg-surface2/40 border border-border flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex flex-col">
                          <span className="text-fg font-medium">{ride.rider_name || 'Rider'}</span>
                          <span className="text-muted text-[11px]">
                            {ride.start_stand_name || '—'} → {ride.end_stand_name || '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted">{ride.minutes ?? '—'} min</span>
                          <StatusPill status={ride.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Issues Table (last 10) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <span className="text-xs font-mono font-bold text-fg">Reported Issues (Last 10)</span>
                {recentIssues.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">No issues reported.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                    {recentIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="p-2.5 rounded-lg bg-surface2/40 border border-border flex items-center justify-between text-xs font-mono"
                      >
                        <div className="flex flex-col truncate max-w-[200px]">
                          <span className="text-fg font-bold uppercase text-[11px]">{issue.type}</span>
                          <span className="text-muted text-[11px] truncate">{issue.note}</span>
                        </div>
                        <StatusPill status={issue.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Danger Zone: Mark Missing & Retire */}
              <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setMissingNote('');
                    setMissingAddStrike(false);
                    setMissingDialogOpen(true);
                  }}
                  className="rounded-full text-xs font-mono border-bad/50 text-bad hover:bg-bad/10 cursor-pointer"
                >
                  <AlertTriangle className="size-3.5 mr-1" />
                  {en.a08.missing}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRetireDialogOpen(true)}
                  className="rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer ml-auto"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  {en.a08.retire}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Bikes Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">{en.a08.add}</DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Generate sequential numbered bikes with signed QR codes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddBikes} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-stand" className="text-xs font-mono text-muted">
                {en.a08.add_stand}
              </Label>
              <Select value={addStandId} onValueChange={(val) => setAddStandId(val || '')}>
                <SelectTrigger id="add-stand" className="bg-surface2/60 border-border text-xs font-mono">
                  <SelectValue placeholder="Select starting stand" />
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
              <Label htmlFor="add-count" className="text-xs font-mono text-muted">
                {en.a08.add_count} (1 - 50)
              </Label>
              <Input
                id="add-count"
                type="number"
                min={1}
                max={50}
                required
                value={addCount}
                onChange={(e) => setAddCount(parseInt(e.target.value) || 1)}
                className="bg-surface2/60 border-border text-xs font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-notes" className="text-xs font-mono text-muted">
                {en.a08.notes} (optional)
              </Label>
              <Textarea
                id="add-notes"
                value={addNotes}
                onChange={(e) => setAddNotes(e.target.value)}
                placeholder="Batch notes, procurement date..."
                rows={2}
                className="bg-surface2/60 border-border text-xs font-mono resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={addLoading}
                onClick={() => setAddDialogOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addLoading || !addStandId}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                {addLoading ? 'Creating...' : en.a08.add}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              {en.a08.move} ({selectedBikeIds.length} bikes)
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Relocate selected bikes to a campus stand.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleBulkMove} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-mono text-muted">Target Stand</Label>
              <Select value={bulkMoveStandId} onValueChange={(val) => setBulkMoveStandId(val || '')}>
                <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono">
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

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={bulkMoveLoading}
                onClick={() => setBulkMoveDialogOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={bulkMoveLoading || !bulkMoveStandId}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                {bulkMoveLoading ? 'Moving...' : 'Confirm move'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Maintenance Prompt Dialog */}
      <Dialog open={maintDialogOpen} onOpenChange={setMaintDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              Move to maintenance
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Provide reason or service issue details.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfirmMaintenance} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="maint-note" className="text-xs font-mono text-muted">
                Reason / Repair Notes
              </Label>
              <Textarea
                id="maint-note"
                value={maintNote}
                onChange={(e) => setMaintNote(e.target.value)}
                placeholder="e.g. Broken rear chain, flat tyre..."
                rows={3}
                className="bg-surface2/60 border-border text-xs font-mono resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={maintLoading}
                onClick={() => setMaintDialogOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={maintLoading}
                className="rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
              >
                {maintLoading ? 'Saving...' : 'Set maintenance'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark Missing Dialog */}
      <Dialog open={missingDialogOpen} onOpenChange={setMissingDialogOpen}>
        <DialogContent className="max-w-md bg-surface border-border">
          <DialogHeader>
            <DialogTitle className="font-display lowercase text-lg font-bold">
              {en.a08.missing} {activeBike?.short_code}
            </DialogTitle>
            <DialogDescription className="text-muted text-xs">
              Bike will be marked as missing and removed from its current pass or stand.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleMarkMissing} className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="missing-note" className="text-xs font-mono text-muted">
                Incident note (min 3 characters)
              </Label>
              <Textarea
                id="missing-note"
                required
                value={missingNote}
                onChange={(e) => setMissingNote(e.target.value)}
                placeholder="Circumstances of disappearance..."
                rows={3}
                className="bg-surface2/60 border-border text-xs font-mono resize-none"
              />
            </div>

            {activeBike?.holder_name && (
              <div className="flex items-center gap-2 pt-1">
                <Checkbox
                  id="missing-strike"
                  checked={missingAddStrike}
                  onCheckedChange={(c) => setMissingAddStrike(Boolean(c))}
                  className="cursor-pointer"
                />
                <Label
                  htmlFor="missing-strike"
                  className="text-xs font-mono text-fg cursor-pointer select-none"
                >
                  Add strike to {activeBike.holder_name}
                </Label>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 mt-2">
              <Button
                type="button"
                variant="outline"
                disabled={missingLoading}
                onClick={() => setMissingDialogOpen(false)}
                className="rounded-full border-border bg-surface text-xs font-mono cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={missingLoading || missingNote.trim().length < 3}
                className="rounded-full text-xs font-mono font-bold bg-bad text-white hover:bg-bad/90 cursor-pointer"
              >
                {missingLoading ? 'Marking...' : en.a08.missing}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Retire Bike Confirm Dialog */}
      <ConfirmDialog
        open={retireDialogOpen}
        onOpenChange={setRetireDialogOpen}
        title={`${en.a08.retire} ${activeBike?.short_code}?`}
        description={en.a08.retire_body}
        destructive={true}
        confirmLabel={retireLoading ? 'Retiring...' : en.a08.retire}
        onConfirm={handleRetireBike}
      />

      {/* Force Return Dialog */}
      {forceRideId && activeBike && (
        <ForceReturnDialog
          open={forceDialogOpen}
          onOpenChange={(open) => {
            setForceDialogOpen(open);
            if (!open) setForceRideId(null);
          }}
          rideId={forceRideId}
          bikeCode={activeBike.short_code}
          stands={stands}
          defaultStandId={activeBike.current_stand_id || stands[0]?.id}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ['bike-active-ride', activeBike.id] });
          }}
        />
      )}
    </div>
  );
}

export default function BikesPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs text-muted">Loading fleet...</div>}>
      <BikesPageContent />
    </Suspense>
  );
}
