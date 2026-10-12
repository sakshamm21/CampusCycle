import { Platform } from 'react-native';
import { CameraView } from 'expo-camera';

const SCAN_COOLDOWN_MS = 1500;

/** Returns a function that is true at most once per 1500 ms, so one sticker gives one scan (04 §1.6). */
export function createScanGuard(now: () => number = Date.now): () => boolean {
  let last = -Infinity;
  return () => {
    const t = now();
    if (t - last < SCAN_COOLDOWN_MS) return false;
    last = t;
    return true;
  };
}

/** Native always has a camera; a browser may not. */
export async function cameraAvailable(): Promise<boolean> {
  if (Platform.OS !== 'web') return true;
  try {
    return await CameraView.isAvailableAsync();
  } catch {
    return false;
  }
}
