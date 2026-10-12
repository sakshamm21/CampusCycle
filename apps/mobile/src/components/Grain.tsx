import React from 'react';
import { StyleSheet } from 'react-native';
import { Canvas, Fill, FractalNoise } from '@shopify/react-native-skia';
import { useTheme } from '@/theme/ThemeProvider';

// Film grain over the whole app (06 §5.22). It never takes touches.
export const Grain = React.memo(function Grain() {
  const { c } = useTheme();
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Fill opacity={c.grain} blendMode="overlay">
        <FractalNoise freqX={0.85} freqY={0.85} octaves={3} />
      </Fill>
    </Canvas>
  );
});
