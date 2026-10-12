import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { font, palette, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';

export interface StickerProps {
  text: string;
  color?: keyof typeof palette.sticker;
  /** Degrees, between -6 and 7. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}

export function Sticker({ text, color = 'yellow', rotate = 0, style }: StickerProps) {
  const light = color === 'blue' || color === 'ink';
  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          backgroundColor: palette.sticker[color],
          transform: [{ rotate: `${rotate}deg` }],
          shadowColor: '#000000',
          shadowOpacity: 0.4,
          shadowRadius: 15,
          shadowOffset: { width: 0, height: 14 },
          elevation: 6,
          boxShadow: '0px 14px 30px -10px rgba(0,0,0,0.55)',
        },
        style,
      ]}
    >
      <Text
        style={{
          fontFamily: font.displayBold,
          fontSize: 14,
          lineHeight: 18,
          letterSpacing: -0.3,
          color: light ? '#FFFFFF' : palette.sticker.ink,
        }}
      >
        {text}
      </Text>
    </View>
  );
}
