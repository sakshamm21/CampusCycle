import { useQuery } from '@tanstack/react-query';
import { en, getMyPassQr, getPassStats, type Finish, type MyContext } from '@campuscycle/shared';
import { db } from '@/lib/supabase';
import type { RiderPassProps } from '@/components/RiderPass';
import type { PassState } from './passState';

/** The card's props from the rider's context. */
export function passProps(ctx: MyContext, state: PassState): RiderPassProps {
  return {
    state,
    finish: ctx.pass.finish,
    name: ctx.profile.full_name,
    collegeShort: ctx.college?.short_code ?? '',
    passLabel: ctx.pass.label,
    rides: ctx.pass.total_rides,
    bikeCode: ctx.ride?.bike_code,
    fromStand: ctx.ride?.start_stand_name,
    startedAt: ctx.ride?.started_at,
    dueAt: ctx.ride?.due_at,
    appliedAt: ctx.profile.applied_at,
    suspendedReason: ctx.profile.suspended_reason,
  };
}

export function firstName(ctx: MyContext): string {
  return ctx.profile.full_name.trim().split(/\s+/)[0] ?? '';
}

export function finishName(finish: Finish): string {
  return en.pass[`finish_${finish}`];
}

export function usePassStats(enabled = true) {
  return useQuery({ queryKey: ['passStats'], queryFn: () => getPassStats(db), enabled });
}

// The pass QR lives 30 s: fetched when the back of the card shows and again 1 s before it expires.
// It stays in memory only (gcTime 0), never on disk (06 §6.4).
export function usePassQr(enabled: boolean) {
  const query = useQuery({
    queryKey: ['passQr'],
    queryFn: () => getMyPassQr(db),
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: enabled,
    refetchInterval: (q) => {
      const expires = q.state.data?.expires_at;
      if (!expires) return 5000;
      return Math.max(1000, new Date(expires).getTime() - Date.now() - 1000);
    },
  });
  return query.data ? { payload: query.data.payload, expiresAt: query.data.expires_at } : null;
}
