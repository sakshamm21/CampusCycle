import { describe, it, expect } from 'vitest';
import { routeForNotification } from './routeForNotification';

describe('routeForNotification (05 §1.4 table)', () => {
  it('routes approvals to /approvals', () => {
    expect(routeForNotification({ screen: 'approvals' })).toBe('/approvals');
  });

  it('routes users to /users/:id if user_id is present', () => {
    expect(routeForNotification({ screen: 'users', user_id: 'usr_123' })).toBe('/users/usr_123');
  });

  it('routes users to /users if user_id is missing', () => {
    expect(routeForNotification({ screen: 'users' })).toBe('/users');
  });

  it('routes rides to /rides?ride=:id if ride_id is present', () => {
    expect(routeForNotification({ screen: 'rides', ride_id: 'ride_456' })).toBe('/rides?ride=ride_456');
  });

  it('routes rides to /rides if ride_id is missing', () => {
    expect(routeForNotification({ screen: 'rides' })).toBe('/rides');
  });

  it('routes stands to /stands', () => {
    expect(routeForNotification({ screen: 'stands' })).toBe('/stands');
  });

  it('routes issues to /issues?id=:id if issue_id is present', () => {
    expect(routeForNotification({ screen: 'issues', issue_id: 'iss_789' })).toBe('/issues?id=iss_789');
  });

  it('routes issues to /issues if issue_id is missing', () => {
    expect(routeForNotification({ screen: 'issues' })).toBe('/issues');
  });

  it('routes unknown screen or missing screen to /dashboard', () => {
    expect(routeForNotification({ screen: 'other' })).toBe('/dashboard');
    expect(routeForNotification({})).toBe('/dashboard');
    expect(routeForNotification(null)).toBe('/dashboard');
    expect(routeForNotification(undefined)).toBe('/dashboard');
  });
});
