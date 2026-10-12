'use client';

import React, { useMemo } from 'react';
import MapView, { Marker, NavigationControl } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

export interface StandData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  free_bikes: number;
  maintenance_bikes: number;
  total_bikes: number;
  expected_free?: number;
}

export interface BikeMapData {
  id: string;
  short_code: string;
  status: string;
  current_stand_id: string | null;
}

export interface CampusMapProps {
  stands: StandData[];
  bikes: BikeMapData[];
  selectedStandId?: string | null;
  onSelectStand?: (id: string | null) => void;
  layers: {
    stands: boolean;
    availableBikes: boolean;
    maintenanceBikes: boolean;
  };
  centerLat?: number;
  centerLng?: number;
  className?: string;
}

// Deterministic jitter up to 8m from bike id
function getBikeJitter(bikeId: string, baseLat: number, baseLng: number) {
  let hash = 0;
  for (let i = 0; i < bikeId.length; i++) {
    hash = (hash << 5) - hash + bikeId.charCodeAt(i);
    hash |= 0;
  }
  const angle = (Math.abs(hash % 360) * Math.PI) / 180;
  const radiusMeters = (Math.abs(hash >> 8) % 80) / 10; // 0 to 8 meters
  const dLat = (radiusMeters * Math.cos(angle)) / 111320;
  const dLng = (radiusMeters * Math.sin(angle)) / (111320 * Math.cos((baseLat * Math.PI) / 180));
  return { lat: baseLat + dLat, lng: baseLng + dLng };
}

export function CampusMap({
  stands,
  bikes,
  selectedStandId,
  onSelectStand,
  layers,
  centerLat,
  centerLng,
  className = '',
}: CampusMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Tile styles by theme
  const mapStyle = isDark
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';

  // Compute map center
  const initialCenter = useMemo(() => {
    if (centerLat && centerLng) {
      return { latitude: centerLat, longitude: centerLng };
    }
    if (stands.length > 0) {
      const avgLat = stands.reduce((sum, s) => sum + s.lat, 0) / stands.length;
      const avgLng = stands.reduce((sum, s) => sum + s.lng, 0) / stands.length;
      return { latitude: avgLat, longitude: avgLng };
    }
    // IIT Kanpur default
    return { latitude: 26.5123, longitude: 80.2329 };
  }, [centerLat, centerLng, stands]);

  // Lookup map of stands by ID for fast bike positioning
  const standsMap = useMemo(() => {
    const map = new Map<string, StandData>();
    for (const s of stands) {
      map.set(s.id, s);
    }
    return map;
  }, [stands]);

  // Filter bikes to render as dots
  const bikesWithPosition = useMemo(() => {
    const list: Array<{
      bike: BikeMapData;
      lat: number;
      lng: number;
      isMaintenance: boolean;
    }> = [];

    for (const b of bikes) {
      if (!b.current_stand_id) continue; // Borrowed / unassigned bikes not on map
      const stand = standsMap.get(b.current_stand_id);
      if (!stand) continue;

      const isAvailable = b.status === 'available';
      const isMaint = b.status === 'maintenance';

      if (isAvailable && !layers.availableBikes) continue;
      if (isMaint && !layers.maintenanceBikes) continue;
      if (!isAvailable && !isMaint) continue;

      const jitter = getBikeJitter(b.id, stand.lat, stand.lng);
      list.push({
        bike: b,
        lat: jitter.lat,
        lng: jitter.lng,
        isMaintenance: isMaint,
      });
    }

    return list;
  }, [bikes, standsMap, layers.availableBikes, layers.maintenanceBikes]);

  return (
    <div className={cn('relative w-full h-full overflow-hidden', className)}>
      <MapView
        mapLib={maplibregl}
        mapStyle={mapStyle}
        initialViewState={{
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          zoom: 15.5,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />

        {/* 1. Stand Markers */}
        {layers.stands &&
          stands.map((stand) => {
            const isSelected = selectedStandId === stand.id;
            const displayFree = stand.expected_free !== undefined ? stand.expected_free : stand.free_bikes;
            const isOverCapacity = stand.total_bikes > stand.capacity;

            // Thresholds by 06 §5.23: ok (free >= 3), warn (1-2), bad (0)
            let colorClasses = 'border-ok text-ok';
            if (displayFree === 0) {
              colorClasses = 'border-bad text-bad';
            } else if (displayFree < 3) {
              colorClasses = 'border-warn text-warn';
            }

            return (
              <Marker
                key={stand.id}
                latitude={stand.lat}
                longitude={stand.lng}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  onSelectStand?.(isSelected ? null : stand.id);
                }}
              >
                <div
                  className={cn(
                    'cursor-pointer flex flex-col items-center transition-transform select-none',
                    isSelected && 'scale-115 z-30',
                  )}
                >
                  <div
                    className={cn(
                      'px-2.5 py-1 rounded-full font-mono text-xs font-bold bg-surface border-2 shadow-md flex items-center gap-1 backdrop-blur-xs',
                      colorClasses,
                      isOverCapacity && 'ring-2 ring-bad ring-offset-1',
                      isSelected && 'ring-2 ring-primary ring-offset-2',
                    )}
                  >
                    <span>
                      {displayFree}/{stand.capacity}
                    </span>
                    {stand.maintenance_bikes > 0 && (
                      <span
                        title={`${stand.maintenance_bikes} in maintenance`}
                        className="size-1.5 rounded-full bg-warn"
                      />
                    )}
                  </div>

                  {/* Selected stand title pill */}
                  {isSelected && (
                    <div className="mt-1 px-2 py-0.5 rounded-md bg-surface text-fg font-mono text-[11px] font-bold border border-border shadow whitespace-nowrap">
                      {stand.name}
                    </div>
                  )}
                </div>
              </Marker>
            );
          })}

        {/* 2. Bikes Dots */}
        {bikesWithPosition.map(({ bike, lat, lng, isMaintenance }) => (
          <Marker key={bike.id} latitude={lat} longitude={lng} anchor="center">
            <div
              title={`${bike.short_code} · ${bike.status}`}
              className={cn(
                'size-2.5 rounded-full border border-surface shadow-xs transition-transform hover:scale-150',
                isMaintenance ? 'bg-warn' : 'bg-ok',
              )}
            />
          </Marker>
        ))}
      </MapView>
    </div>
  );
}
