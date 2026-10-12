'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Layers, MapPin, Bike as BikeIcon, Clock, Sparkles, ExternalLink, X } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { ErrorState } from '@/components/common/ErrorState';
import { CampusMap, type StandData, type BikeMapData } from '@/components/map/CampusMap';
import { Button } from '@/components/ui/button';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { en, t } from '@campuscycle/shared';

// Helper to compute elapsed minutes
function getElapsedMinutes(startedAt: string, now: number): number {
  const start = new Date(startedAt).getTime();
  const diffMs = now - start;
  return Math.max(1, Math.floor(diffMs / 60000));
}

// Helper to compute current IST hour (UTC+5:30)
function getIstCurrentHour(): number {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);
  return ist.getHours();
}

interface ForecastStandHours {
  h: number;
  expected_free: number;
}

interface ForecastStand {
  stand_id?: string;
  name?: string;
  capacity?: number;
  free_now?: number;
  hours: ForecastStandHours[];
}

interface ForecastContent {
  date?: string;
  generated_at?: string;
  stands?: ForecastStand[];
}

interface StandRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m?: number;
  capacity?: number;
  active?: boolean;
  free_bikes?: number;
  maintenance_bikes?: number;
  total_bikes?: number;
  distance_m?: number;
}

interface BikeRow {
  id: string;
  short_code: string;
  status: string;
  current_stand_id: string | null;
  stand_name?: string | null;
  last_seen_at?: string | null;
  ai_flag?: string | null;
  notes?: string | null;
}

interface ActiveRideRow {
  id: string;
  rider_id?: string;
  rider_name?: string | null;
  pass_label?: string | null;
  bike_code: string;
  bike_id: string;
  start_stand_id?: string | null;
  start_stand_name?: string | null;
  started_at: string;
  due_at?: string;
  is_overdue?: boolean;
  late?: boolean;
}

