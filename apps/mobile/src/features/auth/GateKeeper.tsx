import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSegments } from 'expo-router';
import { attachReturnPhoto } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { gate } from '@/lib/gate';
import { useSession } from '@/lib/session';
import { flushQueue } from '@/lib/queue';
import { uploadLocalPhoto } from '@/lib/photos';
import { configureForegroundPush, registerPush, routeForPush } from '@/lib/push';
import { useToast } from '@/components/Toast';
import { useTheme } from '@/theme/ThemeProvider';

/** Routes a signed-out visitor may see. */
const AUTH_ROUTES = new Set(['welcome', 'sign-in', 'forgot', 'sign-up']);
/** Routes that belong to one gate result each; everything else is the signed-in app. */
const GATED_ROUTES = new Set(['permissions', 'pending', 'blocked']);

// Applies the routing gate (04 §1.2) on every change of session or context, from one place.
export function GateKeeper() {
  const { status, ctx, error, permsSeen, signOut, takeFirstRoute } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const first = segments[0] as string | undefined;

  useEffect(() => {
    // An unloaded context (offline at launch) is not a missing profile: `app/index` offers a retry.
    if (status === 'loading' || error) return;
    const here = first ?? 'index';
    // The component gallery is open to anyone in a development build, and absent from release builds.
    if (__DEV__ && here === 'dev') return;
    const zone = gate({ status, ctx, permsSeen: permsSeen === true, firstRoute: false });
    if (!zone) return;

    if (zone.signOut) {
      void signOut();
      return;
    }

    const target = zone.route.split('?')[0]!.slice(1);
    let ok: boolean;
    if (zone.route === '/welcome') ok = AUTH_ROUTES.has(here);
    else if (zone.route === '/(main)')
      ok = here !== 'index' && !AUTH_ROUTES.has(here) && !GATED_ROUTES.has(here);
    else ok = here === target;
    if (ok) return;

    if (zone.route === '/(main)') {
      // Entering the app: an unfinished ride opens Riding, but only on the first route since launch.
      const entry = gate({ status, ctx, permsSeen: true, firstRoute: takeFirstRoute() });
      router.replace(entry?.route === '/riding' ? '/riding' : '/(main)');
    } else {
      takeFirstRoute();
      router.replace(zone.route);
    }
  }, [status, ctx, error, permsSeen, first, router, signOut, takeFirstRoute]);

  return null;
}

// Work that follows the session: realtime, push, the photo queue and the saved theme.
export function SessionEffects() {
  const { uid, ctx, refresh } = useSession();
  const queryClient = useQueryClient();
  const toast = useToast();
  const { syncTheme, themePreference } = useTheme();
  const router = useRouter();

  // Realtime channel me:<uid> (03 §3.7): every change only invalidates queries.
  useEffect(() => {
    if (!uid) return;
    const channel = db
      .channel(`me:${uid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'rider_passes', filter: `rider_id=eq.${uid}` },
        () => {
          void refresh();
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        (payload) => {
          void queryClient.invalidateQueries({ queryKey: ['notifications'] });
          void refresh();
          const title = (payload.new as { title?: unknown }).title;
          if (typeof title === 'string' && title) toast.show(title, 'info');
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [uid, refresh, queryClient, toast]);

  // The theme saved on the profile wins over the one stored on this device.
  const savedTheme = ctx?.profile.theme;
  useEffect(() => {
    if (savedTheme && savedTheme !== themePreference) syncTheme(savedTheme);
    // Only when the profile's value changes, not when the rider picks a theme locally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTheme]);

  // Push token, once signed in.
  useEffect(() => {
    void configureForegroundPush();
  }, []);
  useEffect(() => {
    if (uid) void registerPush(db);
  }, [uid]);

  // Return photos that failed to upload: retry on start, on foreground and when the network returns.
  useEffect(() => {
    if (!uid) return;
    const flush = () =>
      void flushQueue({
        upload: (uri) => uploadLocalPhoto(db, 'return-photos', uid, uri),
        attach: (rideId, path) => attachReturnPhoto(db, rideId, path),
      });
    flush();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        flush();
        void refresh();
      }
    });
    const net = NetInfo.addEventListener((state) => {
      if (state.isConnected) flush();
    });
    return () => {
      app.remove();
      net();
    };
  }, [uid, refresh]);

  // A tapped push opens its screen (04 §1.8).
  useEffect(() => {
    let remove: (() => void) | undefined;
    let active = true;
    void (async () => {
      if (Platform.OS === 'web') return;
      const Notifications = await import('expo-notifications');
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const route = routeForPush(response.notification.request.content.data);
        if (route) router.push(route);
        else void refresh();
      });
      if (active) remove = () => subscription.remove();
      else subscription.remove();
    })();
    return () => {
      active = false;
      remove?.();
    };
  }, [router, refresh]);

  return null;
}
