import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Haptics do nothing on the web, and a failed buzz must never break a tap.
function run(fn: () => Promise<void>): void {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

export const haptic = {
  selection: () => run(() => Haptics.selectionAsync()),
  medium: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
