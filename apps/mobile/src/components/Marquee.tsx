import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { en, font } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

interface BandProps {
  text: string;
  rotate: number;
  seconds: number;
  reverse?: boolean;
  background: string;
  color: string;
  mono?: boolean;
}

function Band({ text, rotate, seconds, reverse, background, color, mono }: BandProps) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion || width === 0) return;
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: seconds * 1000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [reduceMotion, width, seconds, progress]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: (reverse ? progress.value - 1 : -progress.value) * width }],
  }));

  const run = `${text} `.repeat(4);
  const textStyle = mono
    ? { fontFamily: font.monoMedium, fontSize: 11, letterSpacing: 1.5, color }
    : { fontFamily: font.display, fontSize: 18, letterSpacing: -0.6, color };

  return (
    <View
      style={{
        backgroundColor: background,
        paddingVertical: mono ? 7 : 9,
        marginHorizontal: -40,
        transform: [{ rotate: `${rotate}deg` }],
        overflow: 'hidden',
      }}
    >
      <Animated.View style={[{ flexDirection: 'row' }, slide]}>
        {/* Two copies, so the band is full while the first one slides out. */}
        {[0, 1].map((i) => (
          <Text
            key={i}
            numberOfLines={1}
            onLayout={i === 0 ? (e) => setWidth(e.nativeEvent.layout.width) : undefined}
            style={textStyle}
          >
            {mono ? run.toUpperCase() : run.toLowerCase()}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

/** Two tilted scrolling bands, used only on Welcome (06 §5.21). Decorative, so hidden from screen readers. */
export function Marquee() {
  const { c } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ gap: 6, marginVertical: 8 }}
    >
      <Band text={en.r01.marquee} rotate={-2.2} seconds={32} background={c.primary} color={c.onPrimary} />
      <Band text={en.r01.marquee_2} rotate={1.4} seconds={38} reverse background={c.fg} color={c.bg} mono />
    </View>
  );
}
