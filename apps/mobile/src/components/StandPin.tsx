import React from 'react';
import { View } from 'react-native';
import { font } from '@campuscycle/shared';
import { Text, type TextTone } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

/** ok for 3 or more free bikes, warn for 1 or 2, bad for none (06 §5.23). */
export function toneForFree(free: number): Extract<TextTone, 'ok' | 'warn' | 'bad'> {
  return free >= 3 ? 'ok' : free >= 1 ? 'warn' : 'bad';
}

export interface StandPinProps {
  free: number;
  name: string;
  selected?: boolean;
}

export function StandPin({ free, name, selected }: StandPinProps) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: c.surface,
          borderWidth: 2,
          borderColor: c[toneForFree(free)],
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: selected ? 1.2 : 1 }],
        }}
      >
        <Text style={{ fontFamily: font.numeric, fontSize: 14, lineHeight: 16, color: c.fg }}>
          {String(free)}
        </Text>
      </View>
      {selected ? (
        <Text
          style={{
            fontFamily: font.monoMedium,
            fontSize: 9,
            letterSpacing: 0.8,
            color: c.fg,
            backgroundColor: c.surface,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          {name.toUpperCase()}
        </Text>
      ) : null}
    </View>
  );
}
