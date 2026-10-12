import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { palette, updateMyProfile } from '@campuscycle/shared';
import { db } from '@/lib/supabase';

export type ThemeMode = 'system' | 'dark' | 'day';
type ResolvedTheme = 'dark' | 'day';
export type Colors = typeof palette.dark | typeof palette.day;

interface ThemeContextType {
  mode: ResolvedTheme;
  themePreference: ThemeMode;
  c: Colors;
  setTheme: (t: ThemeMode) => Promise<void>;
  /** Applies the theme saved on the profile without writing it back. */
  syncTheme: (t: ThemeMode) => void;
}

const STORAGE_KEY = 'cc-theme';

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  themePreference: 'system',
  c: palette.dark,
  setTheme: async () => {},
  syncTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useDeviceColorScheme();
  const [themePreference, setThemePreference] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'dark' || stored === 'day' || stored === 'system') {
        setThemePreference(stored);
      }
    });
  }, []);

  const resolvedMode: ResolvedTheme =
    themePreference === 'system' ? (deviceScheme === 'light' ? 'day' : 'dark') : themePreference;

  useEffect(() => {
    colorScheme.set(resolvedMode === 'day' ? 'light' : 'dark');
  }, [resolvedMode]);

  const syncTheme = useCallback((t: ThemeMode) => {
    setThemePreference(t);
    AsyncStorage.setItem(STORAGE_KEY, t).catch(() => {});
  }, []);

  const setTheme = useCallback(async (t: ThemeMode) => {
    setThemePreference(t);
    await AsyncStorage.setItem(STORAGE_KEY, t);
    const { data } = await db.auth.getSession();
    if (data.session) {
      // The choice already applies on this device; saving it to the profile can fail quietly.
      updateMyProfile(db, { theme: t }).catch(() => {});
    }
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      mode: resolvedMode,
      themePreference,
      c: resolvedMode === 'day' ? palette.day : palette.dark,
      setTheme,
      syncTheme,
    }),
    [resolvedMode, themePreference, setTheme, syncTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
