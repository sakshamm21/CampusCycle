'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { format, subDays, subHours } from 'date-fns';
import { Download, Search, Bike as BikeIcon, User, Sparkles, AlertTriangle, Compass } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, type Column } from '@/components/common/DataTable';
import { StatusPill } from '@/components/common/StatusPill';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { ForceReturnDialog } from '@/components/common/ForceReturnDialog';
import { ErrorState } from '@/components/common/ErrorState';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { exportCsv } from '@/lib/csv';
import { en } from '@campuscycle/shared';

interface AdminRideRow extends Record<string, unknown> {
  id: string;
  college_id: string;
  rider_id: string | null;
  rider_name: string | null;
  pass_label: string | null;
  bike_code: string;
  bike_id: string;
  start_stand_id: string | null;
  start_stand_name: string | null;
  end_stand_id: string | null;
  end_stand_name: string | null;
  started_at: string;
  due_at: string;
  ended_at: string | null;
  status: string;
  is_overdue: boolean;
  late: boolean;
  return_photo_path: string | null;
  photo_check: string;
  photo_check_note: string | null;
  flags: string[];
  force_note: string | null;
  minutes: number | null;
  is_demo: boolean;
}

interface RideLocationDetails {
  start_lat: number | null;
  start_lng: number | null;
  start_accuracy_m: number | null;
  end_lat: number | null;
  end_lng: number | null;
  end_accuracy_m: number | null;
}

function RidesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { collegeId } = useCollege();

  // Filters state
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [standFilter, setStandFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [lateOnly, setLateOnly] = useState<boolean>(false);
  const [photoFlaggedOnly, setPhotoFlaggedOnly] = useState<boolean>(false);

  // Detail Sheet state
  const rideParam = searchParams.get('ride');
  const [selectedRideId, setSelectedRideId] = useState<string | null>(rideParam);

  useEffect(() => {
    if (rideParam) {
      setSelectedRideId(rideParam);
    }
  }, [rideParam]);

  // Force return dialog state
  const [forceDialogOpen, setForceDialogOpen] = useState<boolean>(false);
  const [forceRideTarget, setForceRideTarget] = useState<{ id: string; code: string } | null>(null);

  // Fetch stands list for stand filter and force-return dialog
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

  // Fetch rides from admin_rides_v
  const {
    data: rides = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['rides', collegeId],
    queryFn: async () => {
      if (!collegeId) return [];
      const { data, error } = await supabase
        .from('admin_rides_v')
        .select('*')
        .eq('college_id', collegeId)
        .order('started_at', { ascending: false });

      if (error) throw error;
      return (data as AdminRideRow[]) || [];
    },
    enabled: Boolean(collegeId),
    refetchInterval: 30000,
  });

  // Filter rides based on user selection
  const filteredRides = useMemo(() => {
    return rides.filter((ride) => {
      // 1. Status filter
      if (statusFilter !== 'all' && ride.status !== statusFilter) {
        return false;
      }

      // 2. Stand filter (either start or end stand)
      if (standFilter !== 'all') {
        if (ride.start_stand_id !== standFilter && ride.end_stand_id !== standFilter) {
          return false;
        }
      }

      // 3. Late only filter
      if (lateOnly && !ride.late && !ride.is_overdue) {
        return false;
      }

      // 4. Photo flagged only filter (unclear or failed)
      if (photoFlaggedOnly && !['unclear', 'failed'].includes(ride.photo_check)) {
        return false;
      }

      // 5. Date range filter
      if (dateRangeFilter !== 'all') {
        const rideDate = new Date(ride.started_at);
        const now = new Date();
        let cutoffDate: Date;
        if (dateRangeFilter === '24h') cutoffDate = subHours(now, 24);
        else if (dateRangeFilter === '7d') cutoffDate = subDays(now, 7);
        else cutoffDate = subDays(now, 30);

        if (rideDate < cutoffDate) {
          return false;
        }
      }

      // 6. Text search (bike code, rider name, pass label)
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const codeMatch = ride.bike_code?.toLowerCase().includes(q);
        const nameMatch = ride.rider_name?.toLowerCase().includes(q);
        const passMatch = ride.pass_label?.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !passMatch) {
          return false;
        }
      }

      return true;
    });
  }, [rides, statusFilter, standFilter, lateOnly, photoFlaggedOnly, dateRangeFilter, search]);

  // Selected ride object
  const selectedRide = useMemo(() => {
    if (!selectedRideId) return null;
    return rides.find((r) => r.id === selectedRideId) || null;
  }, [selectedRideId, rides]);

  // Fetch coordinates and accuracy from rides table when sheet is open
  const { data: locationDetails } = useQuery<RideLocationDetails | null>({
    queryKey: ['ride-location', selectedRideId],
    queryFn: async () => {
      if (!selectedRideId) return null;
      const { data, error } = await supabase
        .from('rides')
        .select('start_lat, start_lng, start_accuracy_m, end_lat, end_lng, end_accuracy_m')
        .eq('id', selectedRideId)
        .maybeSingle();

      if (error) return null;
      return data as RideLocationDetails;
    },
    enabled: Boolean(selectedRideId),
  });

  // Fetch AI trace for photo check if available
  const { data: photoCheckTraceId } = useQuery<string | null>({
    queryKey: ['ride-trace', selectedRideId],
    queryFn: async () => {
      if (!selectedRideId) return null;
      const { data, error } = await supabase
        .from('ai_runs')
        .select('id')
        .eq('trigger', 'photo_check')
        .ilike('input_summary', `%${selectedRideId}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) return null;
      return data.id;
    },
    enabled: Boolean(selectedRideId && selectedRide?.return_photo_path),
  });

  // Handle CSV export
  const handleExportCsv = () => {
    if (filteredRides.length === 0) {
      toast.error('No rides to export in current view');
      return;
    }

    const filename = `rides-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    const exportColumns = [
      { key: 'started_at' as keyof AdminRideRow, header: 'started_at' },
      { key: 'ended_at' as keyof AdminRideRow, header: 'ended_at' },
      { key: 'minutes' as keyof AdminRideRow, header: 'minutes' },
      { key: 'rider_name' as keyof AdminRideRow, header: 'rider_name' },
      { key: 'pass_label' as keyof AdminRideRow, header: 'pass_label' },
      { key: 'bike_code' as keyof AdminRideRow, header: 'bike_code' },
      { key: 'start_stand_name' as keyof AdminRideRow, header: 'start_stand_name' },
      { key: 'end_stand_name' as keyof AdminRideRow, header: 'end_stand_name' },
      { key: 'status' as keyof AdminRideRow, header: 'status' },
      { key: 'late' as keyof AdminRideRow, header: 'late' },
      { key: 'photo_check' as keyof AdminRideRow, header: 'photo_check' },
    ];

    exportCsv(filename, filteredRides, exportColumns);
    toast.success(`Exported ${filteredRides.length} rides to ${filename}`);
  };

  // Close Detail Sheet
  const handleCloseSheet = (open: boolean) => {
    if (!open) {
      setSelectedRideId(null);
      if (searchParams.get('ride')) {
        router.replace('/rides');
      }
    }
  };

  // Table columns definition
  const columns: Column<AdminRideRow>[] = [
    {
      key: 'started_at',
      header: 'Started',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg whitespace-nowrap">
          {format(new Date(row.started_at), 'd MMM yyyy, h:mm a')}
        </span>
      ),
    },
    {
      key: 'rider_name',
      header: 'Rider',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-fg">{row.rider_name || 'Anonymous'}</span>
          <span className="font-mono text-[11px] text-muted">{row.pass_label || '—'}</span>
        </div>
      ),
    },
    {
      key: 'bike_code',
      header: 'Bike',
      sortable: true,
      render: (row) => <span className="font-mono font-bold text-xs text-fg">{row.bike_code}</span>,
    },
    {
      key: 'stands',
      header: 'From → To',
      render: (row) => (
        <span className="text-xs font-mono text-muted whitespace-nowrap">
          {row.start_stand_name || '—'} → {row.end_stand_name || (row.status === 'active' ? 'on road' : '—')}
        </span>
      ),
    },
    {
      key: 'minutes',
      header: 'Duration',
      sortable: true,
      render: (row) => (
        <span className="font-mono text-xs text-fg">
          {row.minutes !== null ? `${row.minutes} min` : 'active'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          {row.late && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-warn/15 text-warn border border-warn/30">
              LATE
            </span>
          )}
          {row.is_overdue && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-bad text-white">
              OVERDUE
            </span>
          )}
          {row.status === 'force_returned' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-bad/15 text-bad border border-bad/30">
              FORCED
            </span>
          )}
          {/* Photo check chip */}
          {row.photo_check === 'ok' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-ok/15 text-ok border border-ok/30">
              PHOTO OK
            </span>
          )}
          {row.photo_check === 'unclear' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-warn/15 text-warn border border-warn/30">
              PHOTO UNCLEAR
            </span>
          )}
          {row.photo_check === 'failed' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-bad/15 text-bad border border-bad/30">
              PHOTO FAILED
            </span>
          )}
          {row.photo_check === 'pending' && row.return_photo_path && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-muted bg-surface2 border border-border">
              PHOTO PENDING
            </span>
          )}
        </div>
      ),
    },
  ];

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <PageHeader title={en.a07.title} />
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full pb-16">
      {/* Page Header */}
      <PageHeader
        title={en.a07.title}
        actions={
          <Button
            type="button"
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredRides.length === 0}
            className="h-10 px-4 rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer shadow-2xs"
          >
            <Download className="size-3.5 mr-1.5" />
            {en.a07.export}
          </Button>
        }
      />

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl border border-border bg-surface shadow-xs flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search bike code or rider..."
              className="pl-8 text-xs font-mono bg-surface2/60 border-border h-10"
            />
          </div>

          {/* Status Dropdown */}
          <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
            <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono h-10">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="force_returned">Force returned</SelectItem>
            </SelectContent>
          </Select>

          {/* Stand Dropdown */}
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

          <Select
            value={dateRangeFilter}
            onValueChange={(val) => setDateRangeFilter(val as '24h' | '7d' | '30d' | 'all')}
          >
            <SelectTrigger className="bg-surface2/60 border-border text-xs font-mono h-10">
              <SelectValue placeholder="Date range" />
            </SelectTrigger>
            <SelectContent className="bg-surface border-border text-xs font-mono">
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days (default)</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick Filter Toggle Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={() => setLateOnly((prev) => !prev)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              lateOnly
                ? 'bg-warn text-on-primary font-bold'
                : 'bg-surface2 text-muted hover:text-fg border border-border'
            }`}
          >
            {en.a07.late_only}
          </button>

          <button
            type="button"
            onClick={() => setPhotoFlaggedOnly((prev) => !prev)}
            className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              photoFlaggedOnly
                ? 'bg-bad text-white font-bold'
                : 'bg-surface2 text-muted hover:text-fg border border-border'
            }`}
          >
            {en.a07.photo_flagged}
          </button>

          <span className="ml-auto text-xs font-mono text-muted">
            Showing {filteredRides.length} of {rides.length} rides
          </span>
        </div>
      </div>

      {/* Rides Data Table */}
      <DataTable
        columns={columns}
        data={filteredRides}
        loading={isLoading}
        onRowClick={(row) => setSelectedRideId(row.id)}
        emptyTitle="no rides *found*"
        emptyDescription="No rides match the selected filters or date range."
      />

      {/* Ride Detail Sheet */}
      <Sheet open={Boolean(selectedRideId)} onOpenChange={handleCloseSheet}>
        <SheetContent
          side="right"
          className="bg-surface border-border w-full sm:max-w-md p-6 overflow-y-auto"
        >
          {selectedRide && (
            <div className="flex flex-col gap-6">
              <SheetHeader className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-xl text-fg">{selectedRide.bike_code}</span>
                  <StatusPill status={selectedRide.status} />
                  {selectedRide.late && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-warn/15 text-warn border border-warn/30">
                      LATE
                    </span>
                  )}
                  {selectedRide.is_overdue && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-bad text-white">
                      OVERDUE
                    </span>
                  )}
                </div>
                <SheetTitle className="font-display font-bold text-lg text-fg lowercase">
                  ride details · {selectedRide.rider_name || 'rider'}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs text-muted">
                  Pass: {selectedRide.pass_label || '—'}
                </SheetDescription>
              </SheetHeader>

              {/* Ride Summary Grid */}
              <div className="p-4 rounded-xl bg-surface2/50 border border-border grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Started</span>
                  <span className="text-fg font-medium">
                    {format(new Date(selectedRide.started_at), 'd MMM yyyy, h:mm a')}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Ended</span>
                  <span className="text-fg font-medium">
                    {selectedRide.ended_at
                      ? format(new Date(selectedRide.ended_at), 'd MMM yyyy, h:mm a')
                      : 'In progress'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Start Stand</span>
                  <span className="text-fg font-medium">{selectedRide.start_stand_name || '—'}</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">End Stand</span>
                  <span className="text-fg font-medium">
                    {selectedRide.end_stand_name || (selectedRide.status === 'active' ? 'On road' : '—')}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Duration</span>
                  <span className="text-fg font-medium">
                    {selectedRide.minutes !== null ? `${selectedRide.minutes} minutes` : 'Active'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Due At</span>
                  <span className="text-fg font-medium">
                    {format(new Date(selectedRide.due_at), 'h:mm a')}
                  </span>
                </div>
              </div>

              {/* GPS Coordinates & Accuracy */}
              {locationDetails && (
                <div className="p-4 rounded-xl bg-surface2/30 border border-border flex flex-col gap-2.5 text-xs font-mono">
                  <span className="text-muted uppercase text-[10px] tracking-wider flex items-center gap-1 font-bold">
                    <Compass className="size-3 text-primary" />
                    GPS Fixes
                  </span>

                  {locationDetails.start_lat && locationDetails.start_lng && (
                    <div className="flex flex-col">
                      <span className="text-muted text-[11px]">Start Fix</span>
                      <span className="text-fg font-medium">
                        {locationDetails.start_lat.toFixed(5)}, {locationDetails.start_lng.toFixed(5)}
                        {locationDetails.start_accuracy_m !== null
                          ? ` (±${Math.round(locationDetails.start_accuracy_m)}m)`
                          : ''}
                      </span>
                    </div>
                  )}

                  {locationDetails.end_lat && locationDetails.end_lng && (
                    <div className="flex flex-col pt-1.5 border-t border-border">
                      <span className="text-muted text-[11px]">End Fix</span>
                      <span className="text-fg font-medium">
                        {locationDetails.end_lat.toFixed(5)}, {locationDetails.end_lng.toFixed(5)}
                        {locationDetails.end_accuracy_m !== null
                          ? ` (±${Math.round(locationDetails.end_accuracy_m)}m)`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Force Return Note */}
              {selectedRide.force_note && (
                <div className="p-3.5 rounded-xl bg-bad/10 border border-bad/30 flex flex-col gap-1 text-xs font-mono text-bad">
                  <span className="font-bold flex items-center gap-1">
                    <AlertTriangle className="size-3.5" />
                    Force Return Reason:
                  </span>
                  <p className="leading-relaxed">{selectedRide.force_note}</p>
                </div>
              )}

              {/* Return Photo & TORQ Check */}
              {selectedRide.return_photo_path ? (
                <div className="flex flex-col gap-3 p-4 rounded-xl bg-surface2/40 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                      Return Photo
                    </span>

                    {/* Photo check chip */}
                    {selectedRide.photo_check === 'ok' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-ok/15 text-ok border border-ok/30">
                        PHOTO OK
                      </span>
                    )}
                    {selectedRide.photo_check === 'unclear' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-warn/15 text-warn border border-warn/30">
                        PHOTO UNCLEAR
                      </span>
                    )}
                    {selectedRide.photo_check === 'failed' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-bad/15 text-bad border border-bad/30">
                        PHOTO FAILED
                      </span>
                    )}
                    {selectedRide.photo_check === 'pending' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono text-muted bg-surface2 border border-border">
                        PHOTO PENDING
                      </span>
                    )}
                  </div>

                  <PhotoThumb
                    bucket="return-photos"
                    path={selectedRide.return_photo_path}
                    width={360}
                    height={220}
                    alt={`Return photo for ${selectedRide.bike_code}`}
                    className="w-full h-48 rounded-xl object-cover shadow-xs"
                  />

                  {selectedRide.photo_check_note && (
                    <p className="text-xs font-mono text-muted leading-relaxed">
                      {selectedRide.photo_check_note}
                    </p>
                  )}

                  {/* Link to TORQ trace if available */}
                  {photoCheckTraceId && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/torq/traces/${photoCheckTraceId}`)}
                      className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer self-start mt-1"
                    >
                      <Sparkles className="size-3 mr-1 text-primary" />
                      View TORQ trace
                    </Button>
                  )}
                </div>
              ) : selectedRide.status !== 'active' ? (
                <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs font-mono text-muted">
                  No return photo submitted.
                </div>
              ) : null}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                {selectedRide.rider_id && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/users/${selectedRide.rider_id}`)}
                    className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                  >
                    <User className="size-3.5 mr-1" />
                    Open rider
                  </Button>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/bikes?search=${selectedRide.bike_code}`)}
                  className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                >
                  <BikeIcon className="size-3.5 mr-1" />
                  Open bike
                </Button>

                {selectedRide.status === 'active' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForceRideTarget({
                        id: selectedRide.id,
                        code: selectedRide.bike_code,
                      });
                      setForceDialogOpen(true);
                    }}
                    className="ml-auto rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    {en.a07.force}
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Force Return Dialog */}
      {forceRideTarget && (
        <ForceReturnDialog
          open={forceDialogOpen}
          onOpenChange={(open) => {
            setForceDialogOpen(open);
            if (!open) setForceRideTarget(null);
          }}
          rideId={forceRideTarget.id}
          bikeCode={forceRideTarget.code}
          stands={stands}
          defaultStandId={selectedRide?.start_stand_id || stands[0]?.id}
          onSuccess={() => {
            refetch();
            setSelectedRideId(null);
          }}
        />
      )}
    </div>
  );
}

export default function RidesPage() {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs text-muted">Loading rides...</div>}>
      <RidesPageContent />
    </Suspense>
  );
}
