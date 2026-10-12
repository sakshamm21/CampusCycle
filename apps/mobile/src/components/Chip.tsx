import React from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { font, radius } from '@campuscycle/shared';
import { Text, type TextTone } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

export interface ChipProps {
  text: string;
  tone?: TextTone;
  icon?: LucideIcon;
  spinner?: boolean;
  /** Makes the chip a choice: filled when selected. */
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({
  text,
  tone = 'muted',
  icon: Icon,
  spinner,
  selected,
  onPress,
  testID,
  style,
}: ChipProps) {
  const { c } = useTheme();
  const fg = selected ? c.bg : c[tone];
  const body = (
    <>
      {spinner ? <ActivityIndicator size={10} color={fg} /> : null}
      {Icon ? <Icon size={12} color={fg} strokeWidth={2} /> : null}
      <Text
        style={{ fontFamily: font.monoMedium, fontSize: 10, lineHeight: 13, letterSpacing: 1, color: fg }}
      >
        {text.toUpperCase()}
      </Text>
    </>
  );
  const base: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: radius.pill,
    borderWidth: 1,
    backgroundColor: selected ? c.fg : c.surface2,
    borderColor: selected ? c.fg : c.border,
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ selected: !!selected }}
        onPress={onPress}
        hitSlop={8}
        // Choice chips are bigger than label chips so they stay easy to tap.
        style={[base, { paddingVertical: 11, paddingHorizontal: 14 }, style]}
      >
        {body}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[base, style]}>
      {body}
    </View>
  );
}

export type StatusTone = 'ok' | 'primary' | 'warn' | 'bad' | 'subtle';

const BIKE_TONES: Record<string, StatusTone> = {
  available: 'ok',
  borrowed: 'primary',
  maintenance: 'warn',
  missing: 'bad',
  retired: 'subtle',
  riding: 'primary',
  overdue: 'warn',
  suspended: 'bad',
  pending: 'subtle',
  ready: 'ok',
};

export function toneForStatus(status: string): StatusTone {
  return BIKE_TONES[status] ?? 'subtle';
}

export function StatusPill({
  text,
  tone,
  style,
}: {
  text: string;
  tone: StatusTone;
  style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const color = c[tone];
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderRadius: radius.pill,
          backgroundColor: alpha(color, 0.14),
        },
        style,
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontFamily: font.monoMedium, fontSize: 10, lineHeight: 13, letterSpacing: 1, color }}>
        {text.toUpperCase()}
      </Text>
    </View>
  );
}
