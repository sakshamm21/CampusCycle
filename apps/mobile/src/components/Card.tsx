import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius } from '@campuscycle/shared';
import { useTheme } from '@/theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'raised' | 'outlineDashed';
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  accessibilityLabel,
  testID,
  style,
}: CardProps) {
  const { c } = useTheme();
  const base: ViewStyle = {
    backgroundColor: variant === 'raised' ? c.raised : c.surface,
    borderWidth: variant === 'outlineDashed' ? 1.5 : 1,
    borderStyle: variant === 'outlineDashed' ? 'dashed' : 'solid',
    borderColor: variant === 'outlineDashed' ? c.primary : c.border,
    borderRadius: radius.card,
    padding: 16,
    ...(variant === 'raised'
      ? {
          shadowColor: '#000000',
          shadowOpacity: 0.3,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 18 },
          elevation: 8,
          boxShadow: `0px 18px 40px -16px ${c.shadow}`,
        }
      : null),
  };

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [base, { opacity: pressed ? 0.8 : 1 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[base, style]}>
      {children}
    </View>
  );
}
