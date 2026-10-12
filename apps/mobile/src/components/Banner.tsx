import React from 'react';
import { View } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { en } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';
import { useSession } from '@/lib/session';

export interface BannerProps {
  text: string;
  tone: 'warn' | 'primary' | 'bad' | 'ok';
  testID?: string;
}

export function Banner({ text, tone, testID }: BannerProps) {
  const { c } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{ backgroundColor: alpha(c[tone], 0.14), paddingVertical: 8, paddingHorizontal: 16 }}
    >
      <Text variant="bodyS" style={{ color: tone === 'primary' ? c.fg : c[tone], textAlign: 'center' }}>
        {text}
      </Text>
    </View>
  );
}

/** False only when NetInfo is sure there is no internet. */
export function useOnline(): boolean {
  const net = useNetInfo();
  return !(net.isConnected === false || net.isInternetReachable === false);
}

export function OfflineBanner() {
  return useOnline() ? null : <Banner testID="common.offline" tone="warn" text={en.common.offline} />;
}

export function DemoBanner() {
  const { ctx } = useSession();
  return ctx?.profile.is_demo ? (
    <Banner testID="common.demo_banner" tone="primary" text={en.common.demo_banner} />
  ) : null;
}
