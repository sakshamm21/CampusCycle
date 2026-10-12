import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { ArrowRight } from 'lucide-react-native';
import { font, motion, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';
import { haptic } from '@/lib/haptics';

export interface SlideToConfirmProps {
  label: string;
  onConfirm(): void;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}

const TRACK = 58;
const THUMB = 50;
const INSET = 4;

export function SlideToConfirm({ label, onConfirm, loading, disabled, testID }: SlideToConfirmProps) {
  const { c } = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const fired = useRef(false);
  const max = Math.max(0, width - THUMB - INSET * 2);
  const inactive = disabled || loading;

  const settle = (to: number) => {
    x.value = reduceMotion ? to : withSpring(to, motion.spring);
  };

  const confirm = () => {
    if (fired.current) return;
    fired.current = true;
    haptic.heavy();
    onConfirm();
    // The parent shows `loading` or leaves the screen; allow another try if neither happens.
    setTimeout(() => {
      fired.current = false;
    }, 1000);
  };

  // When loading ends without leaving the screen (an error), the thumb goes back to the start.
  useEffect(() => {
    if (!loading) x.value = 0;
  }, [loading, x]);

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(!inactive)
    .onUpdate((e) => {
      x.value = Math.min(max, Math.max(0, e.translationX));
    })
    .onEnd(() => {
      if (max > 0 && x.value >= max * 0.85) {
        settle(max);
        confirm();
      } else {
        settle(0);
      }
    });

  const thumbStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const fillStyle = useAnimatedStyle(() => ({ width: x.value + THUMB + INSET }));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'activate' && !inactive) confirm();
      }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        height: TRACK,
        borderRadius: radius.pill,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: c.border,
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            borderRadius: radius.pill,
            backgroundColor: alpha(c.primary, 0.22),
          },
          fillStyle,
        ]}
      />
      <Text
        style={{
          fontFamily: font.display,
          fontSize: 16,
          letterSpacing: -0.3,
          color: c.muted,
          textAlign: 'center',
          paddingLeft: 40,
        }}
      >
        {label.toLowerCase()}
      </Text>
      <GestureDetector gesture={pan}>
        <Animated.View
          testID={testID ? `${testID}.thumb` : undefined}
          style={[
            {
              position: 'absolute',
              left: INSET,
              width: THUMB,
              height: THUMB,
              borderRadius: THUMB / 2,
              backgroundColor: c.primary,
              alignItems: 'center',
              justifyContent: 'center',
            },
            thumbStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator size={18} color={c.onPrimary} />
          ) : (
            <ArrowRight size={20} color={c.onPrimary} strokeWidth={2.5} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
