import type { MyContext } from '@campuscycle/shared';

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn';

export type GateRoute =
  | '/welcome'
  | '/permissions'
  | '/pending'
  | '/blocked?variant=no_college'
  | '/blocked?variant=rejected'
  | '/blocked?variant=suspended'
  | '/riding'
  | '/(main)';

export interface GateInput {
  status: SessionStatus;
  ctx: MyContext | null;
  permsSeen: boolean;
  /** True while the app has not shown any signed-in route since launch. */
  firstRoute: boolean;
}

export interface GateResult {
  route: GateRoute;
  /** The profile is missing: sign out before going to Welcome. */
  signOut: boolean;
}

// The routing table of 04 §1.2, checked in order. `loading` has no route: callers wait.
export function gate({ status, ctx, permsSeen, firstRoute }: GateInput): GateResult | null {
  if (status === 'loading') return null;
  if (status === 'signedOut') return { route: '/welcome', signOut: false };
  if (ctx === null) return { route: '/welcome', signOut: true };
  if (!permsSeen) return { route: '/permissions', signOut: false };
  if (ctx.college === null) return { route: '/blocked?variant=no_college', signOut: false };
  if (ctx.profile.status === 'pending') return { route: '/pending', signOut: false };
  if (ctx.profile.status === 'rejected') return { route: '/blocked?variant=rejected', signOut: false };
  if (ctx.profile.status === 'suspended') return { route: '/blocked?variant=suspended', signOut: false };
  if (ctx.ride !== null && firstRoute) return { route: '/riding', signOut: false };
  return { route: '/(main)', signOut: false };
}
