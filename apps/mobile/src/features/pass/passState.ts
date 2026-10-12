import type { MyContext } from '@campuscycle/shared';

export type PassState = 'pending' | 'minting' | 'ready' | 'riding' | 'overdue' | 'returned' | 'suspended';

// `returned` is never derived here: R15 sets it for a moment after a return (04 §1.3).
export function passDisplayState(ctx: MyContext): PassState {
  const p = ctx.profile,
    pass = ctx.pass;
  if (p.status === 'suspended' || pass.status === 'suspended') return 'suspended';
  if (p.status !== 'approved') return 'pending';
  if (pass.status === 'overdue') return 'overdue';
  if (pass.status === 'riding') return 'riding';
  if (pass.minted_seen_at === null) return 'minting';
  return 'ready';
}
