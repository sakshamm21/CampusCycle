import type { Ref } from 'react';

export interface MapStand {
  id: string;
  name: string;
  lat: number;
  lng: number;
  free_bikes: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface StandMapHandle {
  recenter(to: LatLng): void;
}

export interface StandMapProps {
  stands: MapStand[];
  center: LatLng;
  selectedId?: string | null;
  /** `null` when the map itself is tapped. */
  onSelect?(id: string | null): void;
  /** The user dot, only when location permission is granted. */
  showUser?: boolean;
  /** False for the small static map on Stand detail. */
  interactive?: boolean;
  /** Fixed height; fills its parent when omitted. */
  height?: number;
  radius?: number;
  ref?: Ref<StandMapHandle>;
}

// Free vector tiles, no key needed (04 R09). Both URLs answered 200 when Phase 3 was built.
export const MAP_STYLES = {
  dark: 'https://tiles.openfreemap.org/styles/dark',
  day: 'https://tiles.openfreemap.org/styles/positron',
} as const;

export const MAP_ZOOM = 15.5;
