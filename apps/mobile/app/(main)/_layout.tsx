import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Dock, type DockTab } from '@/components/Dock';
import { useSession } from '@/lib/session';
import { passDisplayState } from '@/features/pass/passState';
import { useTheme } from '@/theme/ThemeProvider';

// The four tab screens with the floating Dock in place of the default tab bar (04 §2).
export default function MainLayout() {
  const { c } = useTheme();
  const { ctx } = useSession();
  const router = useRouter();

  const state = ctx ? passDisplayState(ctx) : 'pending';
  const center =
    state === 'riding' || state === 'overdue'
      ? 'return'
      : state === 'ready' || state === 'minting'
        ? 'borrow'
        : null;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state: nav, navigation }) => (
        <Dock
          active={(nav.routes[nav.index]?.name ?? 'index') as DockTab}
          onTab={(tab) => navigation.navigate(tab)}
          center={center}
          onCenter={() => router.push(center === 'return' ? '/return' : '/scan?mode=borrow')}
        />
      )}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="map" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
