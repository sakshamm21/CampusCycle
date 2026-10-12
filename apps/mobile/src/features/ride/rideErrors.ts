import { Linking } from 'react-native';
import type { useRouter } from 'expo-router';
import { en, type AppError, type ErrorCode } from '@campuscycle/shared';
import type { ErrorAction } from '@/components/States';

const BIKE_PROBLEMS: ErrorCode[] = [
  'CC_BIKE_NOT_AT_THIS_STAND',
  'CC_BIKE_IN_MAINTENANCE',
  'CC_BIKE_NOT_AVAILABLE',
];
const CODE_PROBLEMS: ErrorCode[] = ['CC_BAD_QR', 'CC_BAD_CODE', 'CC_BIKE_NOT_FOUND'];

// The actions offered under a borrow or return error (the table in 04 R12).
export function rideErrorActions(
  error: AppError,
  o: {
    router: ReturnType<typeof useRouter>;
    retry(): void;
    bikeCode?: string;
    scanMode: 'borrow' | 'return';
  },
): { primary: ErrorAction; secondary?: ErrorAction } {
  const tryAgain: ErrorAction = { label: en.r12.try_again, onPress: o.retry, testID: 'r12.try_again' };
  const scanAnother: ErrorAction = {
    label: en.r12.scan_another,
    onPress: () => o.router.replace(`/scan?mode=${o.scanMode}`),
    testID: 'r12.scan_another',
  };

  if (error.code === 'CC_NOT_AT_STAND') {
    return {
      primary: {
        label: en.r12.show_stands,
        onPress: () => o.router.replace('/(main)/map'),
        testID: 'r12.show_stands',
      },
      secondary: tryAgain,
    };
  }
  if (error.code === 'CC_LOCATION_DENIED') {
    return { primary: { label: en.common.open_settings, onPress: () => void Linking.openSettings() } };
  }
  if (BIKE_PROBLEMS.includes(error.code)) {
    return {
      primary: scanAnother,
      secondary: {
        label: en.r12.report_bike,
        onPress: () => o.router.replace(`/report?bike=${o.bikeCode ?? ''}`),
        testID: 'r12.report_bike',
      },
    };
  }
  if (error.code === 'CC_PASS_HAS_BIKE') {
    return {
      primary: { label: en.r12.go_ride, onPress: () => o.router.replace('/riding'), testID: 'r12.go_ride' },
    };
  }
  if (CODE_PROBLEMS.includes(error.code)) {
    return { primary: scanAnother, secondary: { label: en.r11.enter_code, onPress: scanAnother.onPress } };
  }
  return { primary: tryAgain };
}
