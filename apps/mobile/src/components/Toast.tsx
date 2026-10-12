import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable } from 'react-native';
import Animated, { FadeInUp, FadeOutUp, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CircleCheck, Info, TriangleAlert } from 'lucide-react-native';
import { Text } from '@/components/Text';
import { useTheme } from '@/theme/ThemeProvider';

export type ToastTone = 'ok' | 'info' | 'warn' | 'bad';

interface ToastValue {
  show(text: string, tone?: ToastTone): void;
}

const ToastContext = createContext<ToastValue>({ show: () => {} });
const HIDE_AFTER_MS = 3500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState<{ id: number; text: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((text: string, tone: ToastTone = 'info') => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setToast(null), HIDE_AFTER_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const value = useMemo(() => ({ show }), [show]);
  const Icon = toast?.tone === 'ok' ? CircleCheck : toast?.tone === 'info' ? Info : TriangleAlert;
  const iconColor = toast ? (toast.tone === 'info' ? c.primary : c[toast.tone]) : c.fg;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={reduceMotion ? undefined : FadeInUp.duration(180)}
          exiting={reduceMotion ? undefined : FadeOutUp.duration(180)}
          pointerEvents="box-none"
          style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 100 }}
        >
          <Pressable
            testID="toast"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            onPress={() => setToast(null)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              padding: 14,
              borderRadius: 14,
              backgroundColor: c.raised,
              borderWidth: 1,
              borderColor: c.border,
              elevation: 10,
              boxShadow: `0px 18px 40px -16px ${c.shadow}`,
            }}
          >
            <Icon size={18} color={iconColor} strokeWidth={2} />
            <Text variant="body" style={{ flex: 1 }}>
              {toast.text}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  return useContext(ToastContext);
}
