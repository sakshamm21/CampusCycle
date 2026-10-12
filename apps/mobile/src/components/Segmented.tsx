import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { font, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface SegmentedProps<T extends string> {
  options: { value: T; label: string; testID?: string }[];
  value: T;
  onChange(value: T): void;
  style?: StyleProp<ViewStyle>;
}

export function Segmented<T extends string>({ options, value, onChange, style }: SegmentedProps<T>) {
  const { c } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[
        {
          flexDirection: 'row',
          padding: 4,
          borderRadius: radius.pill,
          backgroundColor: c.surface,
          borderWidth: 1,
          borderColor: c.border,
        },
        style,
      ]}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={o.testID}
            accessibilityRole="tab"
            accessibilityLabel={o.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: selected ? c.fg : 'transparent',
            }}
          >
            <Text style={{ fontFamily: font.bodyBold, fontSize: 14, color: selected ? c.bg : c.muted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
