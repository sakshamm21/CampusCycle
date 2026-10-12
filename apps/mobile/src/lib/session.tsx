import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getMyContext,
  signOut as apiSignOut,
  toAppError,
  type AppError,
  type MyContext,
} from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import { clearFix } from '@/lib/location';
import type { SessionStatus } from '@/lib/gate';

const PERMS_KEY = 'cc-perms-seen';

interface SessionValue {
  status: SessionStatus;
  ctx: MyContext | null;
  /** Set when the context could not be loaded (for example offline at launch). */
  error: AppError | null;
  uid: string | null;
  /** `null` until AsyncStorage has answered. */
  permsSeen: boolean | null;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
  markPermsSeen(): Promise<void>;
  /** True once, for the first signed-in route after launch (04 §1.2). */
  takeFirstRoute(): boolean;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  // undefined: the stored session has not been read yet.
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [permsSeen, setPermsSeen] = useState<boolean | null>(null);
  const firstRoute = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem(PERMS_KEY)
      .then((v) => setPermsSeen(v === '1'))
      .catch(() => setPermsSeen(false));

    db.auth
      .getSession()
      .then(({ data }) => setUid(data.session?.user.id ?? null))
      .catch(() => setUid(null));

    const { data } = db.auth.onAuthStateChange((event, session) => {
      setUid(session?.user.id ?? null);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        clearFix();
        void db.removeAllChannels();
      }
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const query = useQuery({
    queryKey: ['ctx'],
    queryFn: () => getMyContext(db),
    enabled: typeof uid === 'string',
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['ctx'] });
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await apiSignOut(db);
    } catch {
      // Offline: still drop the local session.
      await db.auth.signOut({ scope: 'local' });
    }
  }, []);

  const markPermsSeen = useCallback(async () => {
    setPermsSeen(true);
    await AsyncStorage.setItem(PERMS_KEY, '1');
  }, []);

  const takeFirstRoute = useCallback(() => {
    const first = firstRoute.current;
    firstRoute.current = false;
    return first;
  }, []);

  const value = useMemo<SessionValue>(() => {
    let status: SessionStatus;
    if (uid === undefined || permsSeen === null) status = 'loading';
    else if (uid === null) status = 'signedOut';
    else if (query.isPending) status = 'loading';
    else status = 'signedIn';

    return {
      status,
      ctx: query.data ?? null,
      error: query.data === undefined && query.error ? toAppError(query.error) : null,
      uid: uid ?? null,
      permsSeen,
      refresh,
      signOut,
      markPermsSeen,
      takeFirstRoute,
    };
  }, [
    uid,
    permsSeen,
    query.isPending,
    query.data,
    query.error,
    refresh,
    signOut,
    markPermsSeen,
    takeFirstRoute,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** For signed-in screens: the context is there, or the gate has already moved the rider away. */
export function useCtx(): MyContext | null {
  return useSession().ctx;
}
