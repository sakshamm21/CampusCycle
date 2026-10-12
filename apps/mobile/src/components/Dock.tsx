import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CornerDownLeft, House, Map, Receipt, ScanLine, User, type LucideIcon } from 'lucide-react-native';
import { en, font, radius } from '@campuscycle/shared';
import { Text } from '@/components/Text';
import { IconButton } from '@/components/IconButton';
import { useTheme } from '@/theme/ThemeProvider';
import { alpha } from '@/theme/color';

export type DockTab = 'index' | 'map' | 'history' | 'profile';

export interface DockProps {
  active: DockTab;
  onTab(tab: DockTab): void;
  /** `null` hides the centre button (pass pending or suspended). */
  center: 'borrow' | 'return' | null;
  onCenter(): void;
}

const TABS: { tab: DockTab; icon: LucideIcon; label: string }[] = [
  { tab: 'index', icon: House, label: en.dock.home },
  { tab: 'map', icon: Map, label: en.dock.map },
  { tab: 'history', icon: Receipt, label: en.dock.history },
  { tab: 'profile', icon: User, label: en.dock.profile },
];

// The floating tab bar (06 §5.9).
export function Dock({ active, onTab, center, onCenter }: DockProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const CenterIcon = center === 'return' ? CornerDownLeft : ScanLine;

  const tab = (t: (typeof TABS)[number]) => (
    <IconButton
      key={t.tab}
      icon={t.icon}
      label={t.label}
      size={42}
      bare={active !== t.tab}
      active={active === t.tab}
      onPress={() => onTab(t.tab)}
      testID={`dock.${t.tab === 'index' ? 'home' : t.tab}`}
    />
  );

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 16, alignItems: 'center' }}
    >
      <View
        style={{
          height: 64,
          alignSelf: 'stretch',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 10,
          borderRadius: radius.pill,
          backgroundColor: alpha(c.raised, 0.85),
          borderWidth: 1,
          borderColor: c.border,
          elevation: 12,
          boxShadow: `0px 18px 40px -16px ${c.shadow}`,
        }}
      >
        {TABS.slice(0, 2).map(tab)}
        {center ? (
          <Pressable
            testID={`dock.${center}`}
            accessibilityRole="button"
            accessibilityLabel={en.dock[center]}
            onPress={onCenter}
            style={({ pressed }) => ({
              height: 52,
              paddingHorizontal: 20,
              borderRadius: radius.pill,
              backgroundColor: c.fg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <CenterIcon size={20} color={c.bg} strokeWidth={2} />
            <Text style={{ fontFamily: font.displayBold, fontSize: 15, letterSpacing: -0.3, color: c.bg }}>
              {en.dock[center]}
            </Text>
          </Pressable>
        ) : (
          <View style={{ width: 52, height: 52 }} />
        )}
        {TABS.slice(2).map(tab)}
      </View>
    </View>
  );
}
