import { useEffect } from 'react';
import { DeviceMotion } from 'expo-sensors';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';

const ALPHA = 0.15;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const deg = (rad: number) => (rad * 180) / Math.PI;

export interface Tilt {
  /** Degrees. Zero while the phone is held still at the angle it had when the screen opened. */
  rx: SharedValue<number>;
  ry: SharedValue<number>;
}

// Device tilt for the pass (06 §6.5): 60 Hz, low-passed, relative to the angle at focus.
export function useTilt(enabled: boolean): Tilt {
  const rx = useSharedValue(0);
  const ry = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      rx.value = 0;
      ry.value = 0;
      return;
    }
    let beta0: number | null = null;
    let active = true;
    let subscription: { remove(): void } | undefined;

    DeviceMotion.isAvailableAsync()
      .then((available) => {
        if (!available || !active) return;
        DeviceMotion.setUpdateInterval(16);
        subscription = DeviceMotion.addListener(({ rotation }) => {
          if (!rotation) return;
          const beta = deg(rotation.beta);
          const gamma = deg(rotation.gamma);
          if (beta0 === null) beta0 = beta;
          const targetX = clamp((beta - beta0) * 0.35, -10, 10);
          const targetY = clamp(gamma * 0.45, -12, 12);
          rx.value += (targetX - rx.value) * ALPHA;
          ry.value += (targetY - ry.value) * ALPHA;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, rx, ry]);

  return { rx, ry };
}
