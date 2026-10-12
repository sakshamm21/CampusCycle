import { gate } from './gate';
import { ACTIVE_RIDE, makeContext } from './testContext';

const signedIn = { status: 'signedIn' as const, permsSeen: true, firstRoute: true };

describe('gate (04 §1.2)', () => {
  it('waits while the session is loading', () => {
    expect(gate({ status: 'loading', ctx: null, permsSeen: true, firstRoute: true })).toBeNull();
  });

  it('sends a signed-out visitor to Welcome', () => {
    expect(gate({ status: 'signedOut', ctx: null, permsSeen: true, firstRoute: true })).toEqual({
      route: '/welcome',
      signOut: false,
    });
  });

  it('signs out and goes to Welcome when the profile is missing', () => {
    expect(gate({ ...signedIn, ctx: null })).toEqual({ route: '/welcome', signOut: true });
  });

  it('shows Permissions before anything else, once', () => {
    const pending = makeContext({ profile: { status: 'pending' } });
    expect(gate({ ...signedIn, ctx: pending, permsSeen: false })?.route).toBe('/permissions');
    expect(gate({ ...signedIn, ctx: pending })?.route).toBe('/pending');
  });

  it('blocks an account without a college, before looking at its status', () => {
    const owner = makeContext({ college: null, profile: { status: 'approved', role: 'super_admin' } });
    expect(gate({ ...signedIn, ctx: owner })?.route).toBe('/blocked?variant=no_college');
    const pendingNoCollege = makeContext({ college: null, profile: { status: 'pending' } });
    expect(gate({ ...signedIn, ctx: pendingNoCollege })?.route).toBe('/blocked?variant=no_college');
  });

  it.each([
    ['pending', '/pending'],
    ['rejected', '/blocked?variant=rejected'],
    ['suspended', '/blocked?variant=suspended'],
  ] as const)('routes a %s profile to %s', (status, route) => {
    expect(gate({ ...signedIn, ctx: makeContext({ profile: { status } }) })?.route).toBe(route);
  });

  it('opens Riding for an unfinished ride on the first route since launch only', () => {
    const riding = makeContext({ pass: { status: 'riding' }, ride: ACTIVE_RIDE });
    expect(gate({ ...signedIn, ctx: riding })?.route).toBe('/riding');
    expect(gate({ ...signedIn, ctx: riding, firstRoute: false })?.route).toBe('/(main)');
  });

  it('keeps a suspended rider with a ride on Blocked', () => {
    const ctx = makeContext({ profile: { status: 'suspended' }, ride: ACTIVE_RIDE });
    expect(gate({ ...signedIn, ctx })?.route).toBe('/blocked?variant=suspended');
  });

  it('otherwise opens Home', () => {
    expect(gate({ ...signedIn, ctx: makeContext() })).toEqual({ route: '/(main)', signOut: false });
  });
});
