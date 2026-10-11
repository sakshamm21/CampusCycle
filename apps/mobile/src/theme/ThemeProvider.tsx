import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colorScheme } from 'nativewind';
import { palette } from '@campuscycle/shared';

type ThemeMode = 'system' | 'dark' | 'day';
type ResolvedTheme = 'dark' | 'day';

interface ThemeContextType {
  mode: ResolvedTheme;
  themePreference: ThemeMode;
  c: typeof palette.dark | typeof palette.day;
  setTheme: (t: ThemeMode) => Promise<void>;
}

const STORAGE_KEY = 'cc-theme';

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  themePreference: 'system',
  c: palette.dark,
  setTheme: async () => {},
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

  const setTheme = async (t: ThemeMode) => {
    setThemePreference(t);
    await AsyncStorage.setItem(STORAGE_KEY, t);
  };

  const c = resolvedMode === 'day' ? palette.day : palette.dark;

  return (
    <ThemeContext.Provider value={{ mode: resolvedMode, themePreference, c, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
