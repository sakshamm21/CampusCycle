import React, { useEffect, useState } from 'react';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { radius } from '@campuscycle/shared';
import { useTheme } from '@/theme/ThemeProvider';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  aspectRatio?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({
  width = '100%',
  height = 20,
  aspectRatio,
  round = radius.md,
  style,
}: SkeletonProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) return;
    opacity.value = withRepeat(withTiming(0.5, { duration: 600 }), -1, true);
  }, [reduceMotion, opacity]);

  const shimmer = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height: aspectRatio ? undefined : height,
          aspectRatio,
          borderRadius: round,
          backgroundColor: c.surface2,
        },
        shimmer,
        style,
      ]}
    />
  );
}

/** True 150 ms after loading starts, so quick loads never flash a skeleton (01 §12). */
export function useDelayedLoading(loading: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(timer);
  }, [loading]);
  return loading && show;
}
