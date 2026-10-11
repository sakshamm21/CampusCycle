import React, { useEffect } from 'react';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { font } from '@campuscycle/shared';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider.tsx';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { mode } = useTheme();

  return (
    <>
      <StatusBar style={mode === 'day' ? 'dark' : 'light'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
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

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}
