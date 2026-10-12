'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { supabase } from '@/lib/supabase/browser';
import { CollegeProvider, type CollegeLite } from '@/lib/scope';
import { RealtimeBridge } from '@/lib/realtime';
import { updateMyProfile } from '@campuscycle/shared';
import type { MyContext } from '@campuscycle/shared';

export type ThemeMode = 'dark' | 'day' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
  initialTheme = 'dark',
}: {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
}) {
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    updateMyProfile(supabase, { theme: t }).catch((err) => {
      console.error('Failed to update theme preference:', err);
    });
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export function Providers({
  children,
  ctx,
  initialColleges,
  initialCollegeId,
}: {
  children: React.ReactNode;
  ctx: MyContext;
  initialColleges?: CollegeLite[];
  initialCollegeId?: string;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const initialTheme: ThemeMode =
    ctx.profile.theme === 'day' || ctx.profile.theme === 'system' ? ctx.profile.theme : 'dark';

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initialTheme={initialTheme}>
        <CollegeProvider ctx={ctx} initialColleges={initialColleges} initialCollegeId={initialCollegeId}>
          <RealtimeBridge ctx={ctx} />
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              className: 'font-sans text-sm',
            }}
          />
        </CollegeProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
