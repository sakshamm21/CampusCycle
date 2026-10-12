import React from 'react';
import { View } from 'react-native';
import { Bike } from 'lucide-react-native';
import { en, font } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

/** The mark (bike in a primary circle), optionally with the wordmark next to it (06 §4). */
export function BrandMark({ size = 28, wordmark }: { size?: number; wordmark?: boolean }) {
  const { c } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={en.common.wordmark}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.primary,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bike size={size * 0.7} color={c.onPrimary} strokeWidth={2} />
      </View>
      {wordmark ? (
        <Text
          style={{
            fontFamily: font.display,
            fontSize: size * 0.64,
            letterSpacing: size * 0.64 * -0.04,
            color: c.fg,
          }}
        >
          {en.common.wordmark}
        </Text>
      ) : null}
    </View>
  );
}
