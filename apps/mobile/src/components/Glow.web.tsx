import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { palette } from '@campuscycle/shared';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

function blob(size: number, color: string, place: ViewStyle): ViewStyle {
  return {
    position: 'absolute',
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    filter: 'blur(60px)',
    ...place,
  } as ViewStyle;
}

// The soft ambient light behind every screen (06 §5.22), drawn with CSS blur on the web.
export const Glow = React.memo(function Glow() {
  const { c } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <View style={blob(340, alpha(c.primary, 0.14), { top: -110, left: -130 })} />
      <View style={blob(280, alpha(palette.sticker.blue, 0.12), { top: '40%', right: -160 })} />
      <View style={blob(260, alpha(palette.sticker.coral, 0.09), { bottom: -160, left: '15%' })} />
    </View>
  );
});
