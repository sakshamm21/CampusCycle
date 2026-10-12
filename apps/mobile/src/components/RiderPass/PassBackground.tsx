import React from 'react';
import { StyleSheet } from 'react-native';
import {
  Canvas,
  Fill,
  FractalNoise,
  Group,
  LinearGradient,
  RadialGradient,
  Rect,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';
import type { Finish } from '@campuscycle/shared';

interface Props {
  width: number;
  height: number;
  finish: Finish;
  /** Cross-fades to this finish as `mix` goes 0 → 1 (level-up). */
  nextFinish?: Finish;
  mix?: SharedValue<number>;
  /** Shine centre, 0..1 across the card. */
  shineX: SharedValue<number>;
  shineY: SharedValue<number>;
  /** Pending: greyed and darker, no holo. */
  dimmed?: boolean;
}

// A CSS `linear-gradient(<deg>, ...)` line across a w × h box, as Skia start and end points.
function cssLine(deg: number, w: number, h: number) {
  const a = (deg * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return { start: vec(w / 2 - dx * half, h / 2 - dy * half), end: vec(w / 2 + dx * half, h / 2 + dy * half) };
}

const BASE: Record<Finish, { deg: number; colors: string[]; positions: number[]; highlight: number }> = {
  graphite: { deg: 140, colors: ['#1E232C', '#0E1116', '#1A1F28'], positions: [0, 0.55, 1], highlight: 0.11 },
  chrome: {
    deg: 120,
    colors: ['#DDE2E9', '#9AA3B1', '#F4F6F9', '#8D97A6', '#D3D9E1'],
    positions: [0, 0.28, 0.48, 0.7, 1],
    highlight: 0.7,
  },
  holo: { deg: 140, colors: ['#1D1F30', '#0D0F17', '#1E1B2D'], positions: [0, 0.55, 1], highlight: 0.1 },
};

const RAINBOW = ['transparent', '#FF6B5E', '#FFD23F', '#3FE0B5', '#4C74FF', '#B06BFF', 'transparent'];
const RAINBOW_AT = [0.12, 0.26, 0.37, 0.49, 0.61, 0.72, 0.86];

function FinishLayers({
  finish,
  w,
  h,
  shineX,
  dimmed,
}: {
  finish: Finish;
  w: number;
  h: number;
  shineX: SharedValue<number>;
  dimmed?: boolean;
}) {
  const base = BASE[finish];
  const line = cssLine(base.deg, w, h);
  const hair = cssLine(100, 4, 4);
  const hairColor = finish === 'chrome' ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.03)';
  // The holo and chrome sheens slide with the tilt.
  const slide = useDerivedValue(() => [{ translateX: (shineX.value - 0.5) * w * 1.2 }]);
  const wide = rect(-w, 0, w * 3, h);

  return (
    <>
      <Rect x={0} y={0} width={w} height={h}>
        <LinearGradient start={line.start} end={line.end} colors={base.colors} positions={base.positions} />
      </Rect>
      {finish !== 'holo' ? (
        <Rect x={0} y={0} width={w} height={h}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(hair.end.x - hair.start.x, hair.end.y - hair.start.y)}
            colors={[hairColor, hairColor, 'transparent', 'transparent']}
            positions={[0, 0.25, 0.25, 1]}
            mode="repeat"
          />
        </Rect>
      ) : null}
      <Rect x={0} y={0} width={w} height={h}>
        <RadialGradient
          c={vec(0, 0)}
          r={w * 0.9}
          colors={[`rgba(255,255,255,${base.highlight})`, 'transparent']}
          positions={[0, 0.6]}
        />
      </Rect>
      {finish === 'holo' && !dimmed ? (
        <Group transform={slide} blendMode="colorDodge" opacity={0.42}>
          <Rect rect={wide}>
            <LinearGradient {...cssLine(115, w * 3, h)} colors={RAINBOW} positions={RAINBOW_AT} />
          </Rect>
        </Group>
      ) : null}
      {finish === 'chrome' && !dimmed ? (
        <Group transform={slide} blendMode="softLight">
          <Rect rect={wide}>
            <LinearGradient
              {...cssLine(120, w * 3, h)}
              colors={['transparent', 'rgba(255,255,255,0.75)', 'transparent']}
              positions={[0.25, 0.46, 0.62]}
            />
          </Rect>
        </Group>
      ) : null}
    </>
  );
}

// Finish, holo, shine and grain of the card, drawn with Skia (06 §6.2, §6.6).
export function PassBackground({
  width: w,
  height: h,
  finish,
  nextFinish,
  mix,
  shineX,
  shineY,
  dimmed,
}: Props) {
  const clip = rrect(rect(0, 0, w, h), w * 0.06, w * 0.06);
  const shineCentre = useDerivedValue(() => vec(shineX.value * w, shineY.value * h));
  const streak = useDerivedValue(() => [{ translateX: (shineX.value - 0.5) * w * 1.6 }]);
  const nextOpacity = useDerivedValue(() => mix?.value ?? 0);

  return (
    <Canvas pointerEvents="none" style={[StyleSheet.absoluteFill, { width: w, height: h }]}>
      <Group clip={clip}>
        <FinishLayers finish={finish} w={w} h={h} shineX={shineX} dimmed={dimmed} />
        {nextFinish && nextFinish !== finish ? (
          <Group opacity={nextOpacity}>
            <FinishLayers finish={nextFinish} w={w} h={h} shineX={shineX} />
          </Group>
        ) : null}
        {dimmed ? <Fill color="rgba(10,12,16,0.35)" /> : null}

        {/* Shine: a soft spot at the tilt point plus a slanted streak. */}
        <Rect x={0} y={0} width={w} height={h} blendMode="overlay">
          <RadialGradient c={shineCentre} r={w * 0.42} colors={['rgba(255,255,255,0.38)', 'transparent']} />
        </Rect>
        <Group transform={streak} blendMode="overlay">
          <Rect x={-w} y={0} width={w * 3} height={h}>
            <LinearGradient
              {...cssLine(105, w, h)}
              colors={['transparent', 'rgba(255,255,255,0.16)', 'transparent']}
              positions={[0.38, 0.5, 0.62]}
            />
          </Rect>
        </Group>

        <Fill opacity={0.14} blendMode="overlay">
          <FractalNoise freqX={0.85} freqY={0.85} octaves={3} />
        </Fill>
      </Group>
    </Canvas>
  );
}
