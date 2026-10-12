import React from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { font } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface IconButtonProps {
  icon: LucideIcon;
  /** Read by screen readers. */
  label: string;
  onPress?: () => void;
  onLongPress?: () => void;
  badge?: number;
  /** Visual diameter. The tap target is never smaller than 44. */
  size?: number;
  /** Selected look: primary background. */
  active?: boolean;
  /** Plain icon without the circle. */
  bare?: boolean;
  /** Fixed colours for buttons drawn over the camera. */
  onDark?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({
  icon: Icon,
  label,
  onPress,
  onLongPress,
  badge,
  size = 44,
  active,
  bare,
  onDark,
  disabled,
  testID,
  style,
}: IconButtonProps) {
  const { c } = useTheme();
  const hit = Math.max(0, (44 - size) / 2);
  const bg = bare ? 'transparent' : onDark ? 'rgba(11,14,19,0.6)' : active ? c.primary : c.surface2;
  const fg = onDark ? '#F1F3F7' : active ? c.onPrimary : c.fg;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, selected: !!active }}
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={hit}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          borderWidth: bare || active ? 0 : 1,
          borderColor: onDark ? 'rgba(255,255,255,0.13)' : c.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Icon size={size >= 44 ? 20 : 16} color={fg} strokeWidth={2} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: c.bad,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: font.monoBold, fontSize: 10, lineHeight: 12, color: '#FFFFFF' }}>
            {badge > 9 ? '9+' : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
