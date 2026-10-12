'use client';

import React, { useMemo } from 'react';
import MapView, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { MapPin, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { en } from '@campuscycle/shared';

export interface StandMapRow {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  capacity: number;
  active: boolean;
  free_bikes: number;
  total_bikes: number;
  maintenance_bikes?: number;
}

export interface StandsMapProps {
  stands: StandMapRow[];
  selectedStandId: string | null;
  onSelectStand: (id: string | null) => void;
  isPlacing: boolean;
  onPlaceClick: (lat: number, lng: number) => void;
  editingStand: {
    id?: string | null;
    lat: number;
    lng: number;
    radius_m: number;
    name?: string;
  } | null;
  onMarkerDrag: (lat: number, lng: number) => void;
  centerLat?: number;
  centerLng?: number;
  className?: string;
}

// Generate GeoJSON polygon for circle with specified radius in meters
function createCircleGeoJson(centerLng: number, centerLat: number, radiusM: number) {
  const points = 64;
  const coords: [number, number][] = [];
  const earthRadius = 6378137; // meters
  const dLat = radiusM / earthRadius;
  const dLng = radiusM / (earthRadius * Math.cos((Math.PI * centerLat) / 180));

  for (let i = 0; i < points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    const lat = centerLat + (dLat * Math.sin(theta) * 180) / Math.PI;
    const lng = centerLng + (dLng * Math.cos(theta) * 180) / Math.PI;
    coords.push([lng, lat]);
  }
  coords.push(coords[0]); // close polygon

  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coords],
    },
    properties: {},
  };
}

export function StandsMap({
  stands,
  selectedStandId,
  onSelectStand,
  isPlacing,
  onPlaceClick,
  editingStand,
  onMarkerDrag,
  centerLat,
  centerLng,
  className = '',
}: StandsMapProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const mapStyle = isDark
    ? 'https://tiles.openfreemap.org/styles/dark'
    : 'https://tiles.openfreemap.org/styles/positron';

  // Compute map center
  const initialCenter = useMemo(() => {
    if (editingStand) {
      return { latitude: editingStand.lat, longitude: editingStand.lng };
    }
    if (selectedStandId) {
      const selected = stands.find((s) => s.id === selectedStandId);
      if (selected) return { latitude: selected.lat, longitude: selected.lng };
    }
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
  }, [centerLat, centerLng, stands, selectedStandId, editingStand]);

  // Circle GeoJSON for editing or selected stand
  const circleGeoJson = useMemo(() => {
    if (editingStand) {
      return createCircleGeoJson(editingStand.lng, editingStand.lat, editingStand.radius_m || 50);
    }
    if (selectedStandId) {
      const selected = stands.find((s) => s.id === selectedStandId);
      if (selected) {
        return createCircleGeoJson(selected.lng, selected.lat, selected.radius_m || 50);
      }
    }
    return null;
  }, [editingStand, selectedStandId, stands]);

  return (
    <div className={cn('relative w-full h-full overflow-hidden select-none', className)}>
      <MapView
        mapLib={maplibregl}
        mapStyle={mapStyle}
        initialViewState={{
          latitude: initialCenter.latitude,
          longitude: initialCenter.longitude,
          zoom: 15.5,
        }}
        cursor={isPlacing ? 'crosshair' : 'grab'}
        onClick={(e) => {
          if (isPlacing) {
            onPlaceClick(e.lngLat.lat, e.lngLat.lng);
          }
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="bottom-right" />

        {/* Geofence radius circle layer */}
        {circleGeoJson && (
          <Source id="stand-geofence" type="geojson" data={circleGeoJson}>
            <Layer
              id="stand-geofence-fill"
              type="fill"
              paint={{
                'fill-color': isDark ? '#ffd23f' : '#2448ff',
                'fill-opacity': 0.16,
              }}
            />
            <Layer
              id="stand-geofence-line"
              type="line"
              paint={{
                'line-color': isDark ? '#ffd23f' : '#2448ff',
                'line-width': 2,
                'line-dasharray': [2, 2],
              }}
            />
          </Source>
        )}

        {/* Regular stand markers */}
        {stands.map((stand) => {
          // If this stand is being edited, we render the draggable marker instead
          if (editingStand && editingStand.id === stand.id) {
            return null;
          }

          const isSelected = selectedStandId === stand.id;
          const isOverCapacity = stand.total_bikes > stand.capacity;

          let colorClasses = 'border-ok text-ok';
          if (!stand.active) {
            colorClasses = 'border-muted text-muted opacity-60';
          } else if (stand.free_bikes === 0) {
            colorClasses = 'border-bad text-bad';
          } else if (stand.free_bikes < 3) {
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
                onSelectStand(isSelected ? null : stand.id);
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
                    {stand.free_bikes}/{stand.capacity}
                  </span>
                  {!stand.active && (
                    <span className="text-[10px] font-normal uppercase text-muted ml-0.5">off</span>
                  )}
                </div>

                {/* Stand name pill */}
                <div
                  className={cn(
                    'mt-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold border shadow-xs whitespace-nowrap transition-colors',
                    isSelected
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-surface text-fg border-border opacity-90',
                  )}
                >
                  {stand.name}
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Draggable Active Marker (when adding or editing) */}
        {editingStand && (
          <Marker
            latitude={editingStand.lat}
            longitude={editingStand.lng}
            anchor="bottom"
            draggable
            onDrag={(e) => {
              onMarkerDrag(e.lngLat.lat, e.lngLat.lng);
            }}
            onDragEnd={(e) => {
              onMarkerDrag(e.lngLat.lat, e.lngLat.lng);
            }}
          >
            <div className="flex flex-col items-center cursor-grab active:cursor-grabbing z-40 select-none group">
              <div className="px-2 py-1 rounded-md bg-primary text-on-primary font-mono text-[11px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap border border-primary-foreground/20 animate-pulse">
                <Move className="size-3" />
                <span>Drag to reposition</span>
              </div>
              <div className="relative mt-1">
                <MapPin className="size-9 text-primary fill-primary drop-shadow-md" />
                <div className="size-2 rounded-full bg-on-primary absolute top-2.5 left-1/2 -translate-x-1/2" />
              </div>
            </div>
          </Marker>
        )}
      </MapView>

      {/* Place mode guidance badge */}
      {isPlacing && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none px-4 py-2 rounded-full bg-primary text-on-primary font-mono text-xs font-bold shadow-xl flex items-center gap-2 border border-primary-foreground/20 animate-bounce">
          <MapPin className="size-4" />
          <span>{en.a10.place_hint}</span>
        </div>
      )}
    </div>
  );
}
