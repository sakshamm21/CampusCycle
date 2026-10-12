import React, { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Text, type TextTone } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export interface KickerProps {
  text: string;
  /** Leading live dot with a ping. */
  live?: boolean;
  tone?: TextTone;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Kicker({ text, live, tone = 'muted', style, testID }: KickerProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const ping = useSharedValue(0);

  useEffect(() => {
    if (!live || reduceMotion) return;
    ping.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
  }, [live, reduceMotion, ping]);

  const pingStyle = useAnimatedStyle(() => ({
    opacity: 0.6 * (1 - ping.value),
    transform: [{ scale: 1 + ping.value * 1.6 }],
  }));

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8 }, style]}>
      {live ? (
        <View style={{ width: 8, height: 8 }}>
          <Animated.View
            style={[
              { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: c.ok },
              pingStyle,
            ]}
          />
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.ok }} />
        </View>
      ) : null}
      <Text variant="label" tone={tone} testID={testID} style={{ flexShrink: 1 }}>
        {text}
      </Text>
    </View>
  );
}
