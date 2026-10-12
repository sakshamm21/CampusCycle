import React, { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeProvider';

const R = 22;
const NOTCH = 10;

// A rounded rectangle whose bottom (or top) corners are bitten out by two half-circle notches.
function stubPath(w: number, h: number, notchesAt: 'bottom' | 'top'): string {
  if (notchesAt === 'bottom') {
    return [
      `M0 ${R}`,
      `A${R} ${R} 0 0 1 ${R} 0`,
      `H${w - R}`,
      `A${R} ${R} 0 0 1 ${w} ${R}`,
      `V${h - NOTCH}`,
      `A${NOTCH} ${NOTCH} 0 0 0 ${w - NOTCH} ${h}`,
      `H${NOTCH}`,
      `A${NOTCH} ${NOTCH} 0 0 0 0 ${h - NOTCH}`,
      'Z',
    ].join(' ');
  }
  return [
    `M${NOTCH} 0`,
    `H${w - NOTCH}`,
    `A${NOTCH} ${NOTCH} 0 0 0 ${w} ${NOTCH}`,
    `V${h - R}`,
    `A${R} ${R} 0 0 1 ${w - R} ${h}`,
    `H${R}`,
    `A${R} ${R} 0 0 1 0 ${h - R}`,
    `V${NOTCH}`,
    `A${NOTCH} ${NOTCH} 0 0 0 ${NOTCH} 0`,
    'Z',
  ].join(' ');
}

function Stub({ part, children }: { part: 'top' | 'bottom'; children: React.ReactNode }) {
  const { c } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <View onLayout={onLayout} style={{ padding: 18, paddingTop: part === 'bottom' ? 22 : 18 }}>
      {size.w > 0 ? (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Path
            d={stubPath(size.w, size.h, part === 'top' ? 'bottom' : 'top')}
            fill={part === 'top' ? c.primary : c.surface}
          />
          {part === 'bottom' ? (
            <Line
              x1={16}
              y1={1}
              x2={size.w - 16}
              y2={1}
              stroke={c.borderStrong}
              strokeWidth={2}
              strokeDasharray="6 6"
            />
          ) : null}
        </Svg>
      ) : null}
      {children}
    </View>
  );
}

/** The ticket stub of the ride summary (06 §5.19): a primary top part and a surface bottom part. */
export function Receipt({
  top,
  bottom,
  testID,
}: {
  top: React.ReactNode;
  bottom: React.ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID}>
      <Stub part="top">{top}</Stub>
      <Stub part="bottom">{bottom}</Stub>
    </View>
  );
}
