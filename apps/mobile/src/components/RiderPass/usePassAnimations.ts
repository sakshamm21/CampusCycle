import { useEffect, useRef } from 'react';
import {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { haptic } from '@/lib/haptics';
import type { PassState } from '@/features/pass/passState';
import type { Tilt } from './useTilt';

interface Options {
  state: PassState;
  /** Card width in px. */
  width: number;
  tilt: Tilt;
  sway: boolean;
  dock: boolean;
  levelUp: boolean;
  onMinted?(): void;
}

const MINT_MS = 1300;

// Every motion of the pass, with the exact timings of 06 §6.5. With reduce motion on, each one jumps to its end.
export function usePassAnimations({ state, width, tilt, sway, dock, levelUp, onMinted }: Options) {
  const reduceMotion = useReducedMotion();
  const u = width / 100;

  const swayT = useSharedValue(0.5);
  const flip = useSharedValue(0);
  const mint = useSharedValue(state === 'minting' ? 0 : 1);
  const dockT = useSharedValue(1);
  const thunkT = useSharedValue(0);
  const stampT = useSharedValue(state === 'returned' ? 0 : 1);
  const glow = useSharedValue(0);
  const levelMix = useSharedValue(0);

  // Idle sway: 7 s there and back.
  useEffect(() => {
    if (!sway || reduceMotion) {
      cancelAnimation(swayT);
      swayT.value = 0.5;
      return;
    }
    swayT.value = 0;
    swayT.value = withRepeat(withTiming(1, { duration: 3500, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(swayT);
  }, [sway, reduceMotion, swayT]);

  // Mint: reveal left to right, success haptic at 0.9 s.
  const minted = useRef(onMinted);
  minted.current = onMinted;
  useEffect(() => {
    if (state !== 'minting') {
      mint.value = 1;
      return;
    }
    const ms = reduceMotion ? 0 : MINT_MS;
    mint.value = 0;
    mint.value = withTiming(1, { duration: ms, easing: Easing.bezier(0.6, 0, 0.2, 1) });
    const buzz = setTimeout(haptic.success, reduceMotion ? 0 : 900);
    const done = setTimeout(() => minted.current?.(), ms + 50);
    return () => {
      clearTimeout(buzz);
      clearTimeout(done);
    };
  }, [state, reduceMotion, mint]);

  // Dock: the bike chip drops in and the card takes the hit.
  useEffect(() => {
    if (!dock) return;
    if (reduceMotion) {
      haptic.heavy();
      return;
    }
    dockT.value = 0;
    dockT.value = withTiming(1, { duration: 800, easing: Easing.linear });
    thunkT.value = 0;
    thunkT.value = withDelay(450, withTiming(1, { duration: 500, easing: Easing.linear }));
    const buzz = setTimeout(haptic.heavy, 450);
    return () => clearTimeout(buzz);
  }, [dock, reduceMotion, dockT, thunkT]);

  // Stamp on return, then the level-up cross-fade.
  useEffect(() => {
    if (state !== 'returned') return;
    stampT.value = 0;
    stampT.value = withTiming(1, {
      duration: reduceMotion ? 0 : 550,
      easing: Easing.bezier(0.3, 1.5, 0.5, 1),
    });
    const buzz = setTimeout(haptic.medium, reduceMotion ? 0 : 300);
    let level: ReturnType<typeof setTimeout> | undefined;
    if (levelUp) {
      levelMix.value = withDelay(
        reduceMotion ? 0 : 550,
        withTiming(1, { duration: reduceMotion ? 0 : 1000 }),
      );
      level = setTimeout(haptic.success, reduceMotion ? 0 : 550);
    }
    return () => {
      clearTimeout(buzz);
      clearTimeout(level);
    };
  }, [state, levelUp, reduceMotion, stampT, levelMix]);

  // Riding glow: breathes between 0.55 and 0.25.
  const glowing = state === 'riding' || state === 'overdue';
  useEffect(() => {
    cancelAnimation(glow);
    if (!glowing) {
      glow.value = 0;
      return;
    }
    glow.value = 0.55;
    if (!reduceMotion) {
      glow.value = withRepeat(
        withTiming(0.25, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    }
  }, [glowing, reduceMotion, glow]);

  // The sway fades out while the phone is being tilted.
  const swayWeight = useDerivedValue(() => {
    const moving = Math.min(1, (Math.abs(tilt.rx.value) + Math.abs(tilt.ry.value)) / 3);
    return sway ? 1 - moving : 0;
  });
  const rotX = useDerivedValue(() => tilt.rx.value + (3 - 5 * swayT.value) * swayWeight.value);
  const rotY = useDerivedValue(() => tilt.ry.value + (-8 + 16 * swayT.value) * swayWeight.value);
  const shineX = useDerivedValue(
    () => 0.5 + tilt.ry.value * 0.025 + (swayT.value - 0.5) * 0.56 * swayWeight.value,
  );
  const shineY = useDerivedValue(() => 0.5 - tilt.rx.value * 0.025);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { translateY: interpolate(thunkT.value, [0, 0.25, 0.6, 1], [0, 2.4 * u, -0.8 * u, 0]) },
      { scale: interpolate(thunkT.value, [0, 0.25, 1], [1, 0.985, 1]) },
      { rotateX: `${rotX.value}deg` },
      { rotateY: `${rotY.value + flip.value}deg` },
    ],
  }));
  // Faces swap at 90°: backfaceVisibility is unreliable on Android.
  const frontStyle = useAnimatedStyle(() => ({ opacity: flip.value < 90 ? 1 : 0 }));
  const backStyle = useAnimatedStyle(() => ({ opacity: flip.value < 90 ? 0 : 1 }));
  const revealStyle = useAnimatedStyle(() => ({ width: width * mint.value }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: mint.value < 0.85 ? 1 : interpolate(mint.value, [0.85, 1], [1, 0]),
    transform: [
      { translateX: interpolate(mint.value, [0, 1], [width * 1.1, -width * 0.6]) },
      { skewX: '-10deg' },
    ],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dockT.value, [0, 0.55], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          dockT.value,
          [0, 0.55, 0.75, 1],
          [-2.6 * 11 * u, 0.08 * 11 * u, -0.04 * 11 * u, 0],
        ),
      },
      { scale: interpolate(dockT.value, [0, 0.55, 0.75, 1], [1.8, 0.94, 1.02, 1]) },
      { rotate: `${interpolate(dockT.value, [0, 0.55], [-8, 0], Extrapolation.CLAMP)}deg` },
    ],
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stampT.value),
    transform: [
      { scale: interpolate(stampT.value, [0, 1], [2.4, 1]) },
      { rotate: `${interpolate(stampT.value, [0, 1], [4, -10])}deg` },
    ],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));

  const toggleFlip = (to: boolean) => {
    haptic.selection();
    flip.value = withTiming(to ? 180 : 0, {
      duration: reduceMotion ? 0 : 900,
      easing: Easing.bezier(0.25, 1.3, 0.45, 1),
    });
  };

  return {
    shineX,
    shineY,
    levelMix,
    cardStyle,
    frontStyle,
    backStyle,
    revealStyle,
    sweepStyle,
    chipStyle,
    stampStyle,
    glowStyle,
    toggleFlip,
  };
}
