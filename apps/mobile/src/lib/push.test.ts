import { routeForPush } from './push';

describe('routeForPush (04 §1.8)', () => {
  it.each([
    [{ screen: 'home' }, '/(main)'],
    [{ screen: 'riding' }, '/riding'],
    [{ screen: 'rides', ride_id: 'abc' }, '/ride/abc'],
    [{ screen: 'rides' }, '/(main)/history'],
    [{ screen: 'rides', ride_id: '' }, '/(main)/history'],
    [{ screen: 'profile' }, '/(main)/profile'],
    [{ screen: 'notifications' }, '/notifications'],
  ])('%j opens %s', (data, route) => {
    expect(routeForPush(data)).toBe(route);
  });

  it('lets the gate decide for blocked', () => {
    expect(routeForPush({ screen: 'blocked' })).toBeNull();
  });

  it.each([{ screen: 'approvals' }, { screen: 'issues' }, {}, null, undefined])(
    'sends anything else (%j) to the inbox',
    (data) => {
      expect(routeForPush(data)).toBe('/notifications');
    },
  );
});
