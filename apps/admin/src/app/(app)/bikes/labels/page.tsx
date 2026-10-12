'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import QRCode from 'qrcode';
import { Printer, ChevronLeft, CheckSquare, Square, Search, Filter, Layers, Loader2 } from 'lucide-react';

import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { bikeQrPayloads, en } from '@campuscycle/shared';

const MAX_LABELS_PER_SHEET = 21; // 3 cols x 7 rows (Avery L7160)

interface BikeItem {
  id: string;
  short_code: string;
  current_stand_id: string | null;
  status: string;
}

interface StandItem {
  id: string;
  name: string;
}

interface QrItem {
  bike_id: string;
  short_code: string;
  payload: string;
  qrUrl?: string;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function QrLabelsContent() {
  const searchParams = useSearchParams();
  const { college } = useCollege();
  const rawIds = searchParams.get('ids');

  const [standFilter, setStandFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [generatingQr, setGeneratingQr] = useState(false);

  // 1. Fetch all non-retired bikes for the college
  const { data: bikes = [], isLoading: bikesLoading } = useQuery({
    queryKey: ['admin-labels-bikes', college?.id],
    queryFn: async (): Promise<BikeItem[]> => {
      if (!college?.id) return [];
      const { data, error } = await supabase
        .from('bikes')
        .select('id, short_code, current_stand_id, status')
        .eq('college_id', college.id)
        .neq('status', 'retired')
        .order('short_code', { ascending: true });
      if (error) throw error;
      return (data ?? []) as BikeItem[];
    },
    enabled: !!college?.id,
  });

  // 2. Fetch stands for filter
  const { data: stands = [] } = useQuery({
    queryKey: ['admin-labels-stands', college?.id],
    queryFn: async (): Promise<StandItem[]> => {
      if (!college?.id) return [];
      const { data, error } = await supabase
        .from('stands')
        .select('id, name')
        .eq('college_id', college.id)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as StandItem[];
    },
    enabled: !!college?.id,
  });

  // 3. Initialize selected IDs based on query params or default all
  useEffect(() => {
    if (bikes.length === 0) return;

    if (rawIds) {
      const parsedIds = rawIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const validIds = new Set<string>();
      const bikeMap = new Set(bikes.map((b) => b.id));
      for (const id of parsedIds) {
        if (bikeMap.has(id)) {
          validIds.add(id);
        }
      }
      setSelectedIds(validIds);
    } else {
      // Default select all up to 210 bikes (10 sheets max)
      const initial = new Set(bikes.slice(0, 210).map((b) => b.id));
      setSelectedIds(initial);
    }
  }, [bikes, rawIds]);

  // Stand lookup
  const standMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of stands) {
      map.set(s.id, s.name);
    }
    return map;
  }, [stands]);

  // Filter bikes by stand
  const visibleBikes = useMemo(() => {
    if (standFilter === 'all') return bikes;
    return bikes.filter((b) => b.current_stand_id === standFilter);
  }, [bikes, standFilter]);

  // Bikes that are both visible and selected
  const activeSelectedBikes = useMemo(() => {
    return visibleBikes.filter((b) => selectedIds.has(b.id));
  }, [visibleBikes, selectedIds]);

  // 4. Fetch QR payloads for active selected bikes
  const selectedBikeIdsArray = useMemo(() => {
    return activeSelectedBikes.map((b) => b.id);
  }, [activeSelectedBikes]);

  const { data: rawPayloads = [], isLoading: payloadsLoading } = useQuery({
    queryKey: ['admin-labels-payloads', college?.id, selectedBikeIdsArray.sort().join(',')],
    queryFn: async () => {
      if (!selectedBikeIdsArray.length) return [];
      const results = await bikeQrPayloads(supabase, selectedBikeIdsArray);
      return results as Array<{ bike_id: string; payload: string; short_code: string }>;
    },
    enabled: selectedBikeIdsArray.length > 0,
  });

  // 5. Generate QR Data URLs from payloads
  useEffect(() => {
    let cancelled = false;

    async function generateQrs() {
      if (rawPayloads.length === 0) return;
      setGeneratingQr(true);

      const newQrMap: Record<string, string> = { ...qrMap };
      let changed = false;

      for (const item of rawPayloads) {
        if (!newQrMap[item.bike_id] && item.payload) {
          try {
            const dataUrl = await QRCode.toDataURL(item.payload, {
              errorCorrectionLevel: 'M',
              margin: 1,
              width: 300,
            });
            newQrMap[item.bike_id] = dataUrl;
            changed = true;
          } catch (err) {
            console.error('Failed to generate QR for bike', item.short_code, err);
          }
        }
      }

      if (!cancelled) {
        if (changed) {
          setQrMap(newQrMap);
        }
        setGeneratingQr(false);
      }
    }

    generateQrs();

    return () => {
      cancelled = true;
    };
  }, [rawPayloads, qrMap]);

  // Prepare printable label items
  const labelItems: QrItem[] = useMemo(() => {
    const payloadMap = new Map<string, string>();
    for (const p of rawPayloads) {
      payloadMap.set(p.bike_id, p.payload);
    }

    return activeSelectedBikes.map((bike) => ({
      bike_id: bike.id,
      short_code: bike.short_code,
      payload: payloadMap.get(bike.id) ?? '',
      qrUrl: qrMap[bike.id],
    }));
  }, [activeSelectedBikes, rawPayloads, qrMap]);

  // Chunk into 21-label sheets
  const pages = useMemo(() => {
    return chunkArray(labelItems, MAX_LABELS_PER_SHEET);
  }, [labelItems]);

  // Select all / deselect all for current stand filter
  const allVisibleSelected = visibleBikes.length > 0 && visibleBikes.every((b) => selectedIds.has(b.id));

  const toggleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      for (const b of visibleBikes) {
        next.delete(b.id);
      }
    } else {
      for (const b of visibleBikes) {
        next.add(b.id);
      }
    }
    setSelectedIds(next);
  };

  const toggleBikeSelected = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Picker filtered bikes
  const pickerFilteredBikes = useMemo(() => {
    const query = pickerSearch.trim().toLowerCase();
    if (!query) return bikes;
    return bikes.filter(
      (b) =>
        b.short_code.toLowerCase().includes(query) ||
        (b.current_stand_id && standMap.get(b.current_stand_id)?.toLowerCase().includes(query)),
    );
  }, [bikes, pickerSearch, standMap]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      {/* Print CSS styles */}
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html,
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .label-sheet {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
          }
          .label-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }
          .bike-label {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Screen toolbar and controls */}
      <div className="no-print space-y-6 mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-muted mb-2">
          <Link
            href="/bikes"
            className="flex items-center gap-1 hover:text-fg transition-colors hover:underline"
          >
            <ChevronLeft className="size-3.5" />
            Back to bikes
          </Link>
        </div>

        <PageHeader
          kicker={college?.short_code}
          title={en.a09.title}
          lede={en.a09.lede}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPickerOpen(true)}
                className="h-10 px-4 rounded-full border-border bg-surface text-xs font-mono cursor-pointer hover:bg-surface2"
              >
                <Layers className="size-4 mr-1.5" />
                {en.a09.pick} ({selectedIds.size})
              </Button>

              <Button
                size="sm"
                onClick={handlePrint}
                disabled={labelItems.length === 0}
                className="h-10 px-5 rounded-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer shadow-md disabled:opacity-50"
              >
                <Printer className="size-4 mr-2" />
                {en.a09.print}
              </Button>
            </div>
          }
        />

        {/* Toolbar filters and counts */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
          <div className="flex flex-wrap items-center gap-3">
            {/* Stand filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted flex items-center gap-1">
                <Filter className="size-3.5" />
                Stand:
              </span>
              <Select value={standFilter} onValueChange={(val) => setStandFilter(val ?? 'all')}>
                <SelectTrigger className="w-[180px] h-9 text-xs font-mono bg-surface2 border-border">
                  <SelectValue placeholder="All stands" />
                </SelectTrigger>
                <SelectContent className="bg-surface border-border">
                  <SelectItem value="all" className="text-xs font-mono">
                    All stands ({bikes.length})
                  </SelectItem>
                  {stands.map((s) => {
                    const count = bikes.filter((b) => b.current_stand_id === s.id).length;
                    return (
                      <SelectItem key={s.id} value={s.id} className="text-xs font-mono">
                        {s.name} ({count})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Select all toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSelectAllVisible}
              className="h-9 px-3 text-xs font-mono text-muted hover:text-fg cursor-pointer"
            >
              {allVisibleSelected ? (
                <>
                  <CheckSquare className="size-3.5 mr-1.5 text-primary" />
                  Deselect all visible
                </>
              ) : (
                <>
                  <Square className="size-3.5 mr-1.5" />
                  Select all visible
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {(bikesLoading || payloadsLoading || generatingQr) && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-muted animate-pulse">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                Preparing labels...
              </div>
            )}
            <div className="text-xs font-mono text-muted">
              <span className="font-bold text-fg">{labelItems.length}</span> labels ·{' '}
              <span className="font-bold text-fg">{pages.length || 1}</span>{' '}
              {pages.length === 1 ? 'A4 sheet' : 'A4 sheets'}
            </div>
          </div>
        </div>
      </div>

      {/* Sheet Preview Container */}
      <div className="overflow-x-auto pb-12 flex flex-col items-center gap-10 print:overflow-visible print:pb-0 print:gap-0">
        {pages.length === 0 ? (
          <div className="no-print p-16 text-center rounded-2xl border border-dashed border-border bg-surface w-full max-w-xl">
            <Layers className="size-10 text-muted mx-auto mb-3 opacity-60" />
            <h3 className="font-display font-bold text-base text-fg mb-1">No bikes selected</h3>
            <p className="text-xs font-mono text-muted mb-4">
              Select bikes using the stand filter or click &ldquo;Pick bikes&rdquo; to choose labels.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStandFilter('all');
                setSelectedIds(new Set(bikes.map((b) => b.id)));
              }}
              className="font-mono text-xs cursor-pointer"
            >
              Select all bikes
            </Button>
          </div>
        ) : (
          pages.map((pageItems, pageIdx) => {
            // Fill page up to 21 slots so physical sticker grid stays aligned
            const slots: (QrItem | null)[] = [...pageItems];
            while (slots.length < MAX_LABELS_PER_SHEET) {
              slots.push(null);
            }

            return (
              <div
                key={`page-${pageIdx}`}
                className="label-sheet bg-white text-black shadow-2xl ring-1 ring-black/10 print:shadow-none print:ring-0"
                style={{
                  width: '210mm',
                  height: '297mm',
                  minHeight: '297mm',
                  maxHeight: '297mm',
                  paddingTop: '15.1mm',
                  paddingBottom: '15.1mm',
                  paddingLeft: '7.2mm',
                  paddingRight: '7.2mm',
                  boxSizing: 'border-box',
                }}
              >
                {/* 3 columns x 7 rows grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '63.5mm 63.5mm 63.5mm',
                    gridTemplateRows: 'repeat(7, 38.1mm)',
                    columnGap: '2.5mm',
                    rowGap: '0mm',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  {slots.map((item, slotIdx) => {
                    if (!item) {
                      // Blank slot to maintain grid positioning
                      return (
                        <div
                          key={`empty-${slotIdx}`}
                          style={{
                            width: '63.5mm',
                            height: '38.1mm',
                            boxSizing: 'border-box',
                          }}
                        />
                      );
                    }

                    return (
                      <div
                        key={item.bike_id}
                        className="bike-label border border-dashed border-gray-200 print:border-none"
                        style={{
                          width: '63.5mm',
                          height: '38.1mm',
                          boxSizing: 'border-box',
                          padding: '3mm',
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#ffffff',
                          color: '#000000',
                          overflow: 'hidden',
                        }}
                      >
                        {/* QR on the left: 26mm square */}
                        <div
                          style={{
                            width: '26mm',
                            height: '26mm',
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#ffffff',
                          }}
                        >
                          {item.qrUrl ? (
                            <img
                              src={item.qrUrl}
                              alt={item.short_code}
                              style={{
                                width: '26mm',
                                height: '26mm',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <div className="w-[26mm] h-[26mm] border border-gray-300 flex items-center justify-center font-mono text-[8px] text-gray-400">
                              QR
                            </div>
                          )}
                        </div>

                        {/* Text info on the right */}
                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            paddingLeft: '3mm',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            height: '28mm',
                            boxSizing: 'border-box',
                          }}
                        >
                          {/* Small wordmark */}
                          <div
                            style={{
                              fontFamily: 'var(--font-archivo), sans-serif',
                              fontWeight: 900,
                              fontSize: '8.5pt',
                              lineHeight: 1,
                              letterSpacing: '-0.02em',
                              color: '#000000',
                              textTransform: 'lowercase',
                            }}
                          >
                            campus
                            <span
                              style={{
                                fontFamily: 'var(--font-fraunces), serif',
                                fontStyle: 'italic',
                                fontWeight: 400,
                                fontSize: '1.1em',
                                marginLeft: '-0.05em',
                                color: '#000000',
                              }}
                            >
                              cycle
                            </span>
                          </div>

                          {/* Code in Archivo Expanded Black 20 pt */}
                          <div
                            style={{
                              fontFamily: 'var(--font-archivo), sans-serif',
                              fontWeight: 900,
                              fontSize: '20pt',
                              lineHeight: 1,
                              letterSpacing: '-0.03em',
                              color: '#000000',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.short_code}
                          </div>

                          {/* "scan to borrow" in Martian Mono 7 pt */}
                          <div
                            style={{
                              fontFamily: 'var(--font-martian), monospace',
                              fontSize: '7pt',
                              lineHeight: 1,
                              color: '#000000',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {en.a09.scan_to_borrow}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pick Bikes Dialog */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-lg bg-surface border-border text-fg">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg">{en.a09.pick}</DialogTitle>
            <DialogDescription className="text-xs font-mono text-muted">
              Choose which bikes to include on the print sheet. Currently {selectedIds.size} selected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="relative">
              <Search className="size-4 absolute left-3 top-2.5 text-muted" />
              <Input
                placeholder="Search bike code or stand..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="pl-9 text-xs font-mono bg-surface2 border-border"
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-muted px-1">
              <span>{pickerFilteredBikes.length} bikes</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedIds);
                    for (const b of pickerFilteredBikes) next.add(b.id);
                    setSelectedIds(next);
                  }}
                  className="hover:text-fg underline cursor-pointer"
                >
                  Select all visible
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = new Set(selectedIds);
                    for (const b of pickerFilteredBikes) next.delete(b.id);
                    setSelectedIds(next);
                  }}
                  className="hover:text-fg underline cursor-pointer"
                >
                  Clear visible
                </button>
              </div>
            </div>

            <div className="max-h-[360px] overflow-y-auto space-y-1 pr-1 border border-border rounded-lg p-2 bg-surface2/50">
              {pickerFilteredBikes.map((bike) => {
                const checked = selectedIds.has(bike.id);
                const standName = bike.current_stand_id ? standMap.get(bike.current_stand_id) : 'Floating';
                return (
                  <label
                    key={bike.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-surface2 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={checked} onCheckedChange={() => toggleBikeSelected(bike.id)} />
                      <span className="font-mono font-bold text-xs text-fg">{bike.short_code}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted truncate max-w-[160px]">
                      {standName}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs font-mono text-muted hover:text-bad"
            >
              Clear all
            </Button>
            <Button
              size="sm"
              onClick={() => setPickerOpen(false)}
              className="font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90"
            >
              Done ({selectedIds.size} selected)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function QrLabelsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 font-mono text-xs text-muted flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          Loading QR labels...
        </div>
      }
    >
      <QrLabelsContent />
    </Suspense>
  );
}
