import { passDisplayState } from './passState';
import { makeContext } from '@/lib/testContext';

describe('passDisplayState (04 §1.3)', () => {
  it('is suspended when the profile is suspended', () => {
    expect(passDisplayState(makeContext({ profile: { status: 'suspended' } }))).toBe('suspended');
  });

  it('is suspended when only the pass is suspended', () => {
    expect(passDisplayState(makeContext({ pass: { status: 'suspended' } }))).toBe('suspended');
  });

  it('puts suspension ahead of a pass that still says riding', () => {
    expect(
      passDisplayState(makeContext({ profile: { status: 'suspended' }, pass: { status: 'riding' } })),
    ).toBe('suspended');
  });

  it.each(['pending', 'rejected'] as const)('is pending for a %s profile', (status) => {
    expect(passDisplayState(makeContext({ profile: { status }, pass: { status: 'pending' } }))).toBe(
      'pending',
    );
  });

  it('is overdue before riding', () => {
    expect(passDisplayState(makeContext({ pass: { status: 'overdue' } }))).toBe('overdue');
  });

  it('is riding', () => {
    expect(passDisplayState(makeContext({ pass: { status: 'riding' } }))).toBe('riding');
  });

  it('is minting until the mint has been seen', () => {
    expect(passDisplayState(makeContext({ pass: { minted_seen_at: null } }))).toBe('minting');
  });

  it('does not mint while riding, even if the mint was never seen', () => {
    expect(passDisplayState(makeContext({ pass: { status: 'riding', minted_seen_at: null } }))).toBe(
      'riding',
    );
  });

  it('is ready otherwise', () => {
    expect(passDisplayState(makeContext())).toBe('ready');
  });
});
