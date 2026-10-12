import React, { useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { BlurMask, Canvas, RoundedRect } from '@shopify/react-native-skia';
import { useIsFocused } from 'expo-router';
import { palette } from '@campuscycle/shared';
import { useNow } from '@/hooks/useNow';
import { useTheme } from '@/theme/ThemeProvider';
import { PassBackground } from './PassBackground';
import { PassFront } from './PassFront';
import { PassBack } from './PassBack';
import { useTilt } from './useTilt';
import { usePassAnimations } from './usePassAnimations';
import { PASS_ASPECT, passColors, passText, type RiderPassProps } from './types';

const GLOW_PAD = 40;

// The Rider Pass on Android and iOS (06 §6.6).
export function RiderPass(props: RiderPassProps) {
  const { state, finish, interactive, onFlip, testID } = props;
  const { c } = useTheme();
  const screen = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const focused = useIsFocused();
  const [flipped, setFlipped] = useState(false);

  const width = props.width ?? Math.min(440, screen.width - 32);
  const height = width / PASS_ASPECT;
  const u = width / 100;
  const live = state === 'riding' || state === 'overdue';
  const now = useNow(1000, live || flipped || state === 'pending');

  const tilt = useTilt(!!interactive && focused && !reduceMotion);
  const anim = usePassAnimations({
    state,
    width,
    tilt,
    sway: (!!interactive || !!props.sway) && focused,
    dock: !!props.dock,
    levelUp: !!props.levelUpTo && props.levelUpTo !== finish,
    onMinted: props.onMinted,
  });

  const colors = passColors(finish);
  const text = passText(props, now);
  const glowColor = state === 'overdue' ? c.warn : c.primary;

  const flip = () => {
    if (!interactive) return;
    const next = !flipped;
    setFlipped(next);
    anim.toggleFlip(next);
    onFlip?.(next);
  };

  const face = { width, height, borderRadius: 6 * u, overflow: 'hidden' as const };
  const background = (
    <PassBackground
      width={width}
      height={height}
      finish={finish}
      nextFinish={props.levelUpTo}
      mix={anim.levelMix}
      shineX={anim.shineX}
      shineY={anim.shineY}
      dimmed={state === 'pending'}
    />
  );

  return (
    <View testID={testID} style={{ width, height, alignSelf: 'center' }}>
      {live ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', left: -GLOW_PAD, top: -GLOW_PAD }, anim.glowStyle]}
        >
          <Canvas style={{ width: width + GLOW_PAD * 2, height: height + GLOW_PAD * 2 }}>
            <RoundedRect
              x={GLOW_PAD + width * 0.06}
              y={GLOW_PAD + height * 0.06}
              width={width * 0.88}
              height={height * 0.88}
              r={8 * u}
              color={glowColor}
            >
              <BlurMask blur={28} style="normal" />
            </RoundedRect>
          </Canvas>
        </Animated.View>
      ) : null}

      <Animated.View style={[{ width, height }, anim.cardStyle]}>
        <Pressable
          accessible
          accessibilityRole={interactive ? 'button' : 'image'}
          accessibilityLabel={text.a11y}
          accessibilityActions={interactive ? [{ name: 'activate' }] : undefined}
          onAccessibilityAction={flip}
          onPress={flip}
          disabled={!interactive}
          testID={testID ? `${testID}.card` : undefined}
          style={{ width, height }}
        >
          <Animated.View
            pointerEvents={flipped ? 'none' : 'auto'}
            style={[StyleSheet.absoluteFill, face, anim.frontStyle]}
          >
            {background}
            <Animated.View style={[{ height, overflow: 'hidden' }, anim.revealStyle]}>
              <View style={{ width, height }}>
                <PassFront
                  pass={props}
                  u={u}
                  colors={colors}
                  now={now}
                  chipStyle={anim.chipStyle}
                  stampStyle={anim.stampStyle}
                />
              </View>
            </Animated.View>
            {state === 'minting' ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  {
                    position: 'absolute',
                    top: -height * 0.2,
                    width: width * 0.24,
                    height: height * 1.4,
                    backgroundColor: 'rgba(255,255,255,0.75)',
                  },
                  anim.sweepStyle,
                ]}
              />
            ) : null}
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 6 * u, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
              ]}
            />
          </Animated.View>

          <Animated.View
            pointerEvents={flipped ? 'auto' : 'none'}
            style={[StyleSheet.absoluteFill, face, { transform: [{ rotateY: '180deg' }] }, anim.backStyle]}
          >
            {background}
            <PassBack pass={props} u={u} colors={colors} now={now} />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { borderRadius: 6 * u, borderWidth: 1, borderColor: palette.pass.line },
              ]}
            />
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}
