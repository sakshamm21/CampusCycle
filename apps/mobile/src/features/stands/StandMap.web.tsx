import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { View } from 'react-native';
import { Map as GlMap, Marker as GlMarker, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { font } from '@campuscycle/shared';
import { toneForFree } from '@/components/StandPin';
import { useTheme } from '@/theme/ThemeProvider';
import { MAP_STYLES, MAP_ZOOM, type StandMapProps } from './mapTypes';

// maplibre-gl normally builds its worker from its own source text, which does not survive Metro bundling.
// The worker file is served from public/ instead (a copy of apps/mobile/node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs;
// copy it again when maplibre-gl is upgraded).
setWorkerUrl('/maplibre-gl-worker.mjs');

// The stand map in the browser: maplibre-gl with HTML markers that look like StandPin (04 R09).
export function StandMap({
  stands,
  center,
  selectedId,
  onSelect,
  interactive = true,
  height,
  radius = 22,
  ref,
}: StandMapProps) {
  const { mode, c } = useTheme();
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<GlMap | null>(null);
  const markers = useRef<GlMarker[]>([]);
  const select = useRef(onSelect);
  select.current = onSelect;

  useImperativeHandle(ref, () => ({
    recenter: (to) => map.current?.easeTo({ center: [to.lng, to.lat], zoom: MAP_ZOOM, duration: 500 }),
  }));

  useEffect(() => {
    if (!host.current) return;
    const m = new GlMap({
      container: host.current,
      style: MAP_STYLES[mode],
      center: [center.lng, center.lat],
      zoom: MAP_ZOOM,
      interactive,
      attributionControl: { compact: true },
    });
    m.on('click', () => select.current?.(null));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
    // The map is created once; theme changes go through setStyle below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    map.current?.setStyle(MAP_STYLES[mode]);
  }, [mode]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = stands.map((s) => {
      const selected = s.id === selectedId;
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', s.name);
      el.dataset.testid = `stand-pin.${s.name}`;
      el.textContent = String(s.free_bikes);
      Object.assign(el.style, {
        width: '34px',
        height: '34px',
        borderRadius: '50%',
        background: c.surface,
        color: c.fg,
        border: `2px solid ${c[toneForFree(s.free_bikes)]}`,
        font: `14px/1 '${font.numeric}', sans-serif`,
        cursor: onSelect ? 'pointer' : 'default',
        padding: '0',
        scale: selected ? '1.2' : '1',
      });
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        select.current?.(s.id);
      });
      return new GlMarker({ element: el }).setLngLat([s.lng, s.lat]).addTo(m);
    });
  }, [stands, selectedId, c, onSelect]);

  return (
    <View style={{ flex: height ? undefined : 1, height, borderRadius: radius, overflow: 'hidden' }}>
      <div ref={host} data-testid="stand-map" style={{ width: '100%', height: '100%' }} />
    </View>
  );
}
