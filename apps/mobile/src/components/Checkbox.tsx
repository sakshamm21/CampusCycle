import React from 'react';
import { Pressable, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface CheckboxProps {
  label: string;
  checked: boolean;
  onChange(checked: boolean): void;
  error?: string | null;
  testID?: string;
}

export function Checkbox({ label, checked, onChange, error, testID }: CheckboxProps) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={() => onChange(!checked)}
        style={{ flexDirection: 'row', gap: 12, minHeight: 44, alignItems: 'center' }}
      >
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 8,
            borderWidth: 1.5,
            borderColor: error ? c.bad : checked ? c.primary : c.borderStrong,
            backgroundColor: checked ? c.primary : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {checked ? <Check size={16} color={c.onPrimary} strokeWidth={3} /> : null}
        </View>
        <Text variant="bodyS" style={{ flex: 1 }}>
          {label}
        </Text>
      </Pressable>
      {error ? (
        <Text variant="bodyS" tone="bad">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
