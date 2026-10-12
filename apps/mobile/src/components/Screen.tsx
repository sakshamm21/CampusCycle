import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { en } from '@campuscycle/shared';
import { Glow } from '@/components/Glow';
import { IconButton } from '@/components/IconButton';
import { Kicker } from '@/components/Kicker';
import { DemoBanner, OfflineBanner } from '@/components/Banner';
import { useTheme } from '@/theme/ThemeProvider';

export interface ScreenProps {
  children: React.ReactNode;
  /** Common header: back button, optional kicker title and right action (04 §2). */
  header?: { title?: string; right?: React.ReactNode; onBack?: () => void; hideBack?: boolean };
  /** Pinned under the scroll area, above the safe area. */
  footer?: React.ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Extra bottom space for the floating dock on tab screens. */
  dock?: boolean;
  /** Banners for signed-in screens. */
  banners?: boolean;
  testID?: string;
  contentStyle?: StyleProp<ViewStyle>;
}

export const DOCK_SPACE = 96;

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  onRefresh,
  refreshing = false,
  dock,
  banners = true,
  testID,
  contentStyle,
}: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const back = () => {
    if (header?.onBack) header.onBack();
    else if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const padding: ViewStyle = {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: (footer ? 16 : 16 + insets.bottom) + (dock ? DOCK_SPACE : 0),
    gap: 12,
  };

  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: c.bg }}>
      <Glow />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingTop: insets.top }}
      >
        {banners ? (
          <>
            <OfflineBanner />
            <DemoBanner />
          </>
        ) : null}
        {header ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 16,
              paddingTop: 8,
              minHeight: 52,
            }}
          >
            {header.hideBack ? null : (
              <IconButton icon={ChevronLeft} label={en.common.back} onPress={back} testID="common.back" />
            )}
            <View style={{ flex: 1 }}>{header.title ? <Kicker text={header.title} /> : null}</View>
            {header.right}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[padding, { flexGrow: 1 }, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={c.primary}
                  colors={[c.primary]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[padding, { flex: 1 }, contentStyle]}>{children}</View>
        )}
        {footer ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 + insets.bottom, gap: 8 }}>
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}