export default function LiveMapPage() {
  const router = useRouter();
  const { collegeId } = useCollege();

  // Tick for updating elapsed times every 30s
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Layer toggles: Stands · Available bikes · Maintenance · Active rides
  const [layers, setLayers] = useState({
    stands: true,
    availableBikes: true,
    maintenanceBikes: true,
    activeRides: true,
  });

  // Selected stand for detail panel
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null);

  // Forecast time slider (null = "Now", otherwise hour number e.g. 15)
  const currentIstHour = useMemo(() => getIstCurrentHour(), []);
  const [selectedForecastHour, setSelectedForecastHour] = useState<number | null>(null);

  // Fetch Map Data: stands with counts, bikes, active rides, latest forecast insight
  const {
    data: mapData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['map', collegeId],
    queryFn: async () => {
      if (!collegeId) return null;

      const [standsRes, bikesRes, ridesRes, forecastRes] = await Promise.all([
        supabase.rpc('get_stands_with_counts', { p_college_id: collegeId }),
        supabase.from('admin_bikes_v').select('*').eq('college_id', collegeId),
        supabase
          .from('admin_rides_v')
          .select('*')
          .eq('college_id', collegeId)
          .eq('status', 'active')
          .order('started_at', { ascending: false }),
        supabase
          .from('ai_insights')
          .select('*')
          .eq('college_id', collegeId)
          .eq('kind', 'forecast')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (standsRes.error) throw standsRes.error;
      if (bikesRes.error) throw bikesRes.error;
      if (ridesRes.error) throw ridesRes.error;

      return {
        stands: (standsRes.data as StandRow[]) || [],
        bikes: (bikesRes.data as BikeRow[]) || [],
        activeRides: (ridesRes.data as ActiveRideRow[]) || [],
        forecast: (forecastRes.data?.content as ForecastContent) || null,
      };
    },
    enabled: Boolean(collegeId),
    refetchInterval: 30000,
  });

  // Transform stands with forecast data if slider is moved off "Now"
  const standsToRender: StandData[] = useMemo(() => {
    if (!mapData?.stands) return [];

    return mapData.stands.map((s: StandRow) => {
      let expectedFree: number | undefined;

      if (selectedForecastHour !== null && mapData.forecast?.stands) {
        const fStand = mapData.forecast.stands.find((fs) => fs.stand_id === s.id || fs.name === s.name);
        const fHour = fStand?.hours?.find((h) => h.h === selectedForecastHour);
        if (fHour !== undefined) {
          expectedFree = fHour.expected_free;
        }
      }

      return {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        capacity: s.capacity ?? 8,
        free_bikes: s.free_bikes ?? 0,
        maintenance_bikes: s.maintenance_bikes ?? 0,
        total_bikes: s.total_bikes ?? 0,
        expected_free: expectedFree,
      };
    });
  }, [mapData, selectedForecastHour]);

  // Bikes data for dots
  const bikesToRender: BikeMapData[] = useMemo(() => {
    if (!mapData?.bikes) return [];
    return mapData.bikes.map((b: BikeRow) => ({
      id: b.id,
      short_code: b.short_code,
      status: b.status,
      current_stand_id: b.current_stand_id,
    }));
  }, [mapData]);

  // Selected stand data
  const selectedStand = useMemo(() => {
    if (!selectedStandId || !mapData?.stands) return null;
    return mapData.stands.find((s: StandRow) => s.id === selectedStandId) || null;
  }, [selectedStandId, mapData]);

  // Bikes at selected stand
  const bikesAtSelectedStand = useMemo(() => {
    if (!selectedStandId || !mapData?.bikes) return [];
    return mapData.bikes.filter((b: BikeRow) => b.current_stand_id === selectedStandId);
  }, [selectedStandId, mapData]);

  // Available forecast hours range: next hour up to 22
  const forecastHoursRange = useMemo(() => {
    if (!mapData?.forecast?.stands) return [];
    const minH = Math.min(21, Math.max(7, currentIstHour + 1));
    const hours: number[] = [];
    for (let h = minH; h <= 22; h++) {
      hours.push(h);
    }
    return hours;
  }, [mapData?.forecast, currentIstHour]);

  if (error) {
    return (
      <div className="flex flex-col gap-6 w-full">
        <PageHeader title={en.a06.title} />
        <ErrorState error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-[calc(100vh-100px)] min-h-[600px]">
      {/* Top Header & Layer Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <PageHeader title={en.a06.title} className="pb-0" />

        {/* Layer Toggles Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-surface border border-border shadow-2xs self-start sm:self-auto">
          <span className="text-[11px] font-mono text-muted uppercase px-2 flex items-center gap-1">
            <Layers className="size-3" />
            {en.a06.layers}:
          </span>

          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, stands: !prev.stands }))}
            className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              layers.stands ? 'bg-primary text-on-primary font-bold' : 'bg-surface2 text-muted hover:text-fg'
            }`}
          >
            {en.a06.l_stands}
          </button>

          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, availableBikes: !prev.availableBikes }))}
            className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              layers.availableBikes
                ? 'bg-ok/20 text-ok border border-ok/40 font-bold'
                : 'bg-surface2 text-muted hover:text-fg'
            }`}
          >
            {en.a06.l_available}
          </button>

          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, maintenanceBikes: !prev.maintenanceBikes }))}
            className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              layers.maintenanceBikes
                ? 'bg-warn/20 text-warn border border-warn/40 font-bold'
                : 'bg-surface2 text-muted hover:text-fg'
            }`}
          >
            {en.a06.l_maint}
          </button>

          <button
            type="button"
            onClick={() => setLayers((prev) => ({ ...prev, activeRides: !prev.activeRides }))}
            className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
              layers.activeRides
                ? 'bg-surface2 text-fg border border-border font-bold'
                : 'bg-surface2 text-muted hover:text-fg'
            }`}
          >
            {en.a06.l_rides}
          </button>
        </div>
      </div>

      {/* Main Map + Right Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-4 h-full min-h-0 overflow-hidden">
        {/* Left: Map Area */}
        <div className="flex-1 h-[400px] lg:h-full rounded-2xl overflow-hidden border border-border bg-surface relative shadow-xs">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-surface2/30 font-mono text-xs text-muted">
              Loading campus map...
            </div>
          ) : (
            <CampusMap
              stands={standsToRender}
              bikes={bikesToRender}
              selectedStandId={selectedStandId}
              onSelectStand={setSelectedStandId}
              layers={layers}
            />
          )}
        </div>

        {/* Right Panel: 340px desktop, scrollable */}
        <div className="w-full lg:w-[340px] shrink-0 h-auto lg:h-full rounded-2xl border border-border bg-surface flex flex-col p-4 gap-5 overflow-y-auto shadow-xs">
          {/* 1. TORQ Forecast Slider Card (if forecast insight exists) */}
          {mapData?.forecast && forecastHoursRange.length > 0 && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-muted flex items-center gap-1.5 font-bold">
                  <Sparkles className="size-3.5 text-primary" />
                  TORQ Forecast
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-primary text-on-primary">
                  {selectedForecastHour === null ? en.a06.now : `${selectedForecastHour}:00`}
                </span>
              </div>

              {/* Forecast Hour Picker */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <button
                  type="button"
                  onClick={() => setSelectedForecastHour(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                    selectedForecastHour === null
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface2 text-muted hover:text-fg'
                  }`}
                >
                  {en.a06.now}
                </button>
                {forecastHoursRange.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setSelectedForecastHour(h)}
                    className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer shrink-0 ${
                      selectedForecastHour === h
                        ? 'bg-primary text-on-primary font-bold'
                        : 'bg-surface2 text-muted hover:text-fg'
                    }`}
                  >
                    {h}:00
                  </button>
                ))}
              </div>

              {/* Forecast Note */}
              {selectedForecastHour !== null && (
                <p className="text-[11px] font-mono text-muted leading-relaxed">
                  {t('a06.forecast_note', { hour: `${selectedForecastHour}:00` })}
                </p>
              )}
            </div>
          )}

          {/* 2. Stand Detail (when a stand is clicked) */}
          {selectedStand && (
            <div className="p-4 rounded-xl border border-border bg-surface2/40 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
                    <MapPin className="size-3 text-primary" />
                    <span>Stand details</span>
                  </div>
                  <h4 className="font-display font-bold text-base text-fg lowercase">{selectedStand.name}</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedStandId(null)}
                  className="text-muted hover:text-fg p-1 rounded-md cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2 rounded-lg bg-surface border border-border flex flex-col">
                  <span className="text-muted text-[10px]">Free / Cap</span>
                  <span className="font-bold text-fg">
                    {selectedStand.free_bikes ?? 0} / {selectedStand.capacity ?? 8}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border flex flex-col">
                  <span className="text-muted text-[10px]">Maintenance</span>
                  <span className="font-bold text-warn">{selectedStand.maintenance_bikes ?? 0}</span>
                </div>
              </div>

              {/* Bikes list at stand */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border">
                <span className="text-[11px] font-mono text-muted">
                  Bikes present ({bikesAtSelectedStand.length}):
                </span>
                {bikesAtSelectedStand.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">No bikes at this stand.</p>
                ) : (
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto pr-1">
                    {bikesAtSelectedStand.map((bike: BikeRow) => (
                      <div
                        key={bike.id}
                        className="p-2 rounded-lg bg-surface border border-border flex items-center justify-between text-xs font-mono"
                      >
                        <span className="font-bold text-fg">{bike.short_code}</span>
                        <StatusPill status={bike.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => router.push('/stands')}
                className="w-full mt-1 rounded-full text-xs font-mono border-border bg-surface cursor-pointer"
              >
                <ExternalLink className="size-3 mr-1" />
                Manage in stands
              </Button>
            </div>
          )}

          {/* 3. Active Rides ("On the road ({n})") */}
          {layers.activeRides && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-display font-bold text-sm text-fg lowercase flex items-center gap-1.5">
                  <BikeIcon className="size-4 text-primary" />
                  {t('a06.rides_title', { n: mapData?.activeRides?.length ?? 0 })}
                </h4>
                <span className="text-[11px] font-mono text-muted">live</span>
              </div>

              {!mapData?.activeRides || mapData.activeRides.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border text-center text-xs font-mono text-muted">
                  No bikes on the road right now.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {mapData.activeRides.map((ride: ActiveRideRow) => {
                    const elapsed = getElapsedMinutes(ride.started_at, nowTick);
                    const isOverdue = Boolean(ride.is_overdue);

                    return (
                      <Link
                        key={ride.id}
                        href={`/rides?ride=${ride.id}`}
                        className={`p-3 rounded-xl border text-xs font-mono transition-colors block ${
                          isOverdue
                            ? 'bg-bad/10 border-bad/30 hover:bg-bad/15'
                            : 'bg-surface2/50 border-border hover:bg-surface2'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-fg">{ride.bike_code}</span>
                            <span className="text-muted">·</span>
                            <span className="text-fg font-medium truncate max-w-[120px]">
                              {ride.rider_name || 'Rider'}
                            </span>
                          </div>

                          {isOverdue && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-bad text-white shrink-0">
                              OVERDUE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-muted text-[11px] mt-1.5">
                          <span className="truncate">from {ride.start_stand_name || 'Campus'}</span>
                          <span className="flex items-center gap-1 font-bold shrink-0">
                            <Clock className="size-3" />
                            {elapsed} min
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
