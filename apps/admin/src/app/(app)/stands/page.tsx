'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, MapPin, Search, Sliders, Check, X, Loader2, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

import { PageHeader } from '@/components/common/PageHeader';
import { StandsMap, type StandMapRow } from '@/components/map/StandsMap';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { supabase } from '@/lib/supabase/browser';
import { useCollege } from '@/lib/scope';
import { upsertStand, toAppError, messageFor, en } from '@campuscycle/shared';

interface EditingStandState {
  id?: string | null;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  active: boolean;
}

export default function StandsPage() {
  const queryClient = useQueryClient();
  const { college } = useCollege();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null);
  const [isPlacing, setIsPlacing] = useState(false);
  const [editingStand, setEditingStand] = useState<EditingStandState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Fetch college details for default geofence and center coordinates
  const { data: collegeDetails } = useQuery({
    queryKey: ['college-details', college?.id],
    queryFn: async () => {
      if (!college?.id) return null;
      const { data, error } = await supabase
        .from('colleges')
        .select('default_geofence_m, center_lat, center_lng')
        .eq('id', college.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!college?.id,
  });

  const defaultGeofence = collegeDetails?.default_geofence_m ?? 50;

  // 2. Fetch stands with live counts + inactive stands
  const { data: stands = [], isLoading } = useQuery({
    queryKey: ['admin-stands', college?.id],
    queryFn: async (): Promise<StandMapRow[]> => {
      if (!college?.id) return [];

      const [countsRes, standsRes] = await Promise.all([
        supabase.rpc('get_stands_with_counts', { p_college_id: college.id }),
        supabase.from('stands').select('*').eq('college_id', college.id).order('name'),
      ]);

      if (countsRes.error) throw countsRes.error;
      if (standsRes.error) throw standsRes.error;

      const countsMap = new Map<string, { free: number; total: number; maint: number }>();
      for (const item of countsRes.data ?? []) {
        countsMap.set(item.id, {
          free: item.free_bikes ?? 0,
          total: item.total_bikes ?? 0,
          maint: item.maintenance_bikes ?? 0,
        });
      }

      const rows: StandMapRow[] = [];
      for (const s of standsRes.data ?? []) {
        const counts = countsMap.get(s.id);
        rows.push({
          id: s.id,
          name: s.name,
          lat: s.lat,
          lng: s.lng,
          radius_m: s.radius_m ?? defaultGeofence,
          capacity: s.capacity,
          active: s.active,
          free_bikes: counts?.free ?? 0,
          total_bikes: counts?.total ?? 0,
          maintenance_bikes: counts?.maint ?? 0,
        });
      }

      return rows;
    },
    enabled: !!college?.id,
  });

  // Filter stands by search
  const filteredStands = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return stands;
    return stands.filter((s) => s.name.toLowerCase().includes(q));
  }, [stands, searchQuery]);

  // Handle start adding stand
  const handleStartAdd = () => {
    if (isPlacing) {
      setIsPlacing(false);
      return;
    }
    setEditingStand(null);
    setSelectedStandId(null);
    setIsPlacing(true);
    toast.info(en.a10.place_hint, { duration: 4000 });
  };

  // Handle map click during place mode
  const handlePlaceClick = (lat: number, lng: number) => {
    setIsPlacing(false);
    setEditingStand({
      id: null,
      name: '',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      radius_m: defaultGeofence,
      capacity: 20,
      active: true,
    });
  };

  // Handle marker drag updates
  const handleMarkerDrag = (lat: number, lng: number) => {
    setEditingStand((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        lat: Number(lat.toFixed(6)),
        lng: Number(lng.toFixed(6)),
      };
    });
  };

  // Handle select stand from list or map
  const handleSelectStand = (id: string | null) => {
    setSelectedStandId(id);
    if (!id) {
      if (editingStand && editingStand.id) {
        setEditingStand(null);
      }
      return;
    }
    const found = stands.find((s) => s.id === id);
    if (found) {
      setEditingStand({
        id: found.id,
        name: found.name,
        lat: Number(found.lat.toFixed(6)),
        lng: Number(found.lng.toFixed(6)),
        radius_m: found.radius_m,
        capacity: found.capacity,
        active: found.active,
      });
    }
  };

  // Handle save stand
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStand || !college?.id) return;

    const trimmedName = editingStand.name.trim();
    if (trimmedName.length < 2 || trimmedName.length > 60) {
      toast.error('Stand name must be between 2 and 60 characters.');
      return;
    }

    if (
      editingStand.lat < -90 ||
      editingStand.lat > 90 ||
      editingStand.lng < -180 ||
      editingStand.lng > 180
    ) {
      toast.error('Invalid coordinates.');
      return;
    }

    if (editingStand.radius_m < 10 || editingStand.radius_m > 300) {
      toast.error('Geofence radius must be between 10 and 300 meters.');
      return;
    }

    if (editingStand.capacity < 1 || editingStand.capacity > 200) {
      toast.error('Capacity must be between 1 and 200 bikes.');
      return;
    }

    setIsSaving(true);
    try {
      await upsertStand(supabase, {
        id: editingStand.id ?? undefined,
        college_id: college.id,
        name: trimmedName,
        lat: editingStand.lat,
        lng: editingStand.lng,
        radius_m: editingStand.radius_m,
        capacity: editingStand.capacity,
        active: editingStand.active,
      });

      toast.success(editingStand.id ? 'Stand updated.' : 'Stand created.');
      setEditingStand(null);
      setSelectedStandId(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-stands', college.id] });
    } catch (err) {
      const appErr = toAppError(err);
      toast.error(messageFor(appErr.code, appErr.data));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={college?.short_code}
        title={en.a10.title}
        lede="Set stand coordinates, geofence radii, capacities, and active availability."
        actions={
          <Button
            onClick={handleStartAdd}
            variant={isPlacing ? 'destructive' : 'default'}
            className="h-10 px-5 rounded-full font-mono text-xs font-bold cursor-pointer shadow-md"
          >
            {isPlacing ? (
              <>
                <X className="size-4 mr-1.5" />
                Cancel placement
              </>
            ) : (
              <>
                <Plus className="size-4 mr-1.5" />
                {en.a10.add}
              </>
            )}
          </Button>
        }
      />

      {/* Main split layout: 60% Map on left, 40% List/Form on right */}
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-230px)] min-h-[620px]">
        {/* Map View (60%) */}
        <div className="w-full lg:w-[60%] h-[380px] lg:h-full rounded-2xl overflow-hidden border border-border relative shadow-xs">
          <StandsMap
            stands={stands}
            selectedStandId={selectedStandId}
            onSelectStand={handleSelectStand}
            isPlacing={isPlacing}
            onPlaceClick={handlePlaceClick}
            editingStand={
              editingStand
                ? {
                    id: editingStand.id,
                    name: editingStand.name,
                    lat: editingStand.lat,
                    lng: editingStand.lng,
                    radius_m: editingStand.radius_m,
                  }
                : null
            }
            onMarkerDrag={handleMarkerDrag}
            centerLat={collegeDetails?.center_lat ?? undefined}
            centerLng={collegeDetails?.center_lng ?? undefined}
          />
        </div>

        {/* Right Panel (40%): Stand Form OR Stand List */}
        <div className="w-full lg:w-[40%] flex flex-col h-full bg-surface border border-border rounded-2xl overflow-hidden shadow-xs">
          {editingStand ? (
            /* Stand Edit / Add Form */
            <form onSubmit={handleSave} className="flex flex-col h-full">
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface2/40">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <h3 className="font-display font-bold text-sm text-fg">
                    {editingStand.id ? 'Edit stand' : 'Add new stand'}
                  </h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingStand(null);
                    setSelectedStandId(null);
                  }}
                  className="h-8 px-2 text-xs font-mono text-muted hover:text-fg"
                >
                  <X className="size-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="p-3 rounded-lg bg-surface2/60 border border-border text-[11px] font-mono text-muted flex items-start gap-2">
                  <Sliders className="size-4 shrink-0 text-primary mt-0.5" />
                  <span>Drag the pin on the map to position precisely, or adjust the numbers below.</span>
                </div>

                {/* Stand Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="stand-name" className="text-xs font-mono font-medium text-fg">
                    {en.a10.name}
                  </Label>
                  <Input
                    id="stand-name"
                    value={editingStand.name}
                    onChange={(e) => setEditingStand({ ...editingStand, name: e.target.value })}
                    placeholder="e.g. Hall 1"
                    maxLength={60}
                    required
                    className="h-9 text-xs font-mono bg-surface2 border-border"
                  />
                </div>

                {/* Coordinates (Lat / Lng synced with marker) */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="stand-lat" className="text-xs font-mono font-medium text-fg">
                      {en.a10.lat}
                    </Label>
                    <Input
                      id="stand-lat"
                      type="number"
                      step="0.000001"
                      value={editingStand.lat}
                      onChange={(e) =>
                        setEditingStand({
                          ...editingStand,
                          lat: parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                      className="h-9 text-xs font-mono bg-surface2 border-border"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="stand-lng" className="text-xs font-mono font-medium text-fg">
                      {en.a10.lng}
                    </Label>
                    <Input
                      id="stand-lng"
                      type="number"
                      step="0.000001"
                      value={editingStand.lng}
                      onChange={(e) =>
                        setEditingStand({
                          ...editingStand,
                          lng: parseFloat(e.target.value) || 0,
                        })
                      }
                      required
                      className="h-9 text-xs font-mono bg-surface2 border-border"
                    />
                  </div>
                </div>

                {/* Geofence Radius (m) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="stand-radius" className="text-xs font-mono font-medium text-fg">
                      {en.a10.radius}
                    </Label>
                    <span className="font-mono text-xs font-bold text-primary">
                      {editingStand.radius_m} m
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={10}
                      max={300}
                      step={5}
                      value={editingStand.radius_m}
                      onChange={(e) =>
                        setEditingStand({
                          ...editingStand,
                          radius_m: parseInt(e.target.value, 10),
                        })
                      }
                      className="flex-1 accent-primary cursor-pointer"
                    />
                    <Input
                      id="stand-radius"
                      type="number"
                      min={10}
                      max={300}
                      value={editingStand.radius_m}
                      onChange={(e) =>
                        setEditingStand({
                          ...editingStand,
                          radius_m: parseInt(e.target.value, 10) || 10,
                        })
                      }
                      className="w-20 h-8 text-xs font-mono text-right bg-surface2 border-border"
                    />
                  </div>
                  <p className="text-[11px] font-mono text-muted">
                    Riders must be within this circle to borrow or return bikes.
                  </p>
                </div>

                {/* Capacity (1-200) */}
                <div className="space-y-1.5">
                  <Label htmlFor="stand-cap" className="text-xs font-mono font-medium text-fg">
                    {en.a10.capacity}
                  </Label>
                  <Input
                    id="stand-cap"
                    type="number"
                    min={1}
                    max={200}
                    value={editingStand.capacity}
                    onChange={(e) =>
                      setEditingStand({
                        ...editingStand,
                        capacity: parseInt(e.target.value, 10) || 1,
                      })
                    }
                    required
                    className="h-9 text-xs font-mono bg-surface2 border-border"
                  />
                </div>

                {/* Active switch */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-surface2 border border-border">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-medium text-fg">{en.a10.active}</span>
                    <p className="text-[11px] font-mono text-muted">
                      Inactive stands are hidden from rider apps and maps.
                    </p>
                  </div>
                  <Switch
                    checked={editingStand.active}
                    onCheckedChange={(checked) => setEditingStand({ ...editingStand, active: checked })}
                  />
                </div>
              </div>

              {/* Form Footer */}
              <div className="p-4 border-t border-border flex items-center justify-between bg-surface2/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingStand(null);
                    setSelectedStandId(null);
                  }}
                  className="font-mono text-xs cursor-pointer text-muted hover:text-fg"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="h-9 px-5 rounded-full font-mono text-xs font-bold bg-primary text-on-primary hover:bg-primary/90 cursor-pointer shadow-sm"
                >
                  {isSaving ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Check className="size-3.5 mr-1.5" />
                  )}
                  {en.a10.save}
                </Button>
              </div>
            </form>
          ) : (
            /* Stand List */
            <div className="flex flex-col h-full">
              {/* Search header */}
              <div className="p-4 border-b border-border space-y-3 bg-surface2/30">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-fg">Stands ({stands.length})</h3>
                  <span className="text-xs font-mono text-muted">
                    Total cap: {stands.reduce((sum, s) => sum + s.capacity, 0)}
                  </span>
                </div>

                <div className="relative">
                  <Search className="size-3.5 absolute left-3 top-2.5 text-muted" />
                  <Input
                    placeholder="Search stand name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs font-mono bg-surface2 border-border"
                  />
                </div>
              </div>

              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto divide-y divide-border/60">
                {isLoading ? (
                  <div className="p-8 text-center font-mono text-xs text-muted flex items-center justify-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    Loading stands...
                  </div>
                ) : filteredStands.length === 0 ? (
                  <div className="p-8 text-center font-mono text-xs text-muted">No stands found.</div>
                ) : (
                  filteredStands.map((stand) => {
                    const isSelected = selectedStandId === stand.id;
                    const isOver = stand.total_bikes > stand.capacity;

                    return (
                      <div
                        key={stand.id}
                        onClick={() => handleSelectStand(stand.id)}
                        className={`p-3.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-surface2/60'
                        }`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-xs text-fg truncate">{stand.name}</span>
                            {isOver && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-bad/15 text-bad border border-bad/30">
                                {en.a10.over}
                              </span>
                            )}
                            {!stand.active && (
                              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono text-muted bg-surface2 border border-border uppercase">
                                Inactive
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[11px] font-mono text-muted">
                            <span>
                              Bikes: <strong className="text-fg font-semibold">{stand.free_bikes}</strong>/
                              {stand.capacity}
                            </span>
                            <span>·</span>
                            <span>{stand.radius_m}m geofence</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Display only active switch per spec */}
                          <Switch
                            checked={stand.active}
                            disabled
                            aria-label="Active status"
                            className="opacity-70 scale-85 pointer-events-none"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStand(stand.id);
                            }}
                            className="h-8 px-2 text-xs font-mono text-muted hover:text-fg"
                          >
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
