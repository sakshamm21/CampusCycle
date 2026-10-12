import '../global.css';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { font } from '@campuscycle/shared';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { SessionProvider, useSession } from '@/lib/session';
import { ReturnFlowProvider } from '@/features/ride/ReturnFlowProvider';
import { GateKeeper, SessionEffects } from '@/features/auth/GateKeeper';
import { ToastProvider } from '@/components/Toast';
import { Grain } from '@/components/Grain';

void SplashScreen.preventAutoHideAsync();

function App({ fontsReady }: { fontsReady: boolean }) {
  const { mode, c } = useTheme();
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!fontsReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={mode === 'day' ? 'dark' : 'light'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="(main)" options={{ animation: 'fade' }} />
        <Stack.Screen name="permissions" options={{ gestureEnabled: false }} />
        <Stack.Screen name="pending" options={{ gestureEnabled: false }} />
        <Stack.Screen name="blocked" options={{ gestureEnabled: false }} />
        <Stack.Screen name="scan" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
      <Grain />
      <GateKeeper />
      <SessionEffects />
    </View>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: true } },
      }),
  );
  const [fontsLoaded, fontError] = useFonts({
    [font.display]: require('../assets/fonts/ArchivoExpanded-Black.ttf'),
    [font.displayBold]: require('../assets/fonts/ArchivoExpanded-ExtraBold.ttf'),
    [font.numeric]: require('../assets/fonts/ArchivoCondensed-Black.ttf'),
    [font.accent]: require('../assets/fonts/Fraunces-Italic.ttf'),
    [font.body]: require('../assets/fonts/Figtree-Regular.ttf'),
    [font.bodyMedium]: require('../assets/fonts/Figtree-Medium.ttf'),
    [font.bodySemibold]: require('../assets/fonts/Figtree-SemiBold.ttf'),
    [font.bodyBold]: require('../assets/fonts/Figtree-Bold.ttf'),
    [font.mono]: require('../assets/fonts/MartianMono-Regular.ttf'),
    [font.monoMedium]: require('../assets/fonts/MartianMono-Medium.ttf'),
    [font.monoBold]: require('../assets/fonts/MartianMono-Bold.ttf'),
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <SessionProvider>
              <ReturnFlowProvider>
                <ToastProvider>
                  <App fontsReady={fontsLoaded || !!fontError} />
                </ToastProvider>
              </ReturnFlowProvider>
            </SessionProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
