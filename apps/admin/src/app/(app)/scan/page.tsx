'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Bike as BikeIcon,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  ExternalLink,
  RotateCw,
  Wrench,
  Clock,
  X,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { StatusPill } from '@/components/common/StatusPill';
import { PhotoThumb } from '@/components/common/PhotoThumb';
import { RiderPassWeb, type PassState } from '@/components/pass/RiderPassWeb';
import { ForceReturnDialog } from '@/components/common/ForceReturnDialog';
import { QrScannerView } from '@/components/scan/QrScannerView';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import {
  scanPass,
  scanBike,
  standCheckSubmit,
  markBikeMissing,
  setBikeMaintenance,
  parseQr,
  normalizeCode,
  messageFor,
  toAppError,
  en,
  type ScanPassResult,
  type ScanBikeResult,
  type StandCheckResult,
} from '@campuscycle/shared';

// Distance calculation for closest stand auto-selection
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ScanPage() {
  const router = useRouter();
  const { college } = useCollege();
  const db = supabase;

  // Active tab state
  const [activeTab, setActiveTab] = useState<'pass' | 'bike' | 'stand'>('pass');

  // Stands data
  const [stands, setStands] = useState<{ id: string; name: string; lat: number; lng: number }[]>([]);
  const [standsLoading, setStandsLoading] = useState<boolean>(true);

  // Tab 1: Pass state
  const [passResult, setPassResult] = useState<ScanPassResult | null>(null);
  const [passError, setPassError] = useState<string | null>(null);
  const [passLoading, setPassLoading] = useState<boolean>(false);

  // Tab 2: Bike state
  const [bikeResult, setBikeResult] = useState<ScanBikeResult | null>(null);
  const [bikeLoading, setBikeLoading] = useState<boolean>(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState<boolean>(false);

  // Tab 3: Stand check state
  const [standMode, setStandMode] = useState<'idle' | 'checking' | 'result'>('idle');
  const [selectedStandId, setSelectedStandId] = useState<string>('');
  const [scannedCodes, setScannedCodes] = useState<string[]>([]);
  const [standResult, setStandResult] = useState<StandCheckResult | null>(null);
  const [standSubmitLoading, setStandSubmitLoading] = useState<boolean>(false);
  const [missingBikeIds, setMissingBikeIds] = useState<Record<string, string>>({});
  const [markedMissingCodes, setMarkedMissingCodes] = useState<Record<string, boolean>>({});

  // Force Return Dialog state
  const [forceDialogOpen, setForceDialogOpen] = useState<boolean>(false);
  const [forceTarget, setForceTarget] = useState<{ rideId: string; bikeCode: string } | null>(null);

  // Load stands for college
  const loadStands = useCallback(async () => {
    if (!college) return;
    setStandsLoading(true);
    try {
      const { data, error } = await db
        .from('stands')
        .select('id, name, lat, lng')
        .eq('college_id', college.id)
        .eq('active', true)
        .order('name');

      if (!error && data) {
        setStands(data);
        if (data.length > 0 && !selectedStandId) {
          setSelectedStandId(data[0].id);
        }
      }
    } catch (err) {
      console.warn('Failed to load stands:', err);
    } finally {
      setStandsLoading(false);
    }
  }, [college, db, selectedStandId]);

  useEffect(() => {
    loadStands();
  }, [loadStands]);

  // Attempt browser geolocation to auto-select closest stand
  useEffect(() => {
    if (stands.length > 0 && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          let closestId = stands[0].id;
          let minDistance = Infinity;

          for (const s of stands) {
            const dist = haversineMeters(userLat, userLng, s.lat, s.lng);
            if (dist < minDistance) {
              minDistance = dist;
              closestId = s.id;
            }
          }

          setSelectedStandId(closestId);
        },
        () => {
          // Geolocation denied or unavailable; defaults to stands[0]
        },
        { enableHighAccuracy: false, timeout: 5000 },
      );
    }
  }, [stands]);

  // -------------------------------------------------------------
  // TAB 1: PASS SCAN LOGIC
  // -------------------------------------------------------------
  const handlePassDecode = async (raw: string) => {
    setPassError(null);

    // Validate QR format
    const parsed = parseQr(raw);
    if (parsed.kind === 'bike') {
      toast.error(en.a05.not_pass);
      return;
    }

    setPassLoading(true);
    try {
      const result = await scanPass(db, raw);
      setPassResult(result);
    } catch (err) {
      const appErr = toAppError(err);
      if (appErr.code === 'CC_PASS_QR_EXPIRED') {
        setPassError(en.errors.CC_PASS_QR_EXPIRED);
      } else {
        toast.error(messageFor(appErr.code, appErr.data));
      }
    } finally {
      setPassLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: BIKE SCAN LOGIC
  // -------------------------------------------------------------
  const handleBikeDecode = async (raw: string) => {
    const parsed = parseQr(raw);
    if (parsed.kind === 'pass') {
      toast.error("That's a pass QR. Switch to the Pass tab.");
      return;
    }

    let payload = raw;
    if (parsed.kind === 'bike') {
      payload = raw;
    } else {
      const normalized = normalizeCode(raw);
      if (normalized) {
        payload = `campuscycle://b/${normalized}?s=`;
      }
    }

    setBikeLoading(true);
    try {
      const result = await scanBike(db, payload);
      setBikeResult(result);
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setBikeLoading(false);
    }
  };

  const handleToggleMaintenance = async () => {
    if (!bikeResult) return;
    const isCurrentlyMaint = bikeResult.bike.status === 'maintenance';
    setMaintenanceLoading(true);

    try {
      await setBikeMaintenance(
        db,
        bikeResult.bike.id,
        !isCurrentlyMaint,
        isCurrentlyMaint ? 'Cleared by admin scan' : 'Flagged for maintenance by admin scan',
      );
      toast.success(
        isCurrentlyMaint
          ? `Bike ${bikeResult.bike.code} returned to service`
          : `Bike ${bikeResult.bike.code} moved to maintenance`,
      );
      // Refresh bike scan details
      const refreshed = await scanBike(db, bikeResult.bike.code);
      setBikeResult(refreshed);
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 3: STAND CHECK LOGIC
  // -------------------------------------------------------------
  const handleStandBikeScan = (raw: string) => {
    const parsed = parseQr(raw);
    if (parsed.kind === 'pass') {
      toast.error(en.a05.not_pass);
      return;
    }

    let code: string | null = null;
    if (parsed.kind === 'bike') {
      code = parsed.code;
    } else {
      code = normalizeCode(raw);
    }

    if (!code) {
      toast.error('Invalid bike code or QR');
      return;
    }

    code = code.toUpperCase();
    if (!scannedCodes.includes(code)) {
      setScannedCodes((prev) => [...prev, code]);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(30);
      }
      toast.success(`Scanned ${code}`);
    } else {
      toast.info(`${code} already scanned`);
    }
  };

  const removeScannedCode = (code: string) => {
    setScannedCodes((prev) => prev.filter((c) => c !== code));
  };

  const handleStartStandCheck = () => {
    if (!selectedStandId) {
      toast.error('Please select a stand first');
      return;
    }
    setScannedCodes([]);
    setStandResult(null);
    setMarkedMissingCodes({});
    setStandMode('checking');
  };

  const handleFinishStandCheck = async () => {
    if (!selectedStandId) return;

    setStandSubmitLoading(true);
    try {
      const result = await standCheckSubmit(db, selectedStandId, scannedCodes);
      setStandResult(result);
      setStandMode('result');

      // Query bike IDs for missing bikes to enable "Mark missing"
      if (result.missing && result.missing.length > 0 && college) {
        const missingCodesList = result.missing.map((m) => m.code);
        const { data: missingRows } = await db
          .from('bikes')
          .select('id, short_code')
          .eq('college_id', college.id)
          .in('short_code', missingCodesList);

        if (missingRows) {
          const map: Record<string, string> = {};
          for (const row of missingRows) {
            map[row.short_code] = row.id;
          }
          setMissingBikeIds(map);
        }
      }
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setStandSubmitLoading(false);
    }
  };

  const handleMarkMissing = async (code: string) => {
    const bikeId = missingBikeIds[code];
    if (!bikeId) {
      toast.error('Could not locate bike record');
      return;
    }

    const currentStandName = stands.find((s) => s.id === selectedStandId)?.name || 'stand';
    try {
      await markBikeMissing(db, bikeId, `Not found in stand check at ${currentStandName}`);
      toast.success(`Bike ${code} marked missing`);
      setMarkedMissingCodes((prev) => ({ ...prev, [code]: true }));
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    }
  };

  // Stand name helper
  const selectedStandName = useMemo(() => {
    return stands.find((s) => s.id === selectedStandId)?.name || 'Selected Stand';
  }, [stands, selectedStandId]);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full pb-16">
      {/* Page Header */}
      <PageHeader
        title={en.a05.title}
        actions={
          <div className="flex items-center gap-2 font-mono text-xs text-muted">
            <span className="size-2 rounded-full bg-ok" />
            <span>mobile ready</span>
          </div>
        }
      />

      {/* Tabs navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as 'pass' | 'bike' | 'stand');
          setPassError(null);
        }}
        className="w-full"
      >
        <TabsList className="grid grid-cols-3 w-full bg-surface border border-border h-11 p-1 rounded-full">
          <TabsTrigger
            value="pass"
            className="rounded-full text-xs font-mono font-medium data-[state=active]:bg-primary data-[state=active]:text-on-primary transition-all cursor-pointer"
          >
            {en.a05.tab_pass}
          </TabsTrigger>
          <TabsTrigger
            value="bike"
            className="rounded-full text-xs font-mono font-medium data-[state=active]:bg-primary data-[state=active]:text-on-primary transition-all cursor-pointer"
          >
            {en.a05.tab_bike}
          </TabsTrigger>
          <TabsTrigger
            value="stand"
            className="rounded-full text-xs font-mono font-medium data-[state=active]:bg-primary data-[state=active]:text-on-primary transition-all cursor-pointer"
          >
            {en.a05.tab_check}
          </TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------------- */}
        {/* TAB 1: PASS */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="pass" className="flex flex-col items-center gap-6 mt-6">
          {passError && (
            <div className="w-full p-4 rounded-xl bg-bad/10 border border-bad/30 flex items-center gap-3 text-bad text-xs font-mono">
              <AlertTriangle className="size-4 shrink-0" />
              <p className="flex-1">{passError}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPassError(null)}
                className="h-7 text-xs text-bad hover:bg-bad/20 rounded-md cursor-pointer"
              >
                Dismiss
              </Button>
            </div>
          )}

          {!passResult ? (
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-xs font-mono text-muted text-center max-w-sm">
                Point camera at the rider's digital pass QR, or paste the signed payload below.
              </p>
              <QrScannerView
                onDecode={handlePassDecode}
                active={activeTab === 'pass'}
                manualPlaceholder="campuscycle://p/... or scan URL"
              />
              {passLoading && (
                <div className="flex items-center gap-2 text-xs font-mono text-muted animate-pulse">
                  <RotateCw className="size-3.5 animate-spin" />
                  Verifying pass credentials...
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center gap-6">
              {/* Pass Card Component Mini */}
              <div className="w-full max-w-[280px]">
                <RiderPassWeb
                  holderName={passResult.holder.name}
                  collegeName={college?.name || 'Campus'}
                  passLabel={passResult.holder.pass_label}
                  state={passResult.holder.pass_status as PassState}
                  bikeCode={passResult.bike?.code}
                  strikes={passResult.holder.strikes}
                  tiltOnHover={true}
                  interactiveFlip={true}
                />
              </div>

              {/* Rider and Active Bike Details Card */}
              <div className="w-full p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-display font-bold text-lg text-fg lowercase">
                      {passResult.holder.name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-muted">
                      <span>Roll: {passResult.holder.roll_number}</span>
                      <span>·</span>
                      <span>{passResult.holder.pass_label}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={passResult.holder.status} />
                    {passResult.holder.strikes > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-bad/10 text-bad border border-bad/30">
                        {passResult.holder.strikes} {passResult.holder.strikes === 1 ? 'strike' : 'strikes'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono text-muted bg-surface2 border border-border">
                        0 strikes
                      </span>
                    )}
                  </div>
                </div>

                {/* ID Photo Thumbnail if available */}
                {passResult.holder.id_photo_path && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface2/60 border border-border">
                    <PhotoThumb
                      bucket="id-cards"
                      path={passResult.holder.id_photo_path}
                      width={80}
                      height={50}
                      alt={passResult.holder.name}
                      className="rounded-md shrink-0"
                    />
                    <div className="flex flex-col text-xs font-mono">
                      <span className="text-fg font-medium">Student ID Photo</span>
                      <span className="text-muted text-[11px]">Recorded at registration</span>
                    </div>
                  </div>
                )}

                {/* Bike on pass section */}
                {passResult.bike ? (
                  <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase tracking-wider text-muted">
                        Currently borrowed bike
                      </span>
                      {passResult.bike.is_overdue && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-bad text-white">
                          OVERDUE
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono font-bold text-2xl text-fg">{passResult.bike.code}</span>
                      <span className="text-xs font-mono text-muted">
                        since {format(new Date(passResult.bike.since), 'h:mm a')}
                        {passResult.bike.from_stand ? ` from ${passResult.bike.from_stand}` : ''}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-muted flex items-center gap-1.5">
                      <Clock className="size-3.5" />
                      <span>Due at {format(new Date(passResult.bike.due_at), 'h:mm a')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs font-mono text-muted">
                    No bike currently docked on this pass.
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(`/users/${passResult.holder.user_id}`)}
                    className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                  >
                    <ExternalLink className="size-3.5 mr-1" />
                    Open profile
                  </Button>

                  {passResult.bike && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setForceTarget({
                          rideId: passResult.bike!.ride_id,
                          bikeCode: passResult.bike!.code,
                        });
                        setForceDialogOpen(true);
                      }}
                      className="rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer"
                    >
                      {en.a07.force}
                    </Button>
                  )}

                  <Button
                    type="button"
                    onClick={() => {
                      setPassResult(null);
                      setPassError(null);
                    }}
                    className="ml-auto rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                  >
                    Scan another
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 2: BIKE */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="bike" className="flex flex-col items-center gap-6 mt-6">
          {!bikeResult ? (
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-xs font-mono text-muted text-center max-w-sm">
                Scan bike QR sticker or type code (e.g. K-042) to inspect fleet status.
              </p>
              <QrScannerView
                onDecode={handleBikeDecode}
                active={activeTab === 'bike'}
                manualPlaceholder="Type bike code e.g. K-042"
              />
              {bikeLoading && (
                <div className="flex items-center gap-2 text-xs font-mono text-muted animate-pulse">
                  <RotateCw className="size-3.5 animate-spin" />
                  Looking up bike status...
                </div>
              )}
            </div>
          ) : (
            <div className="w-full p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-2xl text-fg">{bikeResult.bike.code}</span>
                    {bikeResult.signed ? (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-ok/10 text-ok border border-ok/30 flex items-center gap-1">
                        <ShieldCheck className="size-3" />
                        VERIFIED QR
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-surface2 text-muted border border-border flex items-center gap-1">
                        <ShieldAlert className="size-3" />
                        MANUAL
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-mono text-muted">
                    {bikeResult.holder
                      ? `On pass ${bikeResult.holder.pass_label} (${bikeResult.holder.name})`
                      : `Stand: ${bikeResult.bike.stand_name || 'Unassigned'}`}
                  </span>
                </div>
                <StatusPill status={bikeResult.bike.status} />
              </div>

              {/* Status details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono p-4 rounded-xl bg-surface2/40 border border-border">
                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Last seen</span>
                  <span className="text-fg font-medium">
                    {bikeResult.bike.last_seen_at
                      ? format(new Date(bikeResult.bike.last_seen_at), 'd MMM yyyy, h:mm a')
                      : 'Never'}
                  </span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="text-muted">Current location</span>
                  <span className="text-fg font-medium">
                    {bikeResult.holder ? 'On the road' : bikeResult.bike.stand_name || '—'}
                  </span>
                </div>

                {bikeResult.bike.ai_flag && (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <span className="text-muted">AI Flag</span>
                    <span className="px-2 py-0.5 rounded-md bg-warn/15 text-warn border border-warn/30 self-start text-[11px]">
                      {bikeResult.bike.ai_flag}
                    </span>
                  </div>
                )}

                {bikeResult.bike.notes && (
                  <div className="flex flex-col gap-0.5 sm:col-span-2">
                    <span className="text-muted">Notes</span>
                    <span className="text-fg">{bikeResult.bike.notes}</span>
                  </div>
                )}
              </div>

              {/* Holder Card if currently borrowed */}
              {bikeResult.holder && (
                <div className="p-4 rounded-xl border border-primary/40 bg-primary/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-muted">
                      Current Rider
                    </span>
                    {bikeResult.holder.is_overdue && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-bad text-white">
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display font-bold text-base text-fg">{bikeResult.holder.name}</span>
                    <span className="font-mono text-xs text-muted">{bikeResult.holder.pass_label}</span>
                  </div>
                  <div className="text-xs font-mono text-muted">
                    Borrowed since {format(new Date(bikeResult.holder.since), 'h:mm a')}
                    {bikeResult.holder.from_stand ? ` from ${bikeResult.holder.from_stand}` : ''}
                    {' · '}
                    Due at {format(new Date(bikeResult.holder.due_at), 'h:mm a')}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push(`/bikes?search=${bikeResult.bike.code}`)}
                  className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                >
                  <ExternalLink className="size-3.5 mr-1" />
                  Open bike
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={maintenanceLoading}
                  onClick={handleToggleMaintenance}
                  className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                >
                  <Wrench className="size-3.5 mr-1" />
                  {bikeResult.bike.status === 'maintenance' ? 'Exit maintenance' : 'Put in maintenance'}
                </Button>

                {bikeResult.holder && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForceTarget({
                        rideId: bikeResult.holder!.ride_id,
                        bikeCode: bikeResult.bike.code,
                      });
                      setForceDialogOpen(true);
                    }}
                    className="rounded-full text-xs font-mono border-bad text-bad hover:bg-bad/10 cursor-pointer"
                  >
                    {en.a07.force}
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={() => setBikeResult(null)}
                  className="ml-auto rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer"
                >
                  Scan another
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ------------------------------------------------------------- */}
        {/* TAB 3: STAND CHECK */}
        {/* ------------------------------------------------------------- */}
        <TabsContent value="stand" className="flex flex-col items-center gap-6 mt-6">
          {standMode === 'idle' && (
            <div className="w-full p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-6">
              <div className="flex flex-col gap-1.5">
                <h3 className="font-display font-bold text-lg text-fg lowercase">audit a stand</h3>
                <p className="text-xs font-mono text-muted leading-relaxed">
                  Select a stand to verify parked bikes against database records. Continuous scanning will
                  record every bike present.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label
                  htmlFor="stand-select"
                  className="text-xs font-mono text-muted flex items-center gap-1.5"
                >
                  <MapPin className="size-3.5 text-primary" />
                  Target campus stand
                </Label>
                <Select
                  value={selectedStandId}
                  onValueChange={(val) => setSelectedStandId(val || '')}
                  disabled={standsLoading || stands.length === 0}
                >
                  <SelectTrigger
                    id="stand-select"
                    className="bg-surface2/60 border-border text-xs font-mono h-11"
                  >
                    <SelectValue placeholder={standsLoading ? 'Loading stands...' : 'Select stand'} />
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

              <Button
                type="button"
                onClick={handleStartStandCheck}
                disabled={!selectedStandId || standsLoading}
                className="h-11 rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer w-full"
              >
                {en.a05.start}
              </Button>
            </div>
          )}

          {standMode === 'checking' && (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-full p-4 rounded-xl bg-surface border border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="font-mono font-bold text-xs text-fg">{selectedStandName}</span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-primary text-on-primary">
                  {scannedCodes.length} {scannedCodes.length === 1 ? 'bike' : 'bikes'} scanned
                </span>
              </div>

              {/* Continuous Scanner View */}
              <QrScannerView
                onDecode={handleStandBikeScan}
                active={standMode === 'checking'}
                manualPlaceholder="Type bike code e.g. K-042"
              />

              {/* Scanned chips list */}
              <div className="w-full flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono text-muted">
                  <span>Scanned at this stand:</span>
                  <span>{scannedCodes.length} total</span>
                </div>
                {scannedCodes.length === 0 ? (
                  <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs font-mono text-muted">
                    No bikes scanned yet. Scan codes continuously.
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-surface border border-border max-h-40 overflow-y-auto">
                    {scannedCodes.map((code) => (
                      <span
                        key={code}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-surface2 text-fg border border-border"
                      >
                        {code}
                        <button
                          type="button"
                          onClick={() => removeScannedCode(code)}
                          className="hover:text-bad cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Finish Check Button */}
              <div className="w-full flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStandMode('idle')}
                  className="rounded-full text-xs font-mono border-border bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleFinishStandCheck}
                  disabled={standSubmitLoading}
                  className="flex-1 rounded-full text-xs font-mono font-bold bg-primary text-on-primary hover:opacity-90 cursor-pointer h-11"
                >
                  {standSubmitLoading ? 'Submitting...' : en.a05.finish}
                </Button>
              </div>
            </div>
          )}

          {standMode === 'result' && standResult && (
            <div className="w-full p-6 rounded-card border border-border bg-surface shadow-xs flex flex-col gap-6">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex flex-col gap-0.5">
                  <h3 className="font-display font-bold text-lg text-fg lowercase">
                    audit complete · {standResult.stand}
                  </h3>
                  <span className="text-xs font-mono text-muted">
                    {standResult.seen.length} seen · {standResult.missing.length} missing ·{' '}
                    {standResult.unexpected.length} unexpected
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStandResult(null);
                    setScannedCodes([]);
                    setStandMode('idle');
                  }}
                  className="rounded-full text-xs font-mono border-border bg-surface hover:bg-surface2 cursor-pointer"
                >
                  New check
                </Button>
              </div>

              {/* 1. SEEN LIST */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-ok">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="size-4" />
                    {en.a05.seen} ({standResult.seen.length})
                  </span>
                  <span className="text-[11px] text-muted font-normal">Present as expected</span>
                </div>
                {standResult.seen.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">No expected bikes verified.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {standResult.seen.map((code) => (
                      <span
                        key={code}
                        className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-ok/10 text-ok border border-ok/30"
                      >
                        {code}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. MISSING LIST */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-bad">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="size-4" />
                    {en.a05.missing} ({standResult.missing.length})
                  </span>
                  <span className="text-[11px] text-muted font-normal">Expected here but not scanned</span>
                </div>
                {standResult.missing.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">Zero bikes missing.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {standResult.missing.map((item) => {
                      const isMarked = markedMissingCodes[item.code];
                      return (
                        <div
                          key={item.code}
                          className="p-3 rounded-xl bg-surface2/50 border border-border flex items-center justify-between gap-3 text-xs font-mono"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-fg">{item.code}</span>
                            <span className="text-muted text-[11px]">
                              Last seen:{' '}
                              {item.last_seen_at
                                ? format(new Date(item.last_seen_at), 'd MMM, h:mm a')
                                : 'Never'}
                            </span>
                          </div>

                          {isMarked ? (
                            <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-bad/10 text-bad border border-bad/30">
                              Marked missing
                            </span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleMarkMissing(item.code)}
                              className="rounded-full text-xs font-mono font-bold bg-bad text-white hover:bg-bad/90 cursor-pointer h-8 px-3"
                            >
                              {en.a05.mark_missing}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. UNEXPECTED LIST */}
              <div className="flex flex-col gap-2.5 pt-4 border-t border-border">
                <div className="flex items-center justify-between text-xs font-mono font-bold text-warn">
                  <span className="flex items-center gap-1.5">
                    <BikeIcon className="size-4" />
                    {en.a05.unexpected} ({standResult.unexpected.length})
                  </span>
                  <span className="text-[11px] text-muted font-normal">Relocated to this stand</span>
                </div>
                {standResult.unexpected.length === 0 ? (
                  <p className="text-xs font-mono text-muted italic">No unexpected bikes found.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {standResult.unexpected.map((item) => (
                      <div
                        key={item.code}
                        className="p-3 rounded-xl bg-surface2/50 border border-border flex items-center justify-between gap-3 text-xs font-mono"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-fg">{item.code}</span>
                          <span className="text-muted text-[11px]">
                            Recorded at: {item.recorded_stand || 'No stand recorded'}
                          </span>
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Force Return Dialog Modal */}
      {forceTarget && (
        <ForceReturnDialog
          open={forceDialogOpen}
          onOpenChange={(open) => {
            setForceDialogOpen(open);
            if (!open) setForceTarget(null);
          }}
          rideId={forceTarget.rideId}
          bikeCode={forceTarget.bikeCode}
          stands={stands}
          defaultStandId={selectedStandId}
          onSuccess={() => {
            // Clear current scan cards to force refresh
            setPassResult(null);
            setBikeResult(null);
          }}
        />
      )}
    </div>
  );
}
