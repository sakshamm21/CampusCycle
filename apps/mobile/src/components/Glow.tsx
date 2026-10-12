import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { BlurMask, Canvas, Circle } from '@shopify/react-native-skia';
import { palette } from '@campuscycle/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

// The soft ambient light behind every screen (06 §5.22).
export const Glow = React.memo(function Glow() {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Circle cx={40} cy={60} r={170} color={alpha(c.primary, 0.14)}>
        <BlurMask blur={60} style="normal" />
      </Circle>
      <Circle cx={width + 20} cy={height * 0.5} r={140} color={alpha(palette.sticker.blue, 0.12)}>
        <BlurMask blur={60} style="normal" />
      </Circle>
      <Circle cx={width * 0.4} cy={height + 30} r={130} color={alpha(palette.sticker.coral, 0.09)}>
        <BlurMask blur={60} style="normal" />
      </Circle>
    </Canvas>
  );
});
