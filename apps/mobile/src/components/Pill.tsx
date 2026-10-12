import React from 'react';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { LucideIcon } from 'lucide-react-native';
import { font, motion, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';
import { haptic } from '@/lib/haptics';

export type PillVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
export type PillSize = 'lg' | 'md' | 'sm';

export interface PillProps {
  label: string;
  onPress?: () => void;
  variant?: PillVariant;
  size?: PillSize;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the parent's width (default for `lg`). */
  block?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  lg: { height: 56, padding: 22, text: 16 },
  md: { height: 48, padding: 18, text: 15 },
  sm: { height: 36, padding: 12, text: 13 },
} as const;

export function Pill({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  loading,
  disabled,
  block,
  testID,
  style,
}: PillProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const s = SIZES[size];
  const colors = {
    primary: { bg: c.primary, fg: c.onPrimary, border: 'transparent' },
    secondary: { bg: c.surface2, fg: c.fg, border: c.border },
    ghost: { bg: 'transparent', fg: c.fg, border: 'transparent' },
    danger: { bg: c.bad, fg: '#FFFFFF', border: 'transparent' },
    inverse: { bg: c.fg, fg: c.bg, border: 'transparent' },
  }[variant];
  const inactive = disabled || loading;
  const stretch = block ?? size === 'lg';

  const pressTo = (to: number) => {
    scale.value = reduceMotion ? to : withTiming(to, { duration: motion.press.ms });
  };

  return (
    <Animated.View
      style={[pressStyle, stretch ? { alignSelf: 'stretch' } : { alignSelf: 'flex-start' }, style]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!inactive, busy: !!loading }}
        disabled={inactive}
        onPressIn={() => pressTo(motion.press.scale)}
        onPressOut={() => pressTo(1)}
        onPress={() => {
          haptic.selection();
          onPress?.();
        }}
        style={{
          minHeight: Math.max(s.height, 44),
          height: s.height < 44 ? undefined : s.height,
          paddingHorizontal: s.padding,
          borderRadius: radius.pill,
          backgroundColor: colors.bg,
          borderWidth: 1,
          borderColor: colors.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: disabled ? 0.4 : 1,
          ...(variant === 'primary'
            ? {
                shadowColor: c.primary,
                shadowOpacity: 0.6,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 10 },
                boxShadow: `0px 10px 30px -10px ${alpha(c.primary, 0.6)}`,
              }
            : null),
        }}
      >
        {/* The label keeps its width while the spinner shows. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: loading ? 0 : 1 }}>
          {Icon ? <Icon size={18} color={colors.fg} strokeWidth={2} /> : null}
          <Text
            maxFontSizeMultiplier={1.3}
            style={{
              fontFamily: size === 'lg' ? font.displayBold : font.bodyBold,
              fontSize: s.text,
              lineHeight: s.text * 1.25,
              letterSpacing: size === 'lg' ? s.text * -0.02 : 0,
              color: colors.fg,
            }}
          >
            {size === 'lg' ? label.toLowerCase() : label}
          </Text>
        </View>
        {loading ? <ActivityIndicator size={18} color={colors.fg} style={{ position: 'absolute' }} /> : null}
      </Pressable>
    </Animated.View>
  );
}
